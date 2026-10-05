// app/api/businesses/[id]/route.js - API route for individual business operations
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { options } from '@/app/api/auth/[...nextauth]/options';
import { getServerSession } from 'next-auth';

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - Fetch a specific business
export async function GET(request, props) {
    const params = await props.params;
    try {
        const session = await getServerSession(options);

        if (!session?.user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { id } = params;

        // Fetch business
        const { data: business, error: businessError } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', id)
            .eq('user_id', session.user.id)
            .single();

        if (businessError) {
            if (businessError.code === 'PGRST116') {
                return NextResponse.json({ message: 'Business not found' }, { status: 404 });
            }
            throw businessError;
        }

        // Fetch locations
        const { data: locations, error: locationsError } = await supabase
            .from('business_locations')
            .select('*')
            .eq('business_id', id);

        if (locationsError) throw locationsError;

        return NextResponse.json({
            ...business,
            locations
        });
    } catch (error) {
        console.error('Error fetching business:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}

// PUT - Update a business
export async function PUT(request, props) {
    const params = await props.params;
    try {
        const session = await getServerSession(options);

        if (!session?.user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { id } = params;

        // Check if business exists and belongs to user
        const { data: existingBusiness, error: checkError } = await supabase
            .from('businesses')
            .select('id')
            .eq('id', id)
            .eq('user_id', session.user.id)
            .single();

        if (checkError) {
            if (checkError.code === 'PGRST116') {
                return NextResponse.json({ message: 'Business not found' }, { status: 404 });
            }
            throw checkError;
        }

        const { name, description, category_id, website, phone, email, locations } = await request.json();

        // Validate required fields
        if (!name) {
            return NextResponse.json(
                { message: 'Business name is required' },
                { status: 400 }
            );
        }

        if (!locations || locations.length === 0 || !locations.some(
            (loc) => loc.address && loc.city && loc.state && loc.postal_code && loc.country
        )) {
            return NextResponse.json(
                { message: 'At least one complete location is required' },
                { status: 400 }
            );
        }

        // Update business
        const { error: updateError } = await supabase
            .from('businesses')
            .update({
                name,
                description: description || null,
                category_id: category_id || null,
                website: website || null,
                phone: phone || null,
                email: email || null
            })
            .eq('id', id)
            .eq('user_id', session.user.id);

        if (updateError) throw updateError;

        // Get existing locations
        const { data: existingLocations, error: locationsError } = await supabase
            .from('business_locations')
            .select('id')
            .eq('business_id', id);

        if (locationsError) throw locationsError;

        const existingIds = new Set(existingLocations.map((loc) => loc.id));
        const updatedIds = new Set();

        // Process locations
        for (const location of locations) {
            if (location.address && location.city && location.state && location.postal_code && location.country) {
                if (location.id && existingIds.has(location.id)) {
                    // Update existing location
                    const { error: updateLocError } = await supabase
                        .from('business_locations')
                        .update({
                            address: location.address,
                            city: location.city,
                            state: location.state,
                            postal_code: location.postal_code,
                            country: location.country,
                            is_primary: location.is_primary || false,
                            latitude: location.latitude || null,
                            longitude: location.longitude || null
                        })
                        .eq('id', location.id)
                        .eq('business_id', id);

                    if (updateLocError) throw updateLocError;
                    updatedIds.add(location.id);
                } else {
                    // Insert new location
                    const { error: insertLocError } = await supabase
                        .from('business_locations')
                        .insert({
                            business_id: id,
                            address: location.address,
                            city: location.city,
                            state: location.state,
                            postal_code: location.postal_code,
                            country: location.country,
                            is_primary: location.is_primary || false,
                            latitude: location.latitude || null,
                            longitude: location.longitude || null
                        });

                    if (insertLocError) throw insertLocError;
                }
            }
        }

        // Delete locations that weren't included in the update
        const locationsToDelete = existingLocations
            .filter(loc => !updatedIds.has(loc.id))
            .map(loc => loc.id);

        if (locationsToDelete.length > 0) {
            const { error: deleteLocError } = await supabase
                .from('business_locations')
                .delete()
                .eq('business_id', id)
                .in('id', locationsToDelete);

            if (deleteLocError) throw deleteLocError;
        }

        return NextResponse.json({ id, message: 'Business updated successfully' });
    } catch (error) {
        console.error('Error updating business:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}

// DELETE - Delete a business
export async function DELETE(request, props) {
    const params = await props.params;
    try {
        const session = await getServerSession(options);

        if (!session?.user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { id } = params;

        // Check if business exists and belongs to user
        const { data: existingBusiness, error: checkError } = await supabase
            .from('businesses')
            .select('id')
            .eq('id', id)
            .eq('user_id', session.user.id)
            .single();

        if (checkError) {
            if (checkError.code === 'PGRST116') {
                return NextResponse.json({ message: 'Business not found' }, { status: 404 });
            }
            throw checkError;
        }

        // Delete locations first (due to foreign key constraint)
        const { error: locationsError } = await supabase
            .from('business_locations')
            .delete()
            .eq('business_id', id);

        if (locationsError) throw locationsError;

        // Delete business
        const { error: businessError } = await supabase
            .from('businesses')
            .delete()
            .eq('id', id)
            .eq('user_id', session.user.id);

        if (businessError) throw businessError;

        return NextResponse.json({ message: 'Business deleted successfully' });
    } catch (error) {
        console.error('Error deleting business:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}