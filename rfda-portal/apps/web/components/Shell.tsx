'use client';
import { SERVICES, type ApplicationDto, type UserDto } from '@rfda/shared';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { api, ApiError, fetcher } from '@/lib/api';
import { Icon } from './Icon';
import { HelpdeskModal } from './modals';
import { SessionCtx, useAllApps } from './session';
import { useModal, useToast } from './ui';

const APPLICANT_PATHS = ['/dashboard', '/applications', '/payments'];
const ASSESSOR_PATHS = ['/intray', '/enquiries', '/review'];

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, error } = useSWR<UserDto>('/auth/me', fetcher, { shouldRetryOnError: false });

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
  }, [error, pathname, router]);
  // Each role has its own area; send people home if they follow a link into the other one.
  const wrongArea = me && (me.role === 'applicant' ? ASSESSOR_PATHS : APPLICANT_PATHS).some((p) => pathname.startsWith(p));
  useEffect(() => { if (me && wrongArea) router.replace(me.role === 'assessor' ? '/intray' : '/dashboard'); }, [me, wrongArea, router]);

  if (error && !(error instanceof ApiError && error.status === 401)) return <p className="loading">The portal is unavailable right now. Try again shortly.</p>;
  if (!me || wrongArea) return <p className="loading">Loading…</p>;
  return <SessionCtx.Provider value={me}><Frame me={me}>{children}</Frame></SessionCtx.Provider>;
}

function Frame({ me, children }: { me: UserDto; children: ReactNode }) {
  const isA = me.role === 'applicant';
  const pathname = usePathname();
  const router = useRouter();
  const openModal = useModal();
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const [navOpen, setNavOpen] = useState(false);
  const { data: mine } = useSWR<ApplicationDto[]>(isA ? '/applications' : null, fetcher);
  const actionCount = isA ? (mine || []).filter((a) => ['awaiting_payment', 'queried', 'draft'].includes(a.status)).length : 0;
  useEffect(() => setNavOpen(false), [pathname]);

  const nav: [string, string, string, number?][] = isA
    ? [['/dashboard', 'home', 'Dashboard', actionCount], ['/applications', 'list', 'My applications'], ['/applications/new', 'plus', 'Start an application'], ['/payments', 'card', 'Invoices and payments'], ['/help', 'help', 'Help']]
    : [['/intray', 'inbox', 'In-tray', -1], ['/enquiries', 'search', 'Application enquiries'], ['/help', 'help', 'Help']];
  const active = (href: string) => {
    if (href === '/applications/new') return pathname === href || pathname.endsWith('/edit');
    if (href === '/applications') return pathname.startsWith('/applications') && pathname !== '/applications/new' && !pathname.endsWith('/edit');
    if (href === '/intray') return pathname.startsWith('/intray') || pathname.startsWith('/review');
    return pathname === href;
  };
  const signOut = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    await mutate(() => true, undefined, { revalidate: false });
    router.replace('/');
  };

  return (
    <div className={`shell ${navOpen ? 'nav-open' : ''}`}>
      <aside className="side" aria-label="Main navigation">
        <Link className="brand" href={isA ? '/dashboard' : '/intray'}><span className="logo"><img src="/logo.png" alt="" /></span><span><strong>Rwanda FDA</strong><span>{isA ? 'Applicant portal' : 'Assessment workspace'}</span></span></Link>
        <nav className="nav">
          {nav.map(([href, ic, label, count]) => (
            <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined}><Icon name={ic} /><span>{label}</span>
              {count === -1 ? <IntrayCount /> : count ? <span className="count">{count}</span> : null}</Link>
          ))}
          {isA && <><div className="nav-group">Other services</div>
            {SERVICES.slice(1).map((sv) => <a key={sv.name} href="#" onClick={(e) => { e.preventDefault(); toast(`${sv.name} is not available online yet.`); }}><Icon name={sv.icon} /><span>{sv.name}</span></a>)}</>}
        </nav>
        <div className="side-foot"><span>Rwanda FDA regulatory services portal</span></div>
      </aside>
      <div>
        <header className="topbar">
          <button className="btn small menu-btn" aria-label="Open navigation" aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)}><Icon name="menu" /></button>
          <span className="spacer" />
          <button className="btn small" aria-label="Help desk" onClick={() => openModal((close) => <HelpdeskModal close={close} />)}><Icon name="help" /><span className="lbl">Help desk</span></button>
          <div className="whoami">{isA ? <><strong>{me.name}</strong>Customer {me.customerNo}</> : <><strong>{me.name}</strong>Product assessment</>}</div>
          <button className="btn small" aria-label="Sign out" onClick={signOut}><Icon name="out" /><span className="lbl">Sign out</span></button>
        </header>
        <main className="main" id="main" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}

function IntrayCount() {
  const { data } = useAllApps();
  const n = (data || []).filter((a) => a.status === 'in_review').length;
  return n ? <span className="count">{n}</span> : null;
}
