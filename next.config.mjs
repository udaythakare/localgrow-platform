/** @type {import('next').NextConfig} */
import withSerwist from '@serwist/next';

const nextConfig = {
    turbopack: {},
    images: {
        formats: ['image/avif', 'image/webp'],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'tse3.mm.bing.net',
                pathname: '/th/**',
            },
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
                pathname: '**',
            },
        ],
    },
    experimental: {
        optimizePackageImports: [
            'react-icons',
            'lucide-react',
            'date-fns',
            'recharts',
            'framer-motion',
        ],
        staleTimes: {
            dynamic: 30,
            static: 180,
        },
    },
    async headers() {
        return [
            {
                // Security headers applied to every response
                source: '/:path*',
                headers: [
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on',
                    },
                    {
                        // Prevent the page from being framed (clickjacking)
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        // Prevent MIME-type sniffing
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        // Limit referrer information to same-origin
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        // HSTS — force HTTPS for 1 year (only applies over TLS)
                        key: 'Strict-Transport-Security',
                        value: 'max-age=31536000; includeSubDomains',
                    },
                    {
                        // Belt-and-suspenders XSS filter for legacy browsers
                        key: 'X-XSS-Protection',
                        value: '1; mode=block',
                    },
                    {
                        // Restrict powerful browser APIs
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), payment=(), usb=()',
                    },
                ],
            },
            {
                source: '/icons/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable',
                    },
                ],
            },
        ];
    },

    async rewrites() {
        return [
            {
                source: '/api/v2/:path*',
                destination: `${process.env.SPRING_BOOT_URL || 'http://localhost:8080'}/api/v2/:path*`,
            },
        ];
    },
};

const config = withSerwist({
    swSrc: 'app/sw.js',
    swDest: 'public/sw.js',
    disable: process.env.NODE_ENV === 'development',
})(nextConfig);

export default config;