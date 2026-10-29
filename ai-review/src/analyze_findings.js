const prompts = $('Build prompts').all().map((i) => i.json);
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const STATUSES = ['pass', 'fail', 'unclear', 'not_applicable'];

let tokens = 0;
const findings = $input.all().map((item, i) => {
  const p = prompts[i];
  const base = { ruleCode: p.ruleCode, rule: p.rule, severity: p.severity, requirementIds: p.requirementIds, ruleVersion: p.version };
  const out = llmResult(item.json);
  tokens += out.tokens;
  const r = out.data;
  if (!r || !STATUSES.includes(r.status)) {
    return { ...base, status: 'unclear', confidence: 0, explanation: 'The model output could not be used; manual review needed.', suggestion: '', evidence: [], kbReferences: [],
      checks: { parsed: false, notes: [out.error || 'Unexpected answer from the model'] } };
  }
  // Every quote must really exist in the excerpt the model cited.
  const byId = Object.fromEntries(p.evidence.map((e) => [e.id, e]));
  const evidence = (r.evidence || []).map((ev) => {
    const src = byId[ev.chunkId];
    return { chunkId: ev.chunkId, requirementId: src ? src.requirementId : null, document: src ? src.file : null, page: src ? src.page : null,
      quote: ev.quote, verified: !!src && !!norm(ev.quote) && norm(src.text).includes(norm(ev.quote)) };
  });
  const notes = [];
  let status = r.status;
  if ((status === 'pass' || status === 'fail') && !evidence.some((e) => e.verified)) {
    notes.push(`Model answered "${status}" but no quote could be verified in the submission; downgraded to "unclear".`);
    status = 'unclear';
  }
  // A rule that compares documents only passes with a verified quote from each document it was checked against.
  if (status === 'pass' && p.use.length > 1) {
    const quoted = new Set(evidence.filter((e) => e.verified).map((e) => e.requirementId));
    const missing = p.use.filter((id) => !quoted.has(id));
    if (missing.length) {
      notes.push(`Model answered "pass" without quoting ${missing.join(', ')}; a comparison needs evidence from every document. Downgraded to "unclear".`);
      status = 'unclear';
    }
  }
  const kbById = Object.fromEntries(p.kb.map((k) => [k.id, k]));
  return {
    ...base, status, confidence: Math.max(0, Math.min(1, Number(r.confidence) || 0)), explanation: r.explanation || '',
    suggestion: status === 'fail' || status === 'unclear' ? String(r.suggestion || '') : '',
    evidence, kbReferences: (r.kbReferences || []).filter((id) => kbById[id]).map((id) => kbById[id]),
    checks: { parsed: true, notes },
  };
});
// Every call failing means a setup problem (wrong key, no credit, model down), not unclear rules: fail the run.
const failed = findings.filter((f) => !f.checks.parsed);
if (findings.length && failed.length === findings.length) throw new Error(`Every LLM call failed. First error: ${failed[0].checks.notes[0]}`);
return [{ json: { findings, tokens } }];
