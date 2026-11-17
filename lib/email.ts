import 'server-only';
import { Resend } from 'resend';

// Lazy: the build imports this module without RESEND_API_KEY set.
let resend: Resend | undefined;

export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
}) {
  resend ??= new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    ...message,
  });
  // Surface failures so BetterAuth returns an error instead of "code sent".
  if (error) throw new Error(`Email send failed: ${error.message}`);
}
