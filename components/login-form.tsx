'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

const CALLBACK_URL = '/';
// BetterAuth appends ?error=<code> here when an OAuth flow fails.
const ERROR_URL = '/login';

// One screen at a time. Email codes are the default; password, sign-up and
// reset are reached from links under the form.
type View =
  | { kind: 'code-email' }
  | { kind: 'code-otp'; email: string }
  | { kind: 'password' }
  | { kind: 'signup' }
  | { kind: 'verify'; email: string }
  | { kind: 'forgot' }
  | { kind: 'reset'; email: string };

const TITLE: Record<View['kind'], string> = {
  'code-email': 'Sign in',
  'code-otp': 'Enter your code',
  password: 'Sign in with password',
  signup: 'Create an account',
  verify: 'Verify your email',
  forgot: 'Reset your password',
  reset: 'Choose a new password',
};

type Result = { error: { message?: string; code?: string } | null };

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>({ kind: 'code-email' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() => {
    const code = searchParams.get('error');
    return code ? `Sign-in failed (${code.replaceAll('_', ' ')}).` : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  const go = (next: View, message: string | null = null) => {
    setView(next);
    setOtp('');
    setError(null);
    setNotice(message);
  };

  const done = () => {
    router.push(CALLBACK_URL);
    router.refresh();
  };

  // Runs one auth call with loading/error handling; returns true on success.
  const attempt = async (call: () => Promise<Result>) => {
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await call();
      if (error) {
        setError(error.message ?? 'Something went wrong');
        return { ok: false as const, code: error.code };
      }
      return { ok: true as const };
    } finally {
      setIsLoading(false);
    }
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await attempt(() =>
      authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' }),
    );
    if (r.ok)
      go({ kind: 'code-otp', email }, `We sent a 6-digit code to ${email}.`);
  };

  const signInWithCode = async (e: React.FormEvent, to: string) => {
    e.preventDefault();
    const r = await attempt(() =>
      authClient.signIn.emailOtp({ email: to, otp: otp.trim() }),
    );
    if (r.ok) done();
  };

  const sendVerification = async (to: string) => {
    const r = await attempt(() =>
      authClient.emailOtp.sendVerificationOtp({
        email: to,
        type: 'email-verification',
      }),
    );
    if (r.ok)
      go({ kind: 'verify', email: to }, `We sent a 6-digit code to ${to}.`);
  };

  const signInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await attempt(() =>
      authClient.signIn.email({ email, password, callbackURL: CALLBACK_URL }),
    );
    if (r.ok) done();
    else if (r.code === 'EMAIL_NOT_VERIFIED') await sendVerification(email);
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    // The server emails a verification code on sign-up (sendVerificationOnSignUp).
    const r = await attempt(() =>
      authClient.signUp.email({ name, email, password }),
    );
    if (r.ok)
      go({ kind: 'verify', email }, `We sent a 6-digit code to ${email}.`);
  };

  const verify = async (e: React.FormEvent, to: string) => {
    e.preventDefault();
    const r = await attempt(() =>
      authClient.emailOtp.verifyEmail({ email: to, otp: otp.trim() }),
    );
    if (r.ok) done(); // autoSignInAfterVerification creates the session
  };

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await attempt(() =>
      authClient.emailOtp.requestPasswordReset({ email }),
    );
    // Same message whether or not the email has an account.
    if (r.ok)
      go(
        { kind: 'reset', email },
        `If ${email} has an account, a 6-digit code is on its way.`,
      );
  };

  const resetPassword = async (e: React.FormEvent, to: string) => {
    e.preventDefault();
    const r = await attempt(() =>
      authClient.emailOtp.resetPassword({
        email: to,
        otp: otp.trim(),
        password,
      }),
    );
    if (r.ok) {
      setPassword('');
      go({ kind: 'password' }, 'Password updated. Sign in with it below.');
    }
  };

  const signInWithPasskey = async () => {
    const r = await attempt(() => authClient.signIn.passkey());
    if (r.ok) done();
  };

  // Leaves the site for the provider; only a failure to start lands back here.
  const signInWithSocial = async (provider: 'google' | 'facebook') => {
    setIsLoading(true);
    setError(null);
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: CALLBACK_URL,
      errorCallbackURL: ERROR_URL,
    });
    if (error) {
      setError(error.message ?? 'Could not start sign-in');
      setIsLoading(false);
    }
  };

  const emailField = (
    <Field id="email" label="Email">
      <Input
        id="email"
        type="email"
        autoComplete="username webauthn"
        placeholder="you@example.org"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
    </Field>
  );

  const passwordField = (autoComplete: string, label = 'Password') => (
    <Field id="password" label={label}>
      <Input
        id="password"
        type="password"
        autoComplete={autoComplete}
        minLength={8}
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
    </Field>
  );

  const codeField = (
    <Field id="otp" label="6-digit code">
      <Input
        id="otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
      />
    </Field>
  );

  const submit = (label: string, busy: string) => (
    <Button type="submit" className="w-full" disabled={isLoading}>
      {isLoading ? busy : label}
    </Button>
  );

  const link = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="text-sm underline underline-offset-4"
      style={{ color: '#1d4ed8' }}
    >
      {label}
    </button>
  );

  let body: React.ReactNode;
  switch (view.kind) {
    case 'code-email':
      body = (
        <form onSubmit={sendCode} className="flex flex-col gap-4">
          {emailField}
          {submit('Email me a code', 'Sending…')}
        </form>
      );
      break;
    case 'code-otp':
      body = (
        <form
          onSubmit={(e) => signInWithCode(e, view.email)}
          className="flex flex-col gap-4"
        >
          {codeField}
          {submit('Sign in', 'Signing in…')}
          {link('Use a different email', () => go({ kind: 'code-email' }))}
        </form>
      );
      break;
    case 'password':
      body = (
        <form onSubmit={signInWithPassword} className="flex flex-col gap-4">
          {emailField}
          {passwordField('current-password')}
          {submit('Sign in', 'Signing in…')}
          {link('Forgot your password?', () => go({ kind: 'forgot' }))}
        </form>
      );
      break;
    case 'signup':
      body = (
        <form onSubmit={signUp} className="flex flex-col gap-4">
          <Field id="name" label="Name">
            <Input
              id="name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          {emailField}
          {passwordField('new-password', 'Password (8+ characters)')}
          {submit('Create account', 'Creating…')}
        </form>
      );
      break;
    case 'verify':
      body = (
        <form
          onSubmit={(e) => verify(e, view.email)}
          className="flex flex-col gap-4"
        >
          {codeField}
          {submit('Verify', 'Verifying…')}
          {link('Send a new code', () => sendVerification(view.email))}
        </form>
      );
      break;
    case 'forgot':
      body = (
        <form onSubmit={requestReset} className="flex flex-col gap-4">
          {emailField}
          {submit('Email me a code', 'Sending…')}
        </form>
      );
      break;
    case 'reset':
      body = (
        <form
          onSubmit={(e) => resetPassword(e, view.email)}
          className="flex flex-col gap-4"
        >
          {codeField}
          {passwordField('new-password', 'New password (8+ characters)')}
          {submit('Set password', 'Saving…')}
        </form>
      );
      break;
  }

  const onCodeScreens = view.kind === 'code-email' || view.kind === 'code-otp';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{TITLE[view.kind]}</CardTitle>
        <CardDescription>
          {notice ??
            (onCodeScreens
              ? 'We’ll email you a one-time code. No password needed — new here? This creates your account.'
              : null)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6">
          {body}
          {error && (
            <p role="alert" className="text-sm font-medium">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isLoading}
              onClick={signInWithPasskey}
            >
              Sign in with a passkey
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isLoading}
              onClick={() => signInWithSocial('google')}
            >
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isLoading}
              onClick={() => signInWithSocial('facebook')}
            >
              Continue with Facebook
            </Button>
          </div>

          <nav
            aria-label="Other ways to sign in"
            className="flex flex-col items-center gap-2"
          >
            {!onCodeScreens &&
              link('Sign in with an email code', () =>
                go({ kind: 'code-email' }),
              )}
            {view.kind !== 'password' &&
              link('Sign in with a password', () => go({ kind: 'password' }))}
            {view.kind !== 'signup' &&
              link('Create an account with a password', () =>
                go({ kind: 'signup' }),
              )}
          </nav>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
