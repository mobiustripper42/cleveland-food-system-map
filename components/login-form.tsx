'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FormStatus } from '@/components/ui/field-error';
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
  signup: 'Create a password account',
  verify: 'Verify your email',
  forgot: 'Reset your password',
  reset: 'Choose a new password',
};

/** Screens where the user is typing an emailed code: nothing else competes. */
const CODE_ENTRY: View['kind'][] = ['code-otp', 'verify', 'reset'];

/** OAuth `?error=` codes → what happened and what to do. */
function oauthErrorMessage(code: string) {
  const known: Record<string, string> = {
    access_denied: 'Sign-in was cancelled. Try again, or use an email code.',
    account_not_linked:
      'That email already has an account here. Sign in with an email code instead — Google links automatically once the email is verified.',
    email_not_found:
      'The provider didn’t share an email address. Use an email code instead.',
    state_mismatch: 'Sign-in timed out. Please try again.',
  };
  return (
    known[code] ??
    'Sign-in with that provider didn’t work. Try again, or use an email code.'
  );
}

type Result = { error: { message?: string; code?: string } | null };

/** Which action is in flight, so only that button says it's busy. */
type Busy = 'submit' | 'resend' | 'passkey' | 'google' | 'facebook' | null;

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
    return code ? oauthErrorMessage(code) : null;
  });
  const [busy, setBusy] = useState<Busy>(null);
  const isLoading = busy !== null;

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
  const attempt = async (
    call: () => Promise<Result>,
    which: Busy = 'submit',
  ) => {
    setBusy(which);
    setError(null);
    try {
      const { error } = await call();
      if (error) {
        setError(error.message ?? 'Something went wrong. Please try again.');
        return { ok: false as const, code: error.code };
      }
      return { ok: true as const };
    } finally {
      setBusy(null);
    }
  };

  const sendSignInCode = async (to: string, which: Busy = 'submit') => {
    const r = await attempt(
      () =>
        authClient.emailOtp.sendVerificationOtp({ email: to, type: 'sign-in' }),
      which,
    );
    if (r.ok)
      go({ kind: 'code-otp', email: to }, `We sent a 6-digit code to ${to}.`);
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendSignInCode(email);
  };

  const signInWithCode = async (e: React.FormEvent, to: string) => {
    e.preventDefault();
    const r = await attempt(() =>
      authClient.signIn.emailOtp({ email: to, otp }),
    );
    if (r.ok) done();
  };

  const sendVerification = async (to: string, which: Busy = 'submit') => {
    const r = await attempt(
      () =>
        authClient.emailOtp.sendVerificationOtp({
          email: to,
          type: 'email-verification',
        }),
      which,
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
      authClient.emailOtp.verifyEmail({ email: to, otp }),
    );
    if (r.ok) done(); // autoSignInAfterVerification creates the session
  };

  const sendReset = async (to: string, which: Busy = 'submit') => {
    const r = await attempt(
      () => authClient.emailOtp.requestPasswordReset({ email: to }),
      which,
    );
    // Same message whether or not the email has an account.
    if (r.ok)
      go(
        { kind: 'reset', email: to },
        `If ${to} has an account, a 6-digit code is on its way.`,
      );
  };

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendReset(email);
  };

  const resetPassword = async (e: React.FormEvent, to: string) => {
    e.preventDefault();
    const r = await attempt(() =>
      authClient.emailOtp.resetPassword({ email: to, otp, password }),
    );
    if (r.ok) {
      setPassword('');
      go({ kind: 'password' }, 'Password updated. Sign in with it below.');
    }
  };

  const signInWithPasskey = async () => {
    const r = await attempt(() => authClient.signIn.passkey(), 'passkey');
    if (r.ok) done();
  };

  // Leaves the site for the provider; only a failure to start lands back here.
  const signInWithSocial = async (provider: 'google' | 'facebook') => {
    setBusy(provider);
    setError(null);
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: CALLBACK_URL,
      errorCallbackURL: ERROR_URL,
    });
    if (error) {
      setError(error.message ?? 'Could not start sign-in. Please try again.');
      setBusy(null);
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
        // Focus lands here when the code screen opens.
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        required
        // Digits only, so a pasted "123 456" or "123-456" still works (no
        // maxLength: it would cut the paste before the cleanup).
        value={otp}
        onChange={(e) => {
          e.currentTarget.setCustomValidity('');
          setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
        }}
        onInvalid={(e) =>
          e.currentTarget.setCustomValidity(
            'Enter the 6 digits from the email.',
          )
        }
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'login-error' : undefined}
        className="tracking-[0.3em] tabular-nums"
      />
    </Field>
  );

  const submit = (label: string, busyLabel: string) => (
    <Button type="submit" className="w-full" disabled={isLoading}>
      {busy === 'submit' ? busyLabel : label}
    </Button>
  );

  const link = (label: string, onClick: () => void, disabled = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="link inline-flex min-h-11 cursor-pointer items-center text-sm disabled:cursor-wait disabled:opacity-50"
    >
      {label}
    </button>
  );

  const resend = (send: () => void) =>
    link(busy === 'resend' ? 'Sending…' : 'Send a new code', send, isLoading);

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
          <div className="flex flex-wrap justify-between gap-x-4">
            {resend(() => sendSignInCode(view.email, 'resend'))}
            {link('Use a different email', () => go({ kind: 'code-email' }))}
          </div>
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
          {resend(() => sendVerification(view.email, 'resend'))}
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
          {resend(() => sendReset(view.email, 'resend'))}
        </form>
      );
      break;
  }

  const onCodeScreens = view.kind === 'code-email' || view.kind === 'code-otp';
  const enteringCode = CODE_ENTRY.includes(view.kind);

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">
          {TITLE[view.kind]}
        </h1>
        {/* Always mounted: "We sent a code…" is announced on change. */}
        <p role="status" className="text-sm text-muted-foreground">
          {notice ??
            (onCodeScreens
              ? 'We’ll email you a one-time code — no password needed. New here? The same code creates your account.'
              : null)}
        </p>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="flex flex-col gap-6">
          {body}
          <FormStatus id="login-error" tone="error">
            {error}
          </FormStatus>

          {/* Hidden while typing a code: one task per screen. */}
          {!enteringCode && (
            <>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="h-px flex-1 bg-border" aria-hidden />
                or
                <span className="h-px flex-1 bg-border" aria-hidden />
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isLoading}
                  onClick={signInWithPasskey}
                >
                  {busy === 'passkey'
                    ? 'Waiting for passkey…'
                    : 'Sign in with a passkey'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isLoading}
                  onClick={() => signInWithSocial('google')}
                >
                  {busy === 'google'
                    ? 'Opening Google…'
                    : 'Continue with Google'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isLoading}
                  onClick={() => signInWithSocial('facebook')}
                >
                  {busy === 'facebook'
                    ? 'Opening Facebook…'
                    : 'Continue with Facebook'}
                </Button>
              </div>

              <nav
                aria-label="Other ways to sign in"
                className="flex flex-col items-center"
              >
                {!onCodeScreens &&
                  link('Sign in with an email code', () =>
                    go({ kind: 'code-email' }),
                  )}
                {view.kind !== 'password' &&
                  link('Sign in with a password', () =>
                    go({ kind: 'password' }),
                  )}
                {view.kind !== 'signup' &&
                  link('Prefer a password? Create a password account', () =>
                    go({ kind: 'signup' }),
                  )}
              </nav>
            </>
          )}
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
