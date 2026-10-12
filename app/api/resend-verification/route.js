import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Generate a secure verification token.
 * Returns { rawToken, hashedToken }
 *   rawToken   – 64-char hex string, sent once in the email URL, never stored
 *   hashedToken – SHA-256 of rawToken, stored so the DB never holds the secret
 */
function generateVerificationToken() {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    return { rawToken, hashedToken };
}

export async function POST(request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json(
                { success: false, message: 'Email is required' },
                { status: 400 }
            );
        }

        // Find user — do not reveal whether the address exists
        const { data: user, error: userErr } = await supabaseAdmin
            .from('users')
            .select('id, full_name, email')
            .eq('email', email)
            .single();

        if (userErr || !user) {
            return NextResponse.json({
                success: true,
                message: 'If your email is registered, a verification link will be sent.'
            });
        }

        // Check if already verified
        const { data: roleData, error: roleErr } = await supabaseAdmin
            .from('user_roles')
            .select('is_verified')
            .eq('user_id', user.id)
            .single();

        if (!roleErr && roleData?.is_verified === true) {
            return NextResponse.json({
                success: false,
                message: 'Email is already verified.'
            });
        }

        // Invalidate all prior unused verification tokens for this user
        await supabaseAdmin
            .from('user_tokens')
            .update({ used: true })
            .eq('user_id', user.id)
            .eq('type', 'verification')
            .eq('used', false);

        // Generate CSPRNG token; store only the SHA-256 hash
        const { rawToken, hashedToken } = generateVerificationToken();

        const { error: tokenErr } = await supabaseAdmin
            .from('user_tokens')
            .insert({
                user_id: user.id,
                token: hashedToken,
                created_at: new Date(),
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                type: 'verification',
                used: false
            });

        if (tokenErr) throw tokenErr;

        // Send verification email
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        // rawToken is the only secret in the URL; no PII (no email) is embedded
        const verificationUrl = `${baseUrl}/verify?token=${rawToken}`;

        const emailResponse = await fetch(`${baseUrl}/api/send-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-secret': process.env.INTERNAL_API_SECRET || ''
            },
            body: JSON.stringify({
                email: user.email,
                subject: 'Verify your LocalGrow account',
                message: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h1 style="display: inline-block; margin: 0;">
                                <span style="background-color: #f472b6; padding: 5px 10px; display: inline-block; transform: rotate(1deg);">Coupon</span>
                                <span style="background-color: #22d3ee; padding: 5px 10px; display: inline-block; transform: rotate(-1deg); margin-left: 5px;">Stall</span>
                            </h1>
                        </div>

                        <div style="border: 3px solid #000; padding: 20px; background-color: #fff;">
                            <h2 style="margin-top: 0;">Verify Your Email Address</h2>
                            <p>Hello ${user.full_name},</p>
                            <p>You requested a new verification link for your LocalGrow account. Please click the button below to verify your email:</p>

                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${verificationUrl}" style="background-color: #4ade80; color: #000; font-weight: bold; text-transform: uppercase; padding: 12px 24px; text-decoration: none; border: 3px solid #000; box-shadow: 4px 4px 0 0 #000; display: inline-block;">
                                    Verify My Account
                                </a>
                            </div>

                            <p>If the button doesn't work, you can also click on the link below or copy and paste it into your browser:</p>
                            <p><a href="${verificationUrl}">${verificationUrl}</a></p>

                            <p>This verification link will expire in 24 hours.</p>

                            <p>If you didn't request this verification email, please ignore it.</p>
                        </div>

                        <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #666;">
                            <p>&copy; ${new Date().getFullYear()} LocalGrow. All rights reserved.</p>
                        </div>
                    </div>
                `
            }),
        });

        const emailData = await emailResponse.json();

        if (!emailData.success) {
            return NextResponse.json({
                success: false,
                message: 'Failed to send verification email'
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Verification email sent successfully'
        });

    } catch (error) {
        console.error('Error resending verification:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to resend verification email' },
            { status: 500 }
        );
    }
}