// api/send-notification/route.js
import { supabase } from '@/lib/supabase';
import webpush from 'web-push';

webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

export async function POST(request) {
    try {
        // ── 1. Internal-secret guard ────────────────────────────────────────
        const internalSecret = process.env.INTERNAL_API_SECRET;
        if (!internalSecret) {
            console.error('[send-notification] INTERNAL_API_SECRET is not set');
            return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
        }

        const providedSecret = request.headers.get('x-internal-secret');
        if (!providedSecret || providedSecret !== internalSecret) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // ── 2. Parse and validate payload ───────────────────────────────────
        const { userId, title, body, url, tag, data: notificationData } = await request.json();

        // Broadcast (no userId) is disabled for now — only per-user notifications
        // are permitted from internal callers. Uncomment the block below and add
        // a superadmin role check if broadcast support is ever needed.
        if (!userId) {
            return Response.json(
                { error: 'userId is required; broadcast notifications are not permitted' },
                { status: 400 }
            );
        }

        if (
            typeof title !== 'string' || title.length > 200 ||
            typeof body !== 'string' || body.length > 500
        ) {
            return Response.json({ error: 'Invalid payload length' }, { status: 400 });
        }

        console.log('Received notification request:', { userId, title, body, url, tag });

        // ── 3. Fetch target user's push subscriptions ───────────────────────
        const { data: subscriptions, error } = await supabase
            .from('push_subscriptions')
            .select('subscription')
            .eq('user_id', userId);

        console.log(`Found ${subscriptions?.length || 0} subscriptions`);

        if (error) {
            console.error('Database error:', error);
            return Response.json({ error: 'Database error' }, { status: 500 });
        }

        if (!subscriptions || subscriptions.length === 0) {
            return Response.json({
                error: 'No subscriptions found',
                message: `No subscriptions for user ${userId}`
            }, { status: 404 });
        }

        // ── 4. Send push notifications ──────────────────────────────────────
        const payload = JSON.stringify({
            title,
            body,
            url: url || '/',
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            tag: tag || 'general',
            data: notificationData || {}
        });

        console.log('Sending payload:', payload);

        const promises = subscriptions.map(async (sub, index) => {
            try {
                await webpush.sendNotification(sub.subscription, payload);
                console.log(`Notification ${index + 1}/${subscriptions.length} sent successfully`);
                return { success: true, index };
            } catch (error) {
                console.error(`Failed to send notification ${index + 1}:`, error);

                // Handle invalid subscriptions (expired/unsubscribed)
                if (error.statusCode === 410 || error.statusCode === 404) {
                    // TODO: Remove invalid subscription from database
                    console.log(`Subscription ${index + 1} appears to be invalid (${error.statusCode})`);
                }

                return { success: false, error: error.message, index };
            }
        });

        const results = await Promise.allSettled(promises);

        const successful = results.filter(result =>
            result.status === 'fulfilled' && result.value.success
        ).length;

        const failed = results.length - successful;

        console.log(`Notification summary: ${successful} successful, ${failed} failed`);

        if (successful === 0) {
            return Response.json({
                error: 'All notifications failed',
                details: results
            }, { status: 500 });
        }

        return Response.json({
            success: true,
            summary: {
                total: subscriptions.length,
                successful,
                failed
            }
        });

    } catch (error) {
        console.error('Error sending notification:', error);
        return Response.json({
            error: 'Failed to send notification',
            message: error.message
        }, { status: 500 });
    }
}