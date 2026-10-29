const fs = require('fs');
const S = f => fs.readFileSync('' + __dirname + '/' + f, 'utf8');
const outputs = {};
async function run(nodeName, file, inputItems, shared) {
  const code = (shared ? S('shared_text.js') + '\n' : '') + S(file);
  const $input = { all: () => inputItems, first: () => inputItems[0] };
  const $ = n => ({ all: () => outputs[n], first: () => outputs[n][0] });
  const fn = new Function('$input', '$', 'Buffer', `return (async () => { ${code} })();`);
  const res = await fn($input, $, Buffer);
  outputs[nodeName] = res; return res;
}
const fakeVec = t => { const v = new Array(8).fill(0); for (const w of t.toLowerCase().split(/\W+/)) if (w) v[w.length % 8] += 1; return v; };
(async () => {
  // ---- ANALYZE ----
  const pdfHtml = '<html><head><title>x</title></head><body><div class="page"><p>Applicant: Acme Pharma Ltd, KN 5 Rd, Kigali.</p><p>Product: Paracetamol 500 mg tablets.</p></div><div class="page"><p>Label text: Keep out of reach of children. Shelf life 36 months.</p></div></body></html>';
  const webhook = [{ json: { body: { guidelineSet: 'product-registration', output: 'text', text: 'Manufacturer: Acme Plant 2 & Co', fields: '{"applicant":"Acme"}' } },
    binary: { dossier: { data: 'AAA', mimeType: 'application/pdf', fileName: 'dossier.pdf' } } }];
  const prep = await run('Prepare request', 'prepare_analyze.js', webhook);
  console.log('prepare items:', prep.map(i => i.json.fileName), Buffer.from(prep[0].binary.data.data,'base64').toString());
  const tikaOut = [{ json: { data: '<html><body><p>Manufacturer: Acme Plant 2 &amp; Co</p><p>Submission fields:\napplicant: Acme</p></body></html>' } }, { json: { data: pdfHtml } }];
  const split = await run('Split into chunks', 'split_analyze.js', tikaOut, true);
  console.log('chunks:', JSON.stringify(split[0].json.chunks));
  outputs['Embed submission'] = [{ json: { embeddings: split[0].json.chunks.map(c => fakeVec(c.text)) } }];
  const rulesRows = [
    { json: { rule_code: 'GEN-001', rule_text: 'Applicant name and physical address', severity: 'critical', guidance: '' } },
    { json: { rule_code: 'LBL-001', rule_text: 'Label states storage conditions', severity: 'major', guidance: 'Store below 30C' } },
    { json: { rule_code: 'LBL-002', rule_text: 'Label states shelf life', severity: 'major', guidance: '' } }];
  const chk = await run('Check rules', 'check_rules.js', rulesRows);
  const ruleEmb = [{ json: { embeddings: chk[0].json.rules.map(r => fakeVec(r.rule_text)) } }];
  const sel = await run('Select evidence', 'select_evidence.js', ruleEmb);
  console.log('selected:', sel.length, sel[0].json.evidence.map(e => e.id + ':' + e.score));
  const kbRows = sel.map(s => ({ json: { rule_code: s.json.ruleCode, kb: [{ id: 'K7', source: 'guide.pdf', page: 3, text: 'Storage statements must include a temperature.', distance: 0.2 }] } }));
  kbRows.reverse(); // order should not matter
  const bp = await run('Build prompts', 'build_prompts.js', kbRows);
  console.log('prompt sample:\n' + bp[0].json.request.messages[1].content);
  const llm = [
    { json: { message: { content: JSON.stringify({ status: 'pass', confidence: 0.9, explanation: 'Shelf life given.', evidence: [{ chunkId: 'S3', quote: 'Shelf  life 36 MONTHS' }], kbReferences: [] }) } } },
    { json: { message: { content: JSON.stringify({ status: 'fail', confidence: 0.8, explanation: 'No storage temperature.', evidence: [{ chunkId: 'S3', quote: 'Keep out of reach of children.' }], kbReferences: ['K7', 'K99'] }) } } },
    { json: { error: { message: 'timeout' } } }];
  // map llm responses by actual order of bp
  const v = await run('Validate findings', 'validate_findings.js', llm);
  console.log('findings:', JSON.stringify(v[0].json.findings.map(f => [f.ruleCode, f.status, f.checks.notes, f.kbReferences.map(k=>k.id)])));
  const rep = await run('Build report', 'build_report.js', v);
  console.log(rep[0].json.contentType + '\n' + rep[0].json.responseBody);
  outputs['Prepare request'][0].json.output = 'json';
  const rep2 = await run('Build report', 'build_report.js', v);
  console.log(JSON.parse(rep2[0].json.responseBody).overall);

  // ---- INGEST ----
  const pi = await run('Prepare upload', 'prepare_ingest.js', [{ json: { body: { source: "O'Brien guide" } }, binary: { file: { data: 'x', fileName: 'g.pdf' } } }]);
  const si = await run('Split into chunks', 'split_ingest.js', [{ json: { data: pdfHtml } }], true);
  const sql = await run('Build SQL', 'build_sql.js', [{ json: { embeddings: si[0].json.chunks.map(c => fakeVec(c.text)) } }]);
  console.log(sql[0].json.sql);
  // error paths
  try { await run('Prepare request', 'prepare_analyze.js', [{ json: { body: { guidelineSet: "x'; drop" } } }]); } catch (e) { console.log('expected error:', e.message); }
})().catch(e => { console.error('FAILED', e); process.exit(1); });
