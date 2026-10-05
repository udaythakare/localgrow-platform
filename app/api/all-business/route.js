// app/api/businesses/route.js - API route for listing and creating businesses
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// import { auth } from '@/lib/auth';
import { options } from '../auth/[...nextauth]/options';
import { getServerSession } from 'next-auth';

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - List businesses
export async function GET(request) {
    try {
        // const session = await auth();
        const session = await getServerSession(options);

        if (!session?.user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Fetch businesses with their primary location
        const { data: businesses, error } = await supabase
            .from('businesses')
            .select(`
        id, 
        name, 
        description, 
        website, 
        phone, 
        email,
        latitude,
        longitude,
        business_locations!inner (
          city, 
          state,
          latitude,
          longitude
        )
      `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Format the response to match the expected structure
        const formattedBusinesses = businesses.map(business => ({
            id: business.id,
            name: business.name,
            description: business.description,
            website: business.website,
            phone: business.phone,
            email: business.email,
            city: business.business_locations[0]?.city,
            state: business.business_locations[0]?.state,
            latitude: business.business_locations[0]?.latitude || null,
            longitude: business.business_locations[0]?.longitude || null,
        }));

        console.log('Formatted Businesses:', formattedBusinesses);

        return NextResponse.json(formattedBusinesses);
    } catch (error) {
        console.error('Error fetching businesses:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST - Create new business
export async function POST(request) {
    try {
        // const session = await auth();
        const session = await getServerSession(options);

        if (!session?.user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
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

        // Insert business
        const { data: business, error: businessError } = await supabase
            .from('businesses')
            .insert({
                user_id: session.user.id,
                name,
                description: description || null,
                category_id: category_id || null,
                website: website || null,
                phone: phone || null,
                email: email || null
            })
            .select('id')
            .single();

        if (businessError) throw businessError;

        // Insert locations
        const locationsToInsert = locations
            .filter(location =>
                location.address &&
                location.city &&
                location.state &&
                location.postal_code &&
                location.country
            )
            .map(location => ({
                business_id: business.id,
                address: location.address,
                city: location.city,
                state: location.state,
                postal_code: location.postal_code,
                country: location.country,
                is_primary: location.is_primary || false,
                latitude: location.latitude || null,
                longitude: location.longitude || null
            }));

        if (locationsToInsert.length > 0) {
            const { error: locationsError } = await supabase
                .from('business_locations')
                .insert(locationsToInsert);

            if (locationsError) throw locationsError;
        }

        return NextResponse.json(
            { id: business.id, message: 'Business created successfully' },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating business:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}
