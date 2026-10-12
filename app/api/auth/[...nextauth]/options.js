import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import bcrypt from 'bcrypt';
import { logLogin } from '@/helpers/loginHelper';

// Helper function to create default user location
async function createDefaultUserLocation(userId) {
    const { error } = await supabaseAdmin
        .from('user_locations')
        .upsert({
            user_id: userId,
            is_primary: true,
            // All other fields remain null by default
        }, {
            onConflict: 'user_id'
        });

    if (error) {
        console.error('Error creating default user location:', error);
    }
}

export const options = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: "Email", type: "email", placeholder: "example@example.com" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                const { email, password } = credentials;

                // Fetch the user from supabaseAdmin based on the email
                const { data: user, error } = await supabaseAdmin
                    .from('users')
                    .select('*')
                    .eq('email', email)
                    .single();

                if (error || !user) {
                    await logLogin(null, 'failed', 'Invalid email or user not found');
                    throw new Error('Invalid email or user not found');
                }

                // Verify the password using bcrypt
                const isValidPassword = await bcrypt.compare(password, user.password);
                if (!isValidPassword) {
                    await logLogin(user.id, 'failed', 'Invalid password');
                    throw new Error('Invalid password');
                }

                // Enforce email verification for Credentials (password-based) accounts.
                // Google OAuth users are exempt — their identity is verified by Google.
                const { data: roleVerification } = await supabaseAdmin
                    .from('user_roles')
                    .select('is_verified')
                    .eq('user_id', user.id)
                    .single();

                if (!roleVerification?.is_verified) {
                    await logLogin(user.id, 'failed', 'Email not verified');
                    throw new Error('Please verify your email address before signing in. Check your inbox or request a new verification link.');
                }

                // Check if user location exists, if not create default
                const { data: userLocation, error: locationError } = await supabaseAdmin
                    .from('user_locations')
                    .select('id')
                    .eq('user_id', user.id)
                    .single();

                if (locationError || !userLocation) {
                    await createDefaultUserLocation(user.id);
                }

                // Get user roles from the user_roles table
                const { data: userRoles, error: rolesError } = await supabaseAdmin
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', user.id)
                    .eq('is_active', true);

                if (rolesError) {
                    console.error('Error fetching user roles:', rolesError);
                    await logLogin(user.id, 'failed', 'Error fetching user roles');
                    throw new Error('Error fetching user roles');
                }

                // Extract roles into an array
                const roles = userRoles.map(role => role.role);

                // Update last_login for users
                await supabaseAdmin
                    .from('users')
                    .update({ created_at: new Date().toISOString() })
                    .eq('id', user.id);

                // Log successful login
                await logLogin(user.id, 'success');

                // Return user data on successful login
                return {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    roles: roles,
                    mobile_number: user.mobile_number || "" // Add mobile_number here
                };
            }
        })
    ],

    secret: process.env.NEXTAUTH_SECRET,
    cookies: {
        sessionToken: {
            name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.session-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production'
            }
        },
        callbackUrl: {
            name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.callback-url`,
            options: {
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production'
            }
        },
        csrfToken: {
            name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.csrf-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production'
            }
        },
        pkceCodeVerifier: {
            name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.pkce.code_verifier`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production'
            }
        },
        state: {
            name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.state`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production'
            }
        },
        nonce: {
            name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.nonce`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production'
            }
        }
    },

    callbacks: {
        async signIn({ user, account, profile }) {
            if (account.provider === 'google') {
                try {
                    // Check if the email exists in users table
                    const { data: existingUser, error: userError } = await supabaseAdmin
                        .from('users')
                        .select('*')
                        .eq('email', user.email)
                        .single();

                    let dbUserId;

                    if (existingUser) {
                        // User exists, update last login time
                        await supabaseAdmin
                            .from('users')
                            .update({ created_at: new Date().toISOString() })
                            .eq('id', existingUser.id);

                        await logLogin(existingUser.id, 'success');
                        dbUserId = existingUser.id;

                        // Update the NextAuth user object with our database ID
                        user.id = existingUser.id;
                        user.mobile_number = existingUser.mobile_number || ""; // Ensure mobile_number is added
                    } else {
                        // If not found, create a new user
                        // Generate a unique username from email
                        const usernameBase = user.email.split('@')[0];
                        const timestamp = Date.now().toString().substring(8);
                        const username = `${usernameBase}_${timestamp}`;

                        // Insert the new user
                        const { data: newUser, error: createError } = await supabaseAdmin
                            .from('users')
                            .insert([{
                                email: user.email,
                                username: username,
                                password: '', // OAuth users don't need passwords
                                created_at: new Date().toISOString(),
                                mobile_number: "" // Initialize with empty mobile number
                            }])
                            .select('*')
                            .single();

                        if (createError) {
                            await logLogin(null, 'failed', `Google sign-in error: ${createError.message}`);
                            throw createError;
                        }

                        // Assign default role to the new user (e.g., 'app_user')
                        const { error: roleError } = await supabaseAdmin
                            .from('user_roles')
                            .insert([{
                                user_id: newUser.id,
                                role: 'app_user',
                                is_active: true
                            }]);

                        if (roleError) {
                            console.error('Error assigning role:', roleError);
                        }

                        await logLogin(newUser.id, 'success');
                        dbUserId = newUser.id;

                        // Update the NextAuth user object with our database ID
                        user.id = newUser.id;
                        user.mobile_number = ""; // Set default empty mobile number
                    }

                    // Check if user location exists, if not create default
                    const { data: userLocation, error: locationError } = await supabaseAdmin
                        .from('user_locations')
                        .select('id')
                        .eq('user_id', dbUserId)
                        .single();

                    if (locationError || !userLocation) {
                        await createDefaultUserLocation(dbUserId);
                    }

                    // Get user roles from the database
                    const { data: userRoles, error: rolesError } = await supabaseAdmin
                        .from('user_roles')
                        .select('role')
                        .eq('user_id', dbUserId)
                        .eq('is_active', true);

                    if (!rolesError && userRoles) {
                        // Add roles to user object
                        user.roles = userRoles.map(role => role.role);
                        user.username = existingUser?.username || user.email.split('@')[0];
                    }

                    return true;
                } catch (error) {
                    console.error('Google sign-in error:', error);
                    await logLogin(null, 'failed', `Google sign-in error: ${error.message}`);
                    return false;
                }
            }
            return true;
        },

        async jwt({ token, user, account, profile }) {
            if (user) {
                token.id = user.id;
                token.username = user.username;
                token.roles = user.roles || [];
                token.mobile_number = user.mobile_number || ""; // Add mobile_number to token

                if (account) {
                    token.provider = account.provider;
                }
            }
            return token;
        },

        async session({ session, token }) {
            if (session?.user) {
                session.user.id = token.id;
                session.user.username = token.username;
                session.user.roles = token.roles || [];
                session.user.provider = token.provider;
                session.user.mobile_number = token.mobile_number || ""; // Add mobile_number to session

                // Set primary role for backward compatibility
                session.user.primaryRole = session.user.roles.length > 0 ? session.user.roles[0] : null;
            }
            return session;
        }
    },

    pages: {
        signIn: '/api/auth/signin',
        error: '/api/auth/error',
    },
    debug: process.env.NODE_ENV !== 'production',
};