'use client';
import { SERVICES, TYPES, type TrackDto } from '@rfda/shared';
import { FormEvent, Suspense, useState } from 'react';
import { Icon } from '@/components/Icon';
import { JourneyRail } from '@/components/journey';
import { RequirementsModal } from '@/components/modals';
import { PublicHeader, SignInForm } from '@/components/public';
import { ModalFrame, useModal, useToast } from '@/components/ui';
import { api, ApiError } from '@/lib/api';

export default function Home() {
  const openModal = useModal();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [result, setResult] = useState<{ app?: TrackDto; notFound?: string } | null>(null);

  const track = async (e: FormEvent) => {
    e.preventDefault();
    const ref = q.trim().toUpperCase();
    if (!ref) { setResult(null); return; }
    try { setResult({ app: await api<TrackDto>(`/public/track?ref=${encodeURIComponent(ref)}`) }); }
    catch (err) { if (err instanceof ApiError && err.status === 404) setResult({ notFound: ref }); else toast('Tracking is unavailable right now. Try again shortly.'); }
  };

  return (
    <>
      <PublicHeader />
      <main className="public-main">
        <section className="hero">
          <div>
            <h1>Apply, pay and follow every application in one place.</h1>
            <p className="lede">Submit dossiers to Rwanda FDA, answer queries and see exactly where each application is and who needs to act next.</p>
            <div className="track-box">
              <form onSubmit={track}><label className="sr-only" htmlFor="trackref">Tracking number</label>
                <input id="trackref" type="search" placeholder="Tracking number, e.g. RFDA26/PF/0013" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
                <button className="btn primary" type="submit"><Icon name="search" />Track application</button></form>
              <div className="track-result" aria-live="polite">
                {result?.app && (<>
                  <p className="small muted">{result.app.ref}</p>
                  <h3 style={{ margin: '2px 0 14px' }}>{result.app.brand} ({TYPES[result.app.type].short})</h3>
                  <JourneyRail app={result.app} />
                  <p className="small muted" style={{ marginTop: 10 }}>Sign in to see details and documents.</p>
                </>)}
                {result?.notFound && <div className="notice red">No application found with tracking number “{result.notFound}”. Check the number on your submission receipt; it looks like RFDA26/PF/0013.</div>}
              </div>
            </div>
          </div>
          <div className="panel auth-card"><Suspense><SignInForm /></Suspense></div>
        </section>
        <section className="services" aria-labelledby="svc">
          <h2 id="svc" style={{ marginBottom: 12 }}>Services</h2>
          {SERVICES.map((s) => (
            <div className="service-row" key={s.name}><span className="sicon"><Icon name={s.icon} /></span>
              <div><h3>{s.name}</h3><p>{s.text}</p></div>
              <div className="row actions">
                <button className="btn small" onClick={() => openModal(() => s.live ? <RequirementsModal /> : <NotYet name={s.name} />)}>Requirements</button>
                <button className="btn small primary" onClick={() => { toast('Sign in or create an account to start an application.'); document.getElementById('cust')?.focus(); }}>Start</button>
              </div></div>
          ))}
        </section>
      </main>
    </>
  );
}

function NotYet({ name }: { name: string }) {
  return <ModalFrame title={name}><p>This service is not available online yet. It will follow the same journey: start, upload documents, pay, follow progress.</p></ModalFrame>;
}
