'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

/**
 * /verify page
 *
 * Accessible to logged-out users (listed in middleware publicPaths).
 * On mount it calls /api/verify-email?token=<rawToken> and renders
 * one of five states:
 *   loading  – while the verification API request is in-flight
 *   ok       – account activated; prompt user to sign in
 *   expired  – link expired; clear guidance & inline resend form
 *   used     – link already consumed; direct to sign in
 *   invalid  – token missing / malformed / not found; inline resend form
 *   error    – unexpected server error; retry / resend options
 */
export default function VerifyPage() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [state, setState] = useState('loading'); // 'loading'|'ok'|'expired'|'used'|'invalid'|'error'

    // Resend state
    const [resendEmail, setResendEmail] = useState('');
    const [resendStatus, setResendStatus] = useState('idle'); // 'idle'|'loading'|'success'|'error'
    const [resendMessage, setResendMessage] = useState('');

    useEffect(() => {
        // If no token param at all, skip the API call
        if (!token) {
            setState('invalid');
            return;
        }

        let cancelled = false;

        async function verify() {
            try {
                const res = await fetch(`/api/verify-email?token=${encodeURIComponent(token)}`);
                if (cancelled) return;
                const data = await res.json();
                setState(data.status ?? 'error');
            } catch {
                if (!cancelled) setState('error');
            }
        }

        verify();
        return () => { cancelled = true; };
    }, [token]);

    const handleResend = async (e) => {
        e?.preventDefault();
        const emailTrimmed = resendEmail.trim();
        if (!emailTrimmed || !emailTrimmed.includes('@')) {
            setResendStatus('error');
            setResendMessage('Please enter a valid email address.');
            return;
        }

        setResendStatus('loading');
        setResendMessage('');

        try {
            const res = await fetch('/api/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailTrimmed }),
            });
            const data = await res.json();
            if (data.success) {
                setResendStatus('success');
                setResendMessage(
                    data.message || 'If your email is registered, a new verification link has been sent to your inbox.'
                );
            } else {
                setResendStatus('error');
                setResendMessage(data.message || 'Failed to send verification link.');
            }
        } catch {
            setResendStatus('error');
            setResendMessage('Network error. Please try again.');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
            <div className="w-full max-w-md">

                {/* Header */}
                <div className="mb-8 text-center">
                    <h1 className="text-4xl font-black mb-2 uppercase tracking-tight">LocalGrow</h1>
                    <p className="text-xl font-bold text-gray-800">Email Verification</p>
                </div>

                <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0)] p-8">

                    {/* ── Loading ── */}
                    {state === 'loading' && (
                        <div className="text-center">
                            <div className="inline-block w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="font-bold text-lg">Verifying your account…</p>
                        </div>
                    )}

                    {/* ── Success ── */}
                    {state === 'ok' && (
                        <div className="text-center">
                            <div className="text-5xl mb-4">✅</div>
                            <h2 className="text-2xl font-black uppercase mb-2">Email Verified!</h2>
                            <p className="font-medium text-gray-700 mb-6">
                                Your account has been activated. You can now sign in to start exploring local offers.
                            </p>
                            <Link
                                href="/auth/signin"
                                className="inline-block bg-black text-white font-bold py-3 px-6 border-4 border-black uppercase hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] transition-all duration-200"
                            >
                                Sign In
                            </Link>
                        </div>
                    )}

                    {/* ── Expired ── */}
                    {state === 'expired' && (
                        <div className="text-center">
                            <div className="text-5xl mb-4">⏰</div>
                            <h2 className="text-2xl font-black uppercase mb-2">Link Expired</h2>
                            <p className="font-medium text-gray-700 mb-4 text-sm">
                                For security, verification links expire 24 hours after they are requested. Enter your email below to receive a new link.
                            </p>

                            <ResendForm
                                email={resendEmail}
                                setEmail={setResendEmail}
                                status={resendStatus}
                                message={resendMessage}
                                onSubmit={handleResend}
                            />

                            <div className="mt-6 pt-4 border-t-2 border-gray-200">
                                <Link
                                    href="/auth/signin"
                                    className="text-sm font-bold text-gray-800 underline hover:no-underline"
                                >
                                    Already verified? Back to Sign In
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* ── Already used ── */}
                    {state === 'used' && (
                        <div className="text-center">
                            <div className="text-5xl mb-4">🔁</div>
                            <h2 className="text-2xl font-black uppercase mb-2">Already Verified</h2>
                            <p className="font-medium text-gray-700 mb-6 text-sm">
                                This verification link was already used. If you have already confirmed your email, you can sign in directly.
                            </p>
                            <Link
                                href="/auth/signin"
                                className="inline-block bg-black text-white font-bold py-3 px-6 border-4 border-black uppercase hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] transition-all duration-200"
                            >
                                Go to Sign In
                            </Link>

                            <div className="mt-6 pt-4 border-t-2 border-gray-200">
                                <ResendForm
                                    email={resendEmail}
                                    setEmail={setResendEmail}
                                    status={resendStatus}
                                    message={resendMessage}
                                    onSubmit={handleResend}
                                />
                            </div>
                        </div>
                    )}

                    {/* ── Invalid ── */}
                    {state === 'invalid' && (
                        <div className="text-center">
                            <div className="text-5xl mb-4">❌</div>
                            <h2 className="text-2xl font-black uppercase mb-2">Invalid Link</h2>
                            <p className="font-medium text-gray-700 mb-4 text-sm">
                                This verification link is invalid, corrupted, or was generated under an earlier format. Enter your registered email to get a fresh link.
                            </p>

                            <ResendForm
                                email={resendEmail}
                                setEmail={setResendEmail}
                                status={resendStatus}
                                message={resendMessage}
                                onSubmit={handleResend}
                            />

                            <div className="mt-6 pt-4 border-t-2 border-gray-200">
                                <Link
                                    href="/auth/signin"
                                    className="text-sm font-bold text-gray-800 underline hover:no-underline"
                                >
                                    Back to Sign In
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* ── Server error ── */}
                    {state === 'error' && (
                        <div className="text-center">
                            <div className="text-5xl mb-4">⚠️</div>
                            <h2 className="text-2xl font-black uppercase mb-2">Something Went Wrong</h2>
                            <p className="font-medium text-gray-700 mb-4 text-sm">
                                We couldn't process your verification request. Please request a new link below or try again later.
                            </p>

                            <ResendForm
                                email={resendEmail}
                                setEmail={setResendEmail}
                                status={resendStatus}
                                message={resendMessage}
                                onSubmit={handleResend}
                            />

                            <div className="mt-6 pt-4 border-t-2 border-gray-200">
                                <Link
                                    href="/auth/signin"
                                    className="text-sm font-bold text-gray-800 underline hover:no-underline"
                                >
                                    Back to Sign In
                                </Link>
                            </div>
                        </div>
                    )}

                </div>

                <div className="mt-8 text-center text-sm font-bold">
                    <p>© {new Date().getFullYear()} LocalGrow. All rights reserved.</p>
                </div>

            </div>
        </div>
    );
}

function ResendForm({ email, setEmail, status, message, onSubmit }) {
    return (
        <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300 text-left">
            <h3 className="font-bold text-sm uppercase text-gray-900 mb-1">
                Resend Verification Link
            </h3>
            <p className="text-xs text-gray-600 mb-3">
                Enter your account email to receive a new link:
            </p>

            {status === 'success' ? (
                <div className="p-3 bg-green-50 border-2 border-black text-green-900 text-xs font-bold">
                    ✅ {message}
                </div>
            ) : (
                <form onSubmit={onSubmit} className="space-y-3">
                    {status === 'error' && (
                        <div className="p-2 bg-red-50 border-2 border-black text-red-800 text-xs font-bold">
                            ⚠️ {message}
                        </div>
                    )}
                    <div>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full p-2.5 text-sm border-2 border-black font-medium focus:outline-none bg-white placeholder-gray-400"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={status === 'loading'}
                        className="w-full bg-black text-white text-xs font-bold py-2.5 px-4 border-2 border-black uppercase hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] transition-all duration-150 disabled:opacity-60"
                    >
                        {status === 'loading' ? 'Sending Link…' : 'Send New Verification Link'}
                    </button>
                </form>
            )}
        </div>
    );
}
