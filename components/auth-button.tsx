import Link from 'next/link';
import { getSession } from '@/lib/session';
import { Button } from './ui/button';
import { LogoutButton } from './logout-button';

export async function AuthButton() {
  const session = await getSession();

  return session ? (
    <div className="flex items-center gap-4">
      <Link
        href="/account"
        className="underline underline-offset-4 truncate max-w-[12rem]"
        style={{ color: '#1d4ed8' }}
      >
        <span className="hidden sm:inline">{session.user.email}</span>
        <span className="sm:hidden">Account</span>
      </Link>
      <LogoutButton />
    </div>
  ) : (
    <Button asChild size="sm" variant="outline">
      <Link href="/login">Sign in</Link>
    </Button>
  );
}
