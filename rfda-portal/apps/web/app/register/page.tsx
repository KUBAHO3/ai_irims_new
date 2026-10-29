'use client';
import { ACCOUNT_TYPES, type UserDto } from '@rfda/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { PublicHeader } from '@/components/public';
import { ModalFrame, useModal } from '@/components/ui';
import { api, errMsg } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const openModal = useModal();
  const [f, setF] = useState({ accountType: ACCOUNT_TYPES[0], name: '', tin: '', email: '', phone: '', address: '', password: '' });
  const [bad, setBad] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF({ ...f, [k]: e.target.value }); setBad({ ...bad, [k]: false }); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = { name: !f.name.trim(), email: !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim()), password: f.password.length < 10 };
    setBad(errs);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true); setError('');
    try {
      const user = await api<UserDto>('/auth/register', { body: { ...f, tin: f.tin || undefined, phone: f.phone || undefined, address: f.address || undefined } });
      openModal((close) => (
        <ModalFrame title="Account created" footer={<button className="btn primary" onClick={() => { close(); router.replace('/dashboard'); }}>Go to my dashboard</button>}>
          <p>Your customer number is <strong style={{ fontSize: 20 }}>{user.customerNo}</strong>.</p>
          <p className="muted" style={{ marginTop: 8 }}>Use it, or your email address, with your password to sign in.</p>
        </ModalFrame>
      ));
    } catch (err) { setError(errMsg(err)); setBusy(false); }
  };

  return (
    <>
      <PublicHeader />
      <main className="public-main" style={{ maxWidth: 520 }}><div className="panel auth-card">
        <h2>Create an account</h2><p className="muted small">You’ll receive a customer number to use on every application.</p>
        <form className="stack" style={{ marginTop: 16 }} noValidate onSubmit={submit}>
          <div className="field"><label htmlFor="acct" className="req">Account type</label><select id="acct" value={f.accountType} onChange={set('accountType')}>{ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div className={`field ${bad.name ? 'invalid' : ''}`}><label htmlFor="cname" className="req">Company or full name</label><input id="cname" type="text" autoComplete="organization" value={f.name} onChange={set('name')} /><span className="error">Enter the company or full name.</span></div>
          <div className="field"><label htmlFor="tin">TIN or registration number</label><input id="tin" type="text" value={f.tin} onChange={set('tin')} /><span className="hint">Required for companies registered in Rwanda.</span></div>
          <div className="field"><label htmlFor="addr">Physical address</label><input id="addr" type="text" autoComplete="street-address" value={f.address} onChange={set('address')} /><span className="hint">A P.O. Box alone is not a physical address.</span></div>
          <div className={`field ${bad.email ? 'invalid' : ''}`}><label htmlFor="remail" className="req">Email address</label><input id="remail" type="email" autoComplete="email" value={f.email} onChange={set('email')} /><span className="error">Enter a valid email address.</span></div>
          <div className="field"><label htmlFor="rphone">Phone number</label><input id="rphone" type="text" autoComplete="tel" placeholder="+250" value={f.phone} onChange={set('phone')} /></div>
          <div className={`field ${bad.password ? 'invalid' : ''}`}><label htmlFor="rpwd" className="req">Password</label><input id="rpwd" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} /><span className="hint">At least 10 characters.</span><span className="error">Use a password of at least 10 characters.</span></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="row"><button className="btn primary" type="submit" disabled={busy}>Create account</button><Link className="btn link" href="/signin">I already have an account</Link></div>
        </form>
      </div></main>
    </>
  );
}
