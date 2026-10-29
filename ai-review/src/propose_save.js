// Keep only rules whose quote really is in the excerpt, then store them as "proposed".
const req = $('Validate request').first().json;
const batches = $('Build prompts').all().map((i) => i.json);
// Words and numbers only, so small punctuation differences in the model's quote don't drop a good proposal.
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
const esc = (s) => "'" + String(s).replace(/\u0000/g, '').replace(/'/g, "''") + "'";
const arr = (a) => `ARRAY[${a.map(esc).join(',')}]::text[]`;
// Short stable hash so the same proposal from a re-run gets the same code (and is not duplicated).
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(-6); };

const doc = batches[0].doc;
const kept = [], dropped = [];
$input.all().forEach((item, i) => {
  const b = batches[i];
  const res = llmResult(item.json);
  if (!res.data) dropped.push({ text: `(batch ${b.batch})`, reason: res.error });
  const out = res.data;
  for (const r of (out && Array.isArray(out.rules) ? out.rules : [])) {
    const text = String(r.text || '').trim();
    const severity = ['critical', 'major', 'minor'].includes(r.severity) ? r.severity : null;
    if (text.length < 10 || text.length > 500 || !severity) { dropped.push({ text, reason: 'incomplete' }); continue; }
    if (!norm(r.quote) || !norm(b.text).includes(norm(r.quote))) { dropped.push({ text, reason: 'quote not found in the document' }); continue; }
    let ids = (Array.isArray(r.requirementIds) ? r.requirementIds : []).map(String).filter((id) => req.requirements[id]);
    if (!ids.length) ids = doc.requirementIds;
    const where = b.pages.length ? `, page ${b.pages.join('/')}` : '';
    const guidance = [String(r.guidance || '').trim(), `Proposed from "${doc.title}"${where}: "${String(r.quote).trim()}"`].filter(Boolean).join(' ');
    kept.push({ code: `P${doc.id}-${hash(norm(text))}`, text, severity, guidance, requirementIds: ids });
  }
});
const callErrors = dropped.filter((d) => d.text.startsWith('(batch '));
if (callErrors.length === batches.length) throw new Error(`Every LLM call failed. First error: ${callErrors[0].reason}`);
const unique = [...new Map(kept.map((r) => [r.code, r])).values()];
const sql = unique.length
  ? `INSERT INTO guideline_rules (rule_code, rule_text, severity, guidance, product_types, requirement_ids, status, source_document_id)
VALUES ${unique.map((r) => `(${esc(r.code)}, ${esc(r.text)}, ${esc(r.severity)}, ${esc(r.guidance)}, ${arr(doc.productTypes)}, ${arr(r.requirementIds)}, 'proposed', ${doc.id})`).join(',\n')}
ON CONFLICT (rule_code) DO NOTHING RETURNING rule_code;`
  : 'SELECT NULL AS rule_code WHERE false;';
return [{ json: { sql, proposed: unique.length, dropped } }];
