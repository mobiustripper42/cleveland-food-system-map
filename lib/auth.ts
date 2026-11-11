import 'server-only';
import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { db } from './db';
import * as authSchema from './db/auth-schema';
import { sendEmail } from './email';

const SITE_NAME = 'Cleveland Food System Map';
const baseURL = process.env.BETTER_AUTH_URL;

const OTP_SUBJECT = {
  'sign-in': 'Your sign-in code',
  'email-verification': 'Verify your email',
  'forget-password': 'Reset your password',
  'change-email': 'Confirm your new email',
} as const;

// Sign-up is open: email code, password, Google and Facebook all create
// accounts. Signed in != editor — write access and PII require a row in
// `editors` (npm run add-editor).
export const auth = betterAuth({
  appName: SITE_NAME,
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
  emailAndPassword: {
    enabled: true,
    // Verified by emailed code (emailOTP below), not a link. Password
    // sign-in is refused until then.
    requireEmailVerification: true,
  },
  // Entering the emailed code signs you in — no second step.
  emailVerification: { autoSignInAfterVerification: true },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    },
  },
  account: {
    // Google verifies emails, so a Google sign-in with an existing email
    // joins that user (and its editor row). Facebook emails aren't reliably
    // verified — no auto-linking for it.
    accountLinking: { enabled: true, trustedProviders: ['google'] },
  },
  plugins: [
    // Default sign-in. Also handles password-account verification and
    // password resets, so every emailed thing is a 6-digit code.
    emailOTP({
      overrideDefaultEmailVerification: true,
      sendVerificationOnSignUp: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        await sendEmail({
          to: email,
          subject: `${OTP_SUBJECT[type]} — ${SITE_NAME}`,
          text: `Your code is ${otp}\n\nIt expires in 5 minutes. If you didn't ask for it, ignore this email.`,
        });
      },
    }),
    passkey({
      rpName: SITE_NAME,
      // WebAuthn binds passkeys to the hostname: localhost in dev,
      // clevelandfoodsystem.land in production.
      rpID: baseURL ? new URL(baseURL).hostname : undefined,
      origin: baseURL ?? null,
    }),
    nextCookies(), // must be last
  ],
});
