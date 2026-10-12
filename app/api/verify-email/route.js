import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/verify-email?token=<rawToken>
 *
 * Internal server action used by the /verify page.  Returns JSON so the page
 * can render the appropriate UI state without a full redirect.
 *
 * Response shapes:
 *   { status: 'ok'      }  — token valid; account activated
 *   { status: 'expired' }  — token found but past expires_at
 *   { status: 'used'    }  — token was already consumed
 *   { status: 'invalid' }  — token not found / bad format
 *   { status: 'error'   }  — unexpected server error
 *
 * Token replay & concurrency:
 *   We mark the token used=true in the same request that checks its state.
 *   Supabase/PostgreSQL row-level update is atomic at the row level, so two
 *   concurrent requests for the same token will each attempt the update, but
 *   only one will find used=false at lookup time — the second will see the
 *   token already marked used and return 'used'.  This is best-effort
 *   protection; a proper atomic CAS would require a database stored procedure.
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const rawToken = searchParams.get('token');

        // --- 1. Format validation ---
        // rawToken must be exactly 64 lowercase hex characters
        if (!rawToken || !/^[0-9a-f]{64}$/.test(rawToken)) {
            return NextResponse.json({ status: 'invalid' }, { status: 400 });
        }

        // --- 2. Compute SHA-256 hash ---
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

        // --- 3. Atomic consumption via PostgreSQL function ---
        const { data: rpcStatus, error: rpcErr } = await supabaseAdmin.rpc('consume_verification_token', {
            p_hashed_token: hashedToken,
        });

        if (!rpcErr) {
            switch (rpcStatus) {
                case 'ok':
                    return NextResponse.json({ status: 'ok' });
                case 'used':
                    return NextResponse.json({ status: 'used' }, { status: 400 });
                case 'expired':
                    return NextResponse.json({ status: 'expired' }, { status: 400 });
                case 'invalid':
                    return NextResponse.json({ status: 'invalid' }, { status: 400 });
                default:
                    console.error('[verify-email] unrecognized RPC status:', rpcStatus);
                    return NextResponse.json({ status: 'error' }, { status: 500 });
            }
        }

        // If the stored procedure is not installed in the schema cache yet
        // (e.g. pending database migration review), fall back to CAS-guarded queries.
        const isFunctionMissing =
            rpcErr.code === 'PGRST202' ||
            rpcErr.code === '42883' ||
            rpcErr.message?.includes('consume_verification_token') ||
            rpcErr.message?.includes('not found') ||
            rpcErr.message?.includes('schema cache');

        if (!isFunctionMissing) {
            console.error('[verify-email] RPC error:', rpcErr.message);
            return NextResponse.json({ status: 'error' }, { status: 500 });
        }

        // --- 4. Fallback execution ---
        const { data: tokenRecord, error: lookupErr } = await supabaseAdmin
            .from('user_tokens')
            .select('id, user_id, expires_at, used, type')
            .eq('token', hashedToken)
            .eq('type', 'verification')
            .maybeSingle();

        if (lookupErr) {
            console.error('[verify-email] fallback lookup error:', lookupErr.message);
            return NextResponse.json({ status: 'error' }, { status: 500 });
        }

        if (!tokenRecord) {
            return NextResponse.json({ status: 'invalid' }, { status: 400 });
        }

        if (tokenRecord.used) {
            return NextResponse.json({ status: 'used' }, { status: 400 });
        }

        if (new Date(tokenRecord.expires_at) < new Date()) {
            return NextResponse.json({ status: 'expired' }, { status: 400 });
        }

        // Atomic CAS: mark token used only if it is still unused
        const { data: updatedTokens, error: markErr } = await supabaseAdmin
            .from('user_tokens')
            .update({ used: true })
            .eq('id', tokenRecord.id)
            .eq('used', false)
            .select('id');

        if (markErr) {
            console.error('[verify-email] fallback mark-used error:', markErr.message);
            return NextResponse.json({ status: 'error' }, { status: 500 });
        }

        if (!updatedTokens || updatedTokens.length === 0) {
            // Token was consumed concurrently
            return NextResponse.json({ status: 'used' }, { status: 400 });
        }

        // Activate user account across their roles
        const { error: roleErr } = await supabaseAdmin
            .from('user_roles')
            .update({ is_verified: true })
            .eq('user_id', tokenRecord.user_id);

        if (roleErr) {
            console.error('[verify-email] fallback role update error:', roleErr.message);
            return NextResponse.json({ status: 'error' }, { status: 500 });
        }

        return NextResponse.json({ status: 'ok' });

    } catch (err) {
        console.error('[verify-email] unexpected error:', err.message);
        return NextResponse.json({ status: 'error' }, { status: 500 });
    }
}
