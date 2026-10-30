'use client';
import type { UserDto } from '@rfda/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api, errMsg } from '@/lib/api';
import { HelpdeskModal } from './modals';
import { ThemeToggle } from './ThemeToggle';
import { useModal, useToast } from './ui';

const DEMO_LOGIN = process.env.NEXT_PUBLIC_DEMO_LOGIN === 'true';
const DEMO = { applicant: ['40112', 'Applicant#2026'], assessor: ['assessor@rfda.example', 'Assessor#2026'] } as const;

export const homeFor = (u: UserDto) => (u.role === 'assessor' ? '/intray' : '/dashboard');

export function PublicHeader() {
  const openModal = useModal();
  return (
    <header className="public-top"><div className="inner">
      <Link className="brand" href="/"><span className="logo"><img src="/logo.png" alt="" /></span><span><strong>Rwanda FDA</strong><span>Regulatory services portal</span></span></Link>
      <span className="spacer" />
      <ThemeToggle />
      <button className="btn link" onClick={() => openModal((close) => <HelpdeskModal close={close} />)}>Help desk</button>
      <Link className="btn" href="/signin">Sign in</Link>
    </div></header>
  );
}

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ id?: string; pwd?: boolean }>({});
  const [busy, setBusy] = useState(false);

  const login = async (id: string, pwd: string) => {
    setBusy(true);
    try {
      const user = await api<UserDto>('/auth/login', { body: { identifier: id, password: pwd } });
      const next = params.get('next');
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : homeFor(user));
    } catch (e) {
      setErrors({ id: errMsg(e) });
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = { id: identifier.trim() ? undefined : 'Enter your customer number or email.', pwd: !password };
    setErrors(errs);
    if (!errs.id && !errs.pwd) login(identifier.trim(), password);
  };

  return (
    <>
      <h2>Sign in</h2><p className="muted small">Use your customer number or email address.</p>
      <form className="stack" style={{ marginTop: 16 }} noValidate onSubmit={submit}>
        <div className={`field ${errors.id ? 'invalid' : ''}`}><label htmlFor="cust">Customer number or email</label>
          <input id="cust" type="text" autoComplete="username" placeholder="e.g. 40112" value={identifier} onChange={(e) => setIdentifier(e.target.value)} /><span className="error">{errors.id}</span></div>
        <div className={`field ${errors.pwd ? 'invalid' : ''}`}><label htmlFor="pwd">Password</label>
          <input id="pwd" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /><span className="error">Enter your password.</span></div>
        <div className="row"><button className="btn primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <button type="button" className="btn link" onClick={() => toast('Contact the help desk to reset your password. Self-service reset is not available yet.')}>Forgot password?</button></div>
        <p className="small">New to the portal? <Link href="/register">Create an account</Link></p>
      </form>
      {DEMO_LOGIN && (
        <div className="demo-box"><p className="small muted" style={{ marginBottom: 10 }}>Demo accounts (seeded data)</p>
          <div className="row">
            <button className="btn" disabled={busy} onClick={() => login(...DEMO.applicant)}>Demo applicant</button>
            <button className="btn" disabled={busy} onClick={() => login(...DEMO.assessor)}>Demo assessor</button>
          </div></div>
      )}
    </>
  );
}
