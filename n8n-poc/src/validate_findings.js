const prompts = $('Build prompts').all().map(i => i.json);
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

const findings = $input.all().map((item, i) => {
  const p = prompts[i];
  const base = { ruleCode: p.ruleCode, rule: p.ruleText, severity: p.severity };

  let r = null;
  try { r = JSON.parse((item.json.message && item.json.message.content) || ''); } catch (e) { r = null; }
  const statuses = ['pass', 'fail', 'unclear', 'not_applicable'];
  if (!r || !statuses.includes(r.status)) {
    return {
      ...base, status: 'unclear', confidence: 0,
      explanation: 'The model output could not be used; manual review needed.',
      evidence: [], kbReferences: [],
      checks: { parsed: false, notes: [item.json.error ? String(item.json.error.message || item.json.error) : 'Invalid JSON'] },
    };
  }

  // Every quote must really exist in the chunk the model cited.
  const byId = Object.fromEntries(p.evidence.map(e => [e.id, e]));
  const evidence = (r.evidence || []).map(ev => {
    const src = byId[ev.chunkId];
    return {
      chunkId: ev.chunkId,
      document: src ? src.file : null,
      page: src ? src.page : null,
      quote: ev.quote,
      verified: !!src && !!norm(ev.quote) && norm(src.text).includes(norm(ev.quote)),
    };
  });

  const notes = [];
  let status = r.status;
  if ((status === 'pass' || status === 'fail') && !evidence.some(e => e.verified)) {
    notes.push(`Model answered "${status}" but no quote could be verified in the submission; downgraded to "unclear".`);
    status = 'unclear';
  }

  const kbById = Object.fromEntries(p.kb.map(k => [k.id, k]));
  const kbReferences = (r.kbReferences || []).filter(id => kbById[id]).map(id => kbById[id]);

  const confidence = Math.max(0, Math.min(1, Number(r.confidence) || 0));
  return { ...base, status, confidence, explanation: r.explanation || '', evidence, kbReferences, checks: { parsed: true, notes } };
});

return [{ json: { findings } }];
