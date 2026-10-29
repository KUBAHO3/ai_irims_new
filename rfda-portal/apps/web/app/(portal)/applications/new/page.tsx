'use client';
import { TYPES, money, type ApplicationDto, type ProductType } from '@rfda/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { RequirementsList } from '@/components/modals';
import { storeApp } from '@/components/session';
import { useBusy } from '@/components/ui';
import { api } from '@/lib/api';

export default function StartApplication() {
  const router = useRouter();
  const { busy, run } = useBusy();
  const [type, setType] = useState<ProductType>('HM');
  const [category, setCategory] = useState(TYPES.HM.categories[0]);
  const [submissionType, setSubmissionType] = useState('Single product');
  const t = TYPES[type];

  const pickType = (k: ProductType) => { setType(k); if (!TYPES[k].categories.includes(category)) setCategory(TYPES[k].categories[0]); };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const app = await api<ApplicationDto>('/applications', { body: { type, category, submissionType } });
      storeApp(app);
      router.push(`/applications/${app.id}/edit`);
    });
  };

  return (
    <>
      <div className="page-head"><div><div className="crumbs"><Link href="/dashboard">Dashboard</Link> / Start an application</div><h1>Register a new product</h1><p className="sub">Answer three questions. We’ll show exactly what you need before you begin.</p></div></div>
      <div className="start-layout">
        <form className="panel panel-pad stack" onSubmit={submit}>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="field"><span className="label req" style={{ fontSize: 16 }}>1. What type of product is it?</span></legend>
            <div className="choice-grid" style={{ marginTop: 10 }}>{(Object.entries(TYPES) as [ProductType, (typeof TYPES)[ProductType]][]).map(([k, v]) => (
              <label key={k} className="choice"><input type="radio" name="ptype" value={k} checked={type === k} onChange={() => pickType(k)} /><strong>{v.name}</strong><span>Typical review {v.timeline}</span></label>
            ))}</div></fieldset>
          <div className="field"><label htmlFor="pcat" className="req" style={{ fontSize: 16 }}>2. Which category?</label>
            <select id="pcat" value={category} onChange={(e) => setCategory(e.target.value)}>{t.categories.map((c) => <option key={c}>{c}</option>)}</select></div>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="field"><span className="label req" style={{ fontSize: 16 }}>3. How are you submitting?</span></legend>
            <div className="choice-grid" style={{ marginTop: 10 }}>
              {[['Single product', 'One product, one dossier'], ['Product family', 'Same formula, several strengths or pack sizes']].map(([v, d]) => (
                <label key={v} className="choice"><input type="radio" name="stype" value={v} checked={submissionType === v} onChange={() => setSubmissionType(v)} /><strong>{v}</strong><span>{d}</span></label>
              ))}
            </div></fieldset>
          <div className="row"><button className="btn primary" type="submit" disabled={busy}>Start application</button><span className="small muted">You can save and come back at any time.</span></div>
        </form>
        <aside className="panel panel-pad" aria-live="polite">
          <h3>What you’ll need</h3><p className="small muted" style={{ margin: '4px 0 0' }}>Have these ready as PDF, Word, Excel or image files.</p>
          <RequirementsList type={type} />
          <dl className="facts" style={{ marginTop: 18, gridTemplateColumns: '1fr 1fr' }}><div><dt>Estimated fee</dt><dd>{money(t.fee)}</dd></div><div><dt>Typical review</dt><dd>{t.timeline}</dd></div></dl>
        </aside>
      </div>
    </>
  );
}
