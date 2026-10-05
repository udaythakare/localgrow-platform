import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { generateUniqueUsername } from '@/helpers/registrationHelpers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request) {
    try {
        const { fullname, email, password, mobile_number } = await request.json();

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate unique username
        const username = await generateUniqueUsername(fullname);

        // Insert user
        const { data: user, error: userErr } = await supabaseAdmin
            .from('users')
            .insert({ full_name: fullname, email, password: hashedPassword, mobile_number, username })
            .select('id')
            .single();

        if (userErr) throw userErr;

        // Assign default role
        const { error: roleErr } = await supabaseAdmin
            .from('user_roles')
            .insert({ user_id: user.id, role: 'app_user', is_verified: false });

        if (roleErr) throw roleErr;

        // Create a token string using time and randomness
        const rawToken = `${email}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        const hashedToken = await bcrypt.hash(rawToken, 10);

        // Store hashed token with expiration
        const { error: tokenErr } = await supabaseAdmin
            .from('user_tokens')
            .insert({
                user_id: user.id,
                token: hashedToken,
                created_at: new Date(),
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
                type: 'verification',
                used: false
            });

        if (tokenErr) throw tokenErr;

        // Send verification email
        try {
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
            const verificationUrl = `${baseUrl}/verify?token=${rawToken}`;

            // Make API call to send the email
            const emailResponse = await fetch(`${baseUrl}/api/send-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-internal-secret': process.env.INTERNAL_API_SECRET || ''
                },
                body: JSON.stringify({
                    email: email,
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
                                <h2> style="margin-top: 0;">Verify Your Email Address</h2>
                                <p>Hello ${fullname},</p>
                                <p>Thank you for registering with LocalGrow. To complete your registration and verify your account, please click the button below:</p>

                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="${verificationUrl}" style="background-color: #4ade80; color: #000; font-weight: bold; text-transform: uppercase; padding: 12px 24px; text-decoration: none; border: 3px solid #000; box-shadow: 4px 4px 0 0 #000; display: inline-block;">
                                        Verify My Account
                                    </a>
                                </div>
                                
                                <p>If the button doesn't work, you can also click on the link below or copy and paste it into your browser:</p>
                                <p><a href="${verificationUrl}">${verificationUrl}</a></p>
                                
                                <p>This verification link will expire in 24 hours.</p>
                                
                                <p>If you didn't create an account with LocalGrow, please ignore this email.</p>
                            </div>
                            
                            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #666;">
                                <p>&copy; ${new Date().getFullYear()} LocalGrow. All rights reserved.</p>
                            </div>
                        </div>
                    `
                }),
            });

            const emailData = await emailResponse.json();
            // // console.log('Email sending response:', emailData);

            // We don't throw an error here so registration can still succeed even if email fails
            // Instead, we'll provide information about the email status in the response

            return NextResponse.json({
                success: true,
                emailSent: emailData.success,
                message: 'Registration successful. Please check your email to verify your account.'
            });

        } catch (emailErr) {
            console.error('Error sending verification email:', emailErr);
            // Still return success for the registration, but indicate email failed
            return NextResponse.json({
                success: true,
                emailSent: false,
                message: 'Registration successful, but there was an issue sending the verification email.'
            });
        }

    } catch (err) {
        console.error(err);
        return NextResponse.json({ success: false, message: err.message }, { status: 400 });
    }
}