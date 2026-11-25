import Link from 'next/link';
import { isEditor } from '@/lib/db/queries';
import { getSession } from '@/lib/session';
import { Button } from './ui/button';
import { LogoutButton } from './logout-button';

export async function AuthButton() {
  const session = await getSession();
  const editor = session ? await isEditor() : false;

  return session ? (
    <div className="flex items-center gap-4">
      {editor && (
        <Link
          href="/admin"
          className="underline underline-offset-4 whitespace-nowrap"
          style={{ color: '#1d4ed8' }}
        >
          Admin
        </Link>
      )}
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
