import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { getToken } from 'next-auth/jwt'

// Define paths that should be accessible without authentication
const publicPaths = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/api',
    '/_next',
    '/favicon.ico',
    '/static',
    '/images',
    '/auth',
    '/manifest.json',
    '/sw.js',
    '/workbox-',
    '/icons',
    '/businesses',
]

// Helper function to check if the current path is public
function isPublicPath(path) {
    return publicPaths.some(publicPath => {
        return path === publicPath || path.startsWith(`${publicPath}/`)
    })
}

export async function middleware(request) {
    const path = request.nextUrl.pathname

    // ─────────────────────────────────────────
    // SUPERADMIN PROTECTION — runs first
    // ─────────────────────────────────────────
    if (path.startsWith('/superadmin/dashboard')) {
        const token = request.cookies.get('superadmin_token')?.value

        // No token → redirect to superadmin login
        if (!token) {
            return NextResponse.redirect(new URL('/superadmin/login', request.url))
        }

        try {
            const secret = new TextEncoder().encode(process.env.SUPERADMIN_JWT_SECRET)
            const { payload } = await jwtVerify(token, secret)

            if (payload.role !== 'superadmin') {
                return NextResponse.redirect(new URL('/superadmin/login', request.url))
            }

            // Valid superadmin session — let through
            return NextResponse.next()

        } catch (error) {
            // Expired or tampered token
            return NextResponse.redirect(new URL('/superadmin/login', request.url))
        }
    }

    // Allow superadmin login page through freely
    if (path.startsWith('/superadmin/login')) {
        return NextResponse.next()
    }

    // ─────────────────────────────────────────
    // VENDOR DASHBOARD ROLE ENFORCEMENT
    // ─────────────────────────────────────────
    if (path.startsWith('/business/dashboard')) {
        const token = await getToken({
            req: request,
            secret: process.env.NEXTAUTH_SECRET,
            secureCookie: process.env.NODE_ENV === 'production'
        });

        // Unauthenticated -> redirect to signin
        if (!token) {
            const loginUrl = new URL('/auth/signin', request.url);
            loginUrl.searchParams.set('callbackUrl', request.url);
            return NextResponse.redirect(loginUrl);
        }

        const roles = Array.isArray(token.roles) ? token.roles : [];
        if (!roles.includes('app_business_owner') && !roles.includes('superadmin')) {
            // Customer without vendor role -> redirect to business registration
            return NextResponse.redirect(new URL('/u/profile/apply-for-business', request.url));
        }
    }

    // ─────────────────────────────────────────
    // YOUR EXISTING AUTH LOGIC — unchanged
    // ─────────────────────────────────────────

    // Skip authentication check for public paths
    if (isPublicPath(path)) {
        return NextResponse.next()
    }

    // Check for authentication tokens in cookies
    const authToken = request.cookies.get('auth-token')?.value

    // Check both the regular and __Secure- prefixed session tokens
    const sessionToken =
        request.cookies.get('next-auth.session-token')?.value ||
        request.cookies.get('__Secure-next-auth.session-token')?.value

    // If no auth token found, redirect to login
    if (!authToken && !sessionToken) {
        const loginUrl = new URL('/auth/signin', request.url)
        loginUrl.searchParams.set('callbackUrl', request.url)
        return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
}

// Configure which paths the middleware runs on
export const config = {
    matcher: [
        '/((?!api/auth|_next/static|_next/image|_next/webpack|favicon.ico|manifest.json|sw.js|icons|workbox-).*)',
    ],
}