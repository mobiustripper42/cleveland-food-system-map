import { passkeyClient } from '@better-auth/passkey/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// Same-origin: the API lives at /api/auth on whatever host serves the app.
export const authClient = createAuthClient({
  plugins: [emailOTPClient(), passkeyClient()],
});
