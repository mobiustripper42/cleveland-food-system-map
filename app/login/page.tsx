import { LoginForm } from '@/components/login-form';
import { Suspense } from 'react';

export const metadata = { title: 'Sign in', robots: { index: false } };

export default function LoginPage() {
  return (
    <div className="flex w-full flex-1 items-start justify-center p-4 sm:items-center md:p-10">
      <div className="w-full max-w-sm">
        {/* useSearchParams (for ?error) needs a Suspense boundary. */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
