import Link from 'next/link';
import { isEditor } from '@/lib/db/queries';
import { getSession } from '@/lib/session';
import { Button } from './ui/button';
import { LogoutButton } from './logout-button';

export async function AuthButton() {
  const session = await getSession();
  const editor = session ? await isEditor() : false;

  return session ? (
    <div className="flex min-w-0 items-center gap-x-4">
      {editor && (
        <Link
          href="/admin"
          className="link inline-flex min-h-11 items-center whitespace-nowrap"
        >
          Admin
        </Link>
      )}
      <Link
        href="/account"
        className="link inline-flex min-h-11 items-center min-w-0 max-w-[12rem]"
      >
        <span className="hidden truncate sm:inline">{session.user.email}</span>
        <span className="sm:hidden">Account</span>
      </Link>
      <LogoutButton />
    </div>
  ) : (
    <Button asChild variant="outline">
      <Link href="/login">Sign in</Link>
    </Button>
  );
}
