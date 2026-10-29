'use client';
import { fmtDate, money } from '@rfda/shared';
import Link from 'next/link';
import { InvoiceBadge } from '@/components/journey';
import { PayModal } from '@/components/modals';
import { useMyApps } from '@/components/session';
import { useModal } from '@/components/ui';

export default function PaymentsPage() {
  const openModal = useModal();
  const { data } = useMyApps();
  if (!data) return <p className="loading">Loading…</p>;
  const apps = data.filter((a) => a.invoice).sort((a, b) => b.invoice!.issuedAt.localeCompare(a.invoice!.issuedAt));
  return (
    <>
      <div className="page-head"><div><h1>Invoices and payments</h1><p className="sub">Every invoice issued for your applications.</p></div></div>
      <div className="panel"><div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Application</th><th>Issued</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>
        {apps.length ? apps.map((a) => {
          const inv = a.invoice!;
          return (
            <tr key={a.id}>
              <td className="ref">{inv.no}</td><td><Link href={`/applications/${a.id}`}>{a.ref}</Link><div className="small muted">{a.brand}</div></td>
              <td>{fmtDate(inv.issuedAt)}</td><td>{money(inv.amount)}</td><td><InvoiceBadge status={inv.status} /></td>
              <td>{a.status === 'awaiting_payment' && ['unpaid', 'rejected'].includes(inv.status) && <button className="btn small primary" onClick={() => openModal((close) => <PayModal app={a} close={close} />)}>Pay</button>}</td>
            </tr>
          );
        }) : <tr><td colSpan={6} className="empty">No invoices yet. An invoice is issued when you submit an application.</td></tr>}
      </tbody></table></div></div>
    </>
  );
}
