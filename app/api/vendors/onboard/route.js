import { NextResponse } from "next/server";
import { options } from "@/app/api/auth/[...nextauth]/options";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { z } from "zod";

const vendorFormSchema = z.object({
    name: z.string().min(2, "Business name must be at least 2 characters"),
    description: z.string().optional(),
    category_id: z.string().min(1, "Category is required"),
    website: z.string().url("Invalid website URL").or(z.string().length(0)).optional(),
    phone: z.string().min(10, "Phone number must be at least 10 digits"),
    email: z.string().email("Invalid email address"),
    address: z.string().min(5, "Address must be at least 5 characters"),
    city: z.string().min(2, "City is required"),
    state: z.string().min(2, "State/Province is required"),
    postal_code: z.string().min(4, "Valid postal/ZIP code is required"),
    area: z.string().optional(),
    country: z.string().optional(),
});

export async function POST(request) {
    try {
        const session = await getServerSession(options);
        if (!session) {
            return NextResponse.json(
                { success: false, message: "Authentication required. Please log in to continue." },
                { status: 401 }
            );
        }

        const userId = session?.user?.id;
        const userEmail = session?.user?.email;

        const formData = await request.json();

        // Check if user already has a registered business
        const { data: existingBusiness, error: existingBusinessError } = await supabaseAdmin
            .from("businesses")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

        if (existingBusinessError) {
            console.error("Error checking existing business:", existingBusinessError);
            return NextResponse.json(
                { success: false, message: "Failed to process your application. Please try again later." },
                { status: 500 }
            );
        }

        if (existingBusiness) {
            return NextResponse.json(
                { success: false, message: "You already have a registered business. You cannot submit another application." },
                { status: 409 }
            );
        }

        // Validate form data
        const validationResult = vendorFormSchema.safeParse(formData);
        if (!validationResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Validation failed. Please check your inputs.",
                    errors: validationResult.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }

        // Insert business
        const businessData = {
            user_id: userId,
            name: formData.name,
            description: formData.description || "",
            category_id: formData.category_id,
            website: formData.website || "",
            phone: formData.phone,
            email: formData.email,
        };

        const { data: businessDataResponse, error: businessDataError } = await supabaseAdmin
            .from("businesses")
            .insert(businessData)
            .select("id")
            .single();

        if (businessDataError) {
            console.error("Supabase business insertion error:", businessDataError);
            return NextResponse.json(
                { success: false, message: "Failed to submit your application. Please try again later." },
                { status: 500 }
            );
        }

        // Insert business location
        const businessLocationData = {
            business_id: businessDataResponse.id,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            postal_code: formData.postal_code,
            area: formData.area,
            country: formData.country || "India",
        };

        const { error: businessLocationDataError } = await supabaseAdmin
            .from("business_locations")
            .insert(businessLocationData);

        if (businessLocationDataError) {
            console.error("Supabase location insertion error:", businessLocationDataError);
            await supabaseAdmin.from("businesses").delete().eq("id", businessDataResponse.id);
            return NextResponse.json(
                { success: false, message: "Failed to submit your application. Please try again later." },
                { status: 500 }
            );
        }

        // Assign user role
        const { error: userRoleError } = await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: userId, role: "app_business_owner" });

        if (userRoleError) {
            console.error("Supabase user role insertion error:", userRoleError);
            await supabaseAdmin.from("businesses").delete().eq("id", businessDataResponse.id);
            return NextResponse.json(
                { success: false, message: "Failed to submit your application. Please try again later." },
                { status: 500 }
            );
        }

        // ← NEW: Send internal notification to user
        await supabaseAdmin
            .from("internal_notifications")
            .insert({
                user_id: userId,
                title: "📋 Application Received",
                message: `Your business "${formData.name}" application has been received. Our team will review it within 1–2 business days.`,
                type: "info",
                category: "business_application",
                is_read: false,
            })

        // ← NEW: Send confirmation email to vendor
        try {
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
            await fetch(`${baseUrl}/api/send-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-internal-secret': process.env.INTERNAL_API_SECRET || ''
                },
                body: JSON.stringify({
                    email: userEmail,
                    subject: '✅ Application Received — LocalGrow',
                    message: `
                        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">
                            <div style="background: #1e3a5f; padding: 24px 32px; border-radius: 12px 12px 0 0; text-align: center;">
                                <h1 style="color: #f59e0b; margin: 0; font-size: 24px; font-weight: 700;">LocalGrow</h1>
                                <p style="color: rgba(255,255,255,0.6); margin: 4px 0 0; font-size: 13px;">Vendor Application</p>
                            </div>
                            <div style="background: #fff; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
                                <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin: 0 0 16px;">
                                    We received your application!
                                </h2>
                                <p style="color: #475569; font-size: 14px; line-height: 1.7; margin: 0 0 16px;">
                                    Thank you for applying to join LocalGrow as a vendor. Our admin team will review your business details and get back to you within <strong>1–2 business days</strong>.
                                </p>
                                <div style="background: #fffbeb; border: 1px solid #fcd34d; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; padding: 14px 16px; margin-bottom: 24px;">
                                    <p style="color: #92400e; font-size: 13px; margin: 0;">
                                        You will receive another email once a decision has been made on your application.
                                    </p>
                                </div>
                                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px;">
                                    <p style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin: 0 0 6px;">
                                        Business Name
                                    </p>
                                    <p style="font-size: 15px; font-weight: 600; color: #0f172a; margin: 0;">
                                        ${formData.name}
                                    </p>
                                </div>
                                <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
                                    This is an automated message from LocalGrow Admin.
                                </p>
                            </div>
                        </div>
                    `
                })
            })
        } catch (emailErr) {
            // Don't block the response if email fails
            console.error('Error sending confirmation email:', emailErr)
        }

        return NextResponse.json(
            {
                success: true,
                message: "Vendor application submitted successfully!",
                data: { businessId: businessDataResponse.id },
            },
            { status: 201 }
        );

    } catch (error) {
        console.error("Server action error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}