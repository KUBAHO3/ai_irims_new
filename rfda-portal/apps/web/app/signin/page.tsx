'use client';
import { Suspense } from 'react';
import { PublicHeader, SignInForm } from '@/components/public';

export default function SignInPage() {
  return (
    <>
      <PublicHeader />
      <main className="public-main" style={{ maxWidth: 520 }}><div className="panel auth-card"><Suspense><SignInForm /></Suspense></div></main>
    </>
  );
}
