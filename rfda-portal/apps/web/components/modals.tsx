'use client';
import {
  CONDITION_LABEL, HELPDESK_TOPICS, TYPES, allDocsFor, fmtDate, groupDocs, money, type ApplicationDto, type ProductType,
} from '@rfda/shared';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from './Icon';
import { storeApp } from './session';
import { ModalFrame, useBusy, useToast } from './ui';

/** What an applicant needs for a product type, grouped as in the wizard. */
export function RequirementsList({ type }: { type: ProductType }) {
  return (
    <>
      {groupDocs(allDocsFor(type)).map(([group, docs]) => (
        <div key={group} style={{ marginTop: 12 }}>
          <p className="small" style={{ fontWeight: 700, marginBottom: 4 }}>{group}</p>
          <ul className="need-list">
            {docs.map((d) => (
              <li key={d.id} className={d.req && !d.when ? '' : 'opt'}>
                {d.name}
                {!d.req && <span className="muted"> (optional)</span>}
                {d.req && d.when && <span className="muted"> ({CONDITION_LABEL[d.when]})</span>}
                {d.multiple && <span className="muted"> · several files allowed</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <ul className="need-list" style={{ marginTop: 12 }}><li>Label or artwork of the product as it will be sold</li></ul>
    </>
  );
}

export function RequirementsModal() {
  const [type, setType] = useState<ProductType>('HM');
  return (
    <ModalFrame title="Product registration (market authorization)">
      <div className="field"><label htmlFor="rqtype">Product type</label>
        <select id="rqtype" value={type} onChange={(e) => setType(e.target.value as ProductType)}>
          {Object.entries(TYPES).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}
        </select>
      </div>
      <RequirementsList type={type} />
      <dl className="facts" style={{ marginTop: 18, gridTemplateColumns: '1fr 1fr' }}>
        <div><dt>Estimated fee</dt><dd>{money(TYPES[type].fee)}</dd></div><div><dt>Typical review</dt><dd>{TYPES[type].timeline}</dd></div>
      </dl>
      <p className="small muted" style={{ marginTop: 12 }}>Fees and timelines are illustrative until confirmed by Rwanda FDA.</p>
    </ModalFrame>
  );
}

export function PayModal({ app, close }: { app: ApplicationDto; close: () => void }) {
  const toast = useToast();
  const { busy, run } = useBusy();
  const inv = app.invoice!;
  const done = (updated: ApplicationDto) => { storeApp(updated); close(); toast('Payment recorded. Rwanda FDA will confirm it, usually within 3 working days.'); };
  return (
    <ModalFrame title={`Pay invoice ${inv.no}`}>
      <p>Amount due: <strong style={{ fontSize: 20 }}>{money(inv.amount)}</strong></p>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="notice"><h3>Mobile money</h3><p className="small" style={{ marginTop: 4 }}>Pay from your phone. Payment is confirmed automatically.</p>
          <button className="btn primary small" style={{ marginTop: 10 }} disabled={busy} onClick={() => run(async () => done(await api<ApplicationDto>(`/applications/${app.id}/payment/mobile-money`, { method: 'POST' })))}>Pay with mobile money</button></div>
        <div className="notice"><h3>Bank transfer</h3><p className="small" style={{ marginTop: 4 }}>Use invoice {inv.no} as the reference, then upload the bank slip.</p>
          <label className="btn small" style={{ marginTop: 10 }} aria-disabled={busy}><Icon name="upload" /><span>{busy ? 'Uploading…' : 'Upload proof of payment'}</span>
            <input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg" disabled={busy} onChange={(e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const fd = new FormData(); fd.append('file', f);
              run(async () => done(await api<ApplicationDto>(`/applications/${app.id}/payment/proof`, { body: fd })));
            }} /></label></div>
      </div>
      <p className="small muted" style={{ marginTop: 14 }}>The mobile money gateway is not connected yet: this records the payment for Rwanda FDA to verify.</p>
    </ModalFrame>
  );
}

export function InvoiceModal({ app }: { app: ApplicationDto }) {
  const inv = app.invoice!;
  return (
    <ModalFrame wide title="Invoice" footer={<button className="btn primary" onClick={() => window.print()}>Print</button>}>
      <div className="row"><span className="brand"><span className="logo"><img src="/logo.png" alt="Rwanda FDA" /></span><span><strong>Rwanda Food and Drugs Authority</strong><span>Invoice {inv.no}</span></span></span></div>
      <dl className="facts" style={{ marginTop: 20 }}><div><dt>Billed to</dt><dd>{app.applicant}</dd></div><div><dt>Application</dt><dd>{app.ref}</dd></div><div><dt>Issued</dt><dd>{fmtDate(inv.issuedAt)}</dd></div></dl>
      <div className="table-wrap" style={{ marginTop: 20 }}><table><thead><tr><th>Description</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead><tbody>
        <tr><td>Registration fee: {TYPES[app.type].short}, {app.category} ({app.brand})</td><td style={{ textAlign: 'right' }}>{money(inv.amount)}</td></tr>
        <tr><td><strong>Total due</strong></td><td style={{ textAlign: 'right' }}><strong>{money(inv.amount)}</strong></td></tr>
      </tbody></table></div>
    </ModalFrame>
  );
}

export function CertModal({ app }: { app: ApplicationDto }) {
  return (
    <ModalFrame wide title="Registration certificate" footer={<button className="btn primary" onClick={() => window.print()}>Print</button>}>
      <div className="certificate"><img src="/logo.png" alt="Rwanda FDA" style={{ width: 80 }} /><p className="small muted" style={{ marginTop: 6 }}>Rwanda Food and Drugs Authority</p>
        <h2>Certificate of registration</h2><p>This certifies that</p>
        <p style={{ fontSize: 22, fontWeight: 800, margin: '8px 0' }}>{app.brand} ({app.generic} {app.size})</p>
        <p>is registered for sale in Rwanda under number <strong>{app.certNo}</strong>.</p>
        <dl className="facts" style={{ marginTop: 18, textAlign: 'left' }}><div><dt>Holder</dt><dd>{app.applicant}</dd></div><div><dt>Manufacturer</dt><dd>{app.mfrName}, {app.mfrCountry}</dd></div><div><dt>Issued</dt><dd>{fmtDate(app.decidedAt)}</dd></div><div><dt>Valid until</dt><dd>{fmtDate(app.expiresAt)}</dd></div></dl>
      </div>
    </ModalFrame>
  );
}

export function HelpdeskModal({ close, refNo = '' }: { close: () => void; refNo?: string }) {
  const toast = useToast();
  const { busy, run } = useBusy();
  const [topic, setTopic] = useState(HELPDESK_TOPICS[0]);
  const [ref, setRef] = useState(refNo);
  const [message, setMessage] = useState('');
  const [invalid, setInvalid] = useState(false);
  const send = () => {
    if (!message.trim()) { setInvalid(true); return; }
    run(async () => {
      const t = await api<{ no: string }>('/helpdesk', { body: { topic, ref: ref.trim() || undefined, message } });
      close(); toast(`Sent to the help desk. Ticket ${t.no} created.`);
    });
  };
  return (
    <ModalFrame title="Raise an issue with the help desk" footer={<><button className="btn" onClick={close}>Cancel</button><button className="btn primary" disabled={busy} onClick={send}>Send to help desk</button></>}>
      <div className="stack">
        <div className="field"><label htmlFor="hdtopic">Topic</label><select id="hdtopic" value={topic} onChange={(e) => setTopic(e.target.value)}>{HELPDESK_TOPICS.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="field"><label htmlFor="hdref">Tracking number (optional)</label><input id="hdref" type="text" value={ref} onChange={(e) => setRef(e.target.value)} /></div>
        <div className={`field ${invalid ? 'invalid' : ''}`}><label htmlFor="hdmsg" className="req">What happened?</label><textarea id="hdmsg" value={message} onChange={(e) => { setMessage(e.target.value); setInvalid(false); }} /><span className="error">Describe the issue.</span></div>
      </div>
    </ModalFrame>
  );
}
