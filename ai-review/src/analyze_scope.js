// Decide which rules to evaluate, and against which documents.
// A rule with requirement ids is checked only against those documents; without, against everything sent.
const v = $('Validate request').first().json;
const { documents } = $('Split into chunks').first().json;
const rows = $input.all().map((i) => i.json).filter((r) => r && r.rule_code);
const provided = [...new Set(documents.filter((d) => d.chunks > 0).map((d) => d.requirementId))];

const evaluate = [], skipped = [];
for (const r of rows) {
  const wanted = (r.requirement_ids || []).filter((id) => /^[a-z0-9-]{1,40}$/.test(id));
  const use = wanted.length ? wanted.filter((id) => provided.includes(id)) : provided;
  const base = { ruleCode: r.rule_code, rule: r.rule_text, severity: r.severity, requirementIds: wanted, version: r.version };
  if (!use.length) skipped.push({ ...base, reason: `Not evaluated: no ${wanted.join(' or ')} document was sent` });
  else evaluate.push({ ...base, guidance: r.guidance, use });
}
return [{ json: { evaluate, skipped, model: v.config.embedModel, input: evaluate.map((r) => r.rule + (r.guidance ? '\n' + r.guidance : '')) } }];
