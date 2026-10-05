import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// This endpoint is INTERNAL-ONLY: it must only be called by other server-side
// code (API routes, server actions) that supply the shared INTERNAL_API_SECRET
// header. It must NEVER be called from the browser.
export async function POST(request) {
    try {
        // ── 1. Internal-secret guard ────────────────────────────────────────
        const internalSecret = process.env.INTERNAL_API_SECRET;
        if (!internalSecret) {
            // Fail closed if the env var is not configured.
            console.error('[send-email] INTERNAL_API_SECRET is not set');
            return NextResponse.json(
                { success: false, message: 'Server misconfiguration' },
                { status: 500 }
            );
        }

        const providedSecret = request.headers.get('x-internal-secret');
        if (!providedSecret || providedSecret !== internalSecret) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            );
        }

        // ── 2. Parse and validate body ──────────────────────────────────────
        const { email, subject, message } = await request.json();

        if (!email || !subject || !message) {
            return NextResponse.json(
                { success: false, message: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Basic length / sanity guards
        if (
            typeof email !== 'string' || email.length > 254 ||
            typeof subject !== 'string' || subject.length > 200 ||
            typeof message !== 'string' || message.length > 100_000
        ) {
            return NextResponse.json(
                { success: false, message: 'Invalid field length' },
                { status: 400 }
            );
        }

        // ── 3. Send via Resend ──────────────────────────────────────────────
        const resend = new Resend(process.env.RESEND_API_KEY);

        const { data, error } = await resend.emails.send({
            from: `LocalGrow <${process.env.FROM_EMAIL || 'onboarding@resend.dev'}>`,
            to: email,
            subject: subject,
            html: message
        });

        if (error) {
            console.error('Resend API error:', error);
            return NextResponse.json(
                { success: false, message: 'Failed to send email', error },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Email sent successfully',
            id: data?.id
        });
    } catch (error) {
        console.error('Error sending email:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to send email' },
            { status: 500 }
        );
    }
}