const req = $('Prepare request').first().json;
const documents = $('Prepare request').all().map(i => i.json.fileName);
const { findings } = $input.first().json;

const count = s => findings.filter(f => f.status === s).length;
const counts = {
  pass: count('pass'), fail: count('fail'), unclear: count('unclear'),
  not_applicable: count('not_applicable'), total: findings.length,
};

let verdict = 'compliant';
if (findings.some(f => f.status === 'fail' && ['critical', 'major'].includes(f.severity))) verdict = 'non_compliant';
else if (counts.fail || counts.unclear) verdict = 'needs_review';

const result = {
  status: 'completed',
  guidelineSet: req.setCode,
  overall: { verdict, counts },
  summary: `${counts.fail} of ${counts.total} rules failed; ${counts.unclear} unclear; ${counts.pass} passed.`,
  findings,
  trace: {
    documents,
    embedModel: req.config.embedModel,
    llmModel: req.config.llmModel,
    analyzedAt: new Date().toISOString(),
  },
};

if (req.output !== 'text') {
  return [{ json: { contentType: 'application/json', responseBody: JSON.stringify(result, null, 2) } }];
}

const lines = [
  `Analysis report - guideline set: ${req.setCode}`,
  `Verdict: ${verdict.toUpperCase().replace('_', ' ')}`,
  result.summary,
  `Documents: ${documents.join(', ')}`,
  '',
];
const order = { fail: 0, unclear: 1, pass: 2, not_applicable: 3 };
for (const f of [...findings].sort((a, b) => order[a.status] - order[b.status])) {
  lines.push(`[${f.status.toUpperCase()}] ${f.ruleCode} (${f.severity}) ${f.rule}`);
  lines.push(`  Why: ${f.explanation}`);
  for (const e of f.evidence) {
    const loc = `${e.document || '?'}${e.page ? ', p.' + e.page : ''}`;
    lines.push(`  Evidence: "${e.quote}" (${loc}${e.verified ? '' : ', NOT VERIFIED'})`);
  }
  for (const n of f.checks.notes || []) lines.push(`  Note: ${n}`);
  lines.push('');
}
return [{ json: { contentType: 'text/plain; charset=utf-8', responseBody: lines.join('\n') } }];
