const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export async function sendApprovalEmail({ email, name, type }) {
    const isVendor = type === 'vendor'

    const subject = isVendor
        ? '🎉 Your Business Has Been Approved — LocalGrow'
        : '🎉 Your Investor Profile Has Been Approved — LocalGrow'

    const dashboardLink = isVendor
        ? `${BASE_URL}/business/dashboard`
        : `${BASE_URL}/investors`

    const message = `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">
            
            <div style="background: #1e3a5f; padding: 24px 32px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: #f59e0b; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
                    LocalGrow
                </h1>
                <p style="color: rgba(255,255,255,0.6); margin: 4px 0 0; font-size: 13px;">
                    Admin Notification
                </p>
            </div>

            <div style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
                
                <div style="text-align: center; margin-bottom: 28px;">
                    <div style="display: inline-block; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 50%; width: 64px; height: 64px; line-height: 64px; font-size: 28px; margin-bottom: 16px;">
                        ✅
                    </div>
                    <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 8px;">
                        Application Approved!
                    </h2>
                    <p style="color: #64748b; font-size: 14px; margin: 0;">
                        Great news, ${name}
                    </p>
                </div>

                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #22c55e; border-radius: 0 8px 8px 0; padding: 16px; margin-bottom: 24px;">
                    <p style="color: #15803d; font-size: 14px; margin: 0; font-weight: 500;">
                        Your ${isVendor ? 'business' : 'investor'} application on LocalGrow has been 
                        <strong>reviewed and approved</strong> by our admin team.
                    </p>
                </div>

                <p style="color: #475569; font-size: 14px; line-height: 1.7; margin: 0 0 24px;">
                    You now have full access to your ${isVendor ? 'vendor' : 'investor'} dashboard. 
                    ${isVendor
                        ? 'You can start creating coupons, connecting with investors, and growing your business.'
                        : 'You can now browse vendors, send connection requests, and start investing.'
                    }
                </p>

                <div style="text-align: center; margin-bottom: 28px;">
                    <a href="${dashboardLink}" 
                        style="display: inline-block; background: #1e3a5f; color: #ffffff; font-weight: 600; font-size: 14px; padding: 14px 32px; border-radius: 8px; text-decoration: none; letter-spacing: 0.3px;">
                        Go to Dashboard →
                    </a>
                </div>

                <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; text-align: center;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                        This is an automated message from LocalGrow Admin.
                        If you have questions, please contact support.
                    </p>
                </div>
            </div>

        </div>
    `

    await fetch(`${BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': process.env.INTERNAL_API_SECRET || ''
        },
        body: JSON.stringify({ email, subject, message })
    })
}

export async function sendRejectionEmail({ email, name, type, reason }) {
    const isVendor = type === 'vendor'

    const subject = isVendor
        ? '❌ Your Business Application — LocalGrow'
        : '❌ Your Investor Profile Application — LocalGrow'

    const reapplyLink = isVendor
        ? `${BASE_URL}/u/profile/apply-for-business`
        : `${BASE_URL}/investors/apply`

    const message = `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">

            <div style="background: #1e3a5f; padding: 24px 32px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: #f59e0b; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
                    LocalGrow
                </h1>
                <p style="color: rgba(255,255,255,0.6); margin: 4px 0 0; font-size: 13px;">
                    Admin Notification
                </p>
            </div>

            <div style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">

                <div style="text-align: center; margin-bottom: 28px;">
                    <div style="display: inline-block; background: #fef2f2; border: 1px solid #fecaca; border-radius: 50%; width: 64px; height: 64px; line-height: 64px; font-size: 28px; margin-bottom: 16px;">
                        ❌
                    </div>
                    <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 8px;">
                        Application Not Approved
                    </h2>
                    <p style="color: #64748b; font-size: 14px; margin: 0;">
                        Hello, ${name}
                    </p>
                </div>

                <div style="background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 0 8px 8px 0; padding: 16px; margin-bottom: 24px;">
                    <p style="color: #b91c1c; font-size: 13px; font-weight: 600; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.05em;">
                        Reason for rejection
                    </p>
                    <p style="color: #dc2626; font-size: 14px; margin: 0; line-height: 1.6;">
                        ${reason}
                    </p>
                </div>

                <p style="color: #475569; font-size: 14px; line-height: 1.7; margin: 0 0 24px;">
                    We have carefully reviewed your ${isVendor ? 'business' : 'investor'} application 
                    and unfortunately it does not meet our current requirements. 
                    You are welcome to review the reason above, make the necessary corrections, 
                    and reapply.
                </p>

                <div style="text-align: center; margin-bottom: 28px;">
                    <a href="${reapplyLink}"
                        style="display: inline-block; background: #f8fafc; color: #1e3a5f; font-weight: 600; font-size: 14px; padding: 14px 32px; border-radius: 8px; text-decoration: none; border: 1px solid #e2e8f0; letter-spacing: 0.3px;">
                        Reapply →
                    </a>
                </div>

                <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; text-align: center;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                        This is an automated message from LocalGrow Admin.
                        If you have questions, please contact support.
                    </p>
                </div>
            </div>

        </div>
    `

    await fetch(`${BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': process.env.INTERNAL_API_SECRET || ''
        },
        body: JSON.stringify({ email, subject, message })
    })
}