'use client';
import { HelpdeskModal } from '@/components/modals';
import { useModal } from '@/components/ui';

const JOURNEY: [string, string][] = [
  ['Draft', 'You enter product details and upload documents. Everything saves as you go.'],
  ['Payment', 'Submitting issues an invoice. Pay by mobile money or bank transfer and upload the proof.'],
  ['Verification', 'Rwanda FDA confirms the payment.'],
  ['Screening', 'Rwanda FDA checks the dossier is complete. Missing items come back to you as a query.'],
  ['Assessment', 'Assessors evaluate quality, safety and the label. Questions come back as queries.'],
  ['Approval', 'The final decision is made.'],
  ['Decision', 'If registered, the certificate is available to download from the application.'],
];

export default function HelpPage() {
  const openModal = useModal();
  return (
    <>
      <div className="page-head"><div><h1>Help</h1><p className="sub">How applications move through Rwanda FDA.</p></div></div>
      <div className="panel panel-pad stack" style={{ maxWidth: 820 }}>
        <h2>The journey of an application</h2>
        <ol className="timeline" style={{ marginTop: 12 }}>{JOURNEY.map(([t, d], i) => <li key={t} className={i > 1 && i < 6 ? 'fda' : ''}><strong>{t}</strong><div className="muted">{d}</div></li>)}</ol>
        <p>The coloured marker on each application shows who has it: <span className="badge you">With you</span> means you need to act; <span className="badge fda">With Rwanda FDA</span> means you can wait.</p>
        <h2>Human medicines: dossier documents</h2>
        <p className="muted">Human medicine applications are submitted in Common Technical Document (CTD) format: Modules 1 to 5, each of which can be uploaded as several files, plus any other supporting documents. If the product is already registered by a reference regulatory authority, the reliance pathway also needs a declaration of sameness, the GMP certificate issued by that authority, and a letter of authorization allowing it to share information with Rwanda FDA.</p>
        <div><button className="btn primary" onClick={() => openModal((close) => <HelpdeskModal close={close} />)}>Raise an issue with the help desk</button></div>
      </div>
    </>
  );
}
