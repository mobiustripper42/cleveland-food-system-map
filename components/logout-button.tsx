'use client';

import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    await authClient.signOut();
    router.push('/');
    router.refresh(); // drop editor-only data rendered for the old session
  };

  // Outline: same weight as "Sign in"; signing out isn't the page's main action.
  return (
    <Button variant="outline" onClick={logout}>
      Log out
    </Button>
  );
}
