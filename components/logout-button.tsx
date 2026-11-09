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

  return <Button onClick={logout}>Logout</Button>;
}
