const v = $('Validate request').first().json;
const analysisId = $('Create analysis record').first().json.id;
const { documents } = $('Split into chunks').first().json;
const { skipped } = $('Scope rules').first().json;
const findings = $input.first().json.findings || [];   // empty when no rule applied
const tokens = $input.first().json.tokens || 0;

const count = (s) => findings.filter((f) => f.status === s).length;
const counts = { pass: count('pass'), fail: count('fail'), unclear: count('unclear'), not_applicable: count('not_applicable'), evaluated: findings.length, skipped: skipped.length };
let verdict = 'compliant';
if (findings.some((f) => f.status === 'fail' && ['critical', 'major'].includes(f.severity))) verdict = 'non_compliant';
else if (counts.fail || counts.unclear || !findings.length) verdict = 'needs_review';

const order = { fail: 0, unclear: 1, pass: 2, not_applicable: 3 };
const sev = { critical: 0, major: 1, minor: 2 };
const result = {
  analysisId, status: 'completed', applicationRef: v.applicationRef, productType: v.productType,
  overall: { verdict, counts },
  summary: `${counts.fail} of ${counts.evaluated} rules failed; ${counts.unclear} unclear; ${counts.pass} passed; ${counts.skipped} not evaluated.`,
  findings: [...findings].sort((a, b) => order[a.status] - order[b.status] || sev[a.severity] - sev[b.severity]),
  skipped,
  documents,
  trace: {
    embedModel: v.config.embedModel, llmProvider: v.config.llmProvider, llmModel: v.config.llmModel, llmTokens: tokens,
    ruleVersions: Object.fromEntries([...findings, ...skipped].map((f) => [f.ruleCode, f.ruleVersion ?? f.version])),
    analyzedAt: new Date().toISOString(),
  },
};
return [{ json: { analysisId, resultJson: JSON.stringify(result) } }];
