const v = $('Validate request').first().json;
const selected = $('Select evidence').all().map((i) => i.json);
const today = new Date().toISOString().slice(0, 10);

// Dates are compared here, in code, and marked in the excerpts: small models get date arithmetic wrong.
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const mark = (iso) => (iso < today ? ' [before the analysis date]' : iso > today ? ' [after the analysis date]' : ' [same day as the analysis date]');
const pad = (n) => String(n).padStart(2, '0');
function markDates(text) {
  return text
    .replace(/\b(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})\b/gi,
      (m, d, mon, y) => m + mark(`${y}-${pad(MONTHS.indexOf(mon.toLowerCase()) + 1)}-${pad(d)}`))
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m) => m + mark(m));
}

const schema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['pass', 'fail', 'unclear', 'not_applicable'] },
    confidence: { type: 'number' },
    explanation: { type: 'string' },
    evidence: { type: 'array', items: { type: 'object', properties: { chunkId: { type: 'string' }, quote: { type: 'string' } }, required: ['chunkId', 'quote'] } },
    kbReferences: { type: 'array', items: { type: 'string' } },
    suggestion: { type: 'string' },
  },
  required: ['status', 'confidence', 'explanation', 'evidence', 'kbReferences', 'suggestion'],
};

const system = `You are a meticulous Rwanda FDA reviewer. You evaluate ONE rule at a time against excerpts from an applicant's submission.
Today's date (the analysis date) is ${today}. Every date in the excerpts is followed by a mark such as [before the analysis date] or [after the analysis date]; rely on these marks for validity and expiry checks instead of comparing dates yourself. Do not include the marks in quotes.

Decide the status:
- "pass": the SUBMISSION EXCERPTS clearly show the rule is met.
- "fail": the SUBMISSION EXCERPTS clearly show the rule is not met, or contain something that contradicts it.
- "unclear": the excerpts do not contain enough information to decide. The excerpts are only part of the submission, so missing information means "unclear", not "fail".
- "not_applicable": the excerpts show the rule does not apply to this product.

Rules for your answer:
- Base the decision only on the SUBMISSION EXCERPTS. KNOWLEDGE BASE excerpts (guidelines, templates, references) explain how to interpret the rule; they are never evidence that the submission complies. A TEMPLATE shows the structure a document is expected to follow.
- For "pass" or "fail", add evidence items. chunkId must be an S-id shown in the excerpts. If the rule compares documents (for example the label with the application form), quote EACH of them; if one of them says nothing on the point, the status is "fail" or "unclear", never "pass". quote must be copied word for word from that excerpt, at most 30 words, preferably one continuous passage.
- kbReferences: the K-ids you relied on, or an empty list.
- explanation: 1 to 3 plain sentences a human reviewer can check.
- suggestion: for "fail" or "unclear", one sentence telling the applicant what to provide or correct; otherwise an empty string.
- confidence: a number between 0 and 1.
Respond with JSON only.`;

const where = (name, page) => `${name}${page ? ', page ' + page : ''}`;
return $input.all().map((item) => {
  const row = item.json;
  const r = selected.find((s) => s.ruleCode === row.rule_code);
  const kb = Array.isArray(row.kb) ? row.kb : (typeof row.kb === 'string' ? JSON.parse(row.kb) : []);
  const kbText = kb.length ? kb.map((k) => `[${k.id}] ${k.kind.toUpperCase()}: ${where(k.title, k.page)}\n${k.text}`).join('\n\n') : '(none)';
  const evText = r.evidence.map((e) => `[${e.id}] (${e.requirementId}: ${where(e.file, e.page)})\n${markDates(e.text)}`).join('\n\n');
  const user = [
    `RULE ${r.ruleCode} (severity: ${r.severity})`, r.rule,
    r.guidance ? `Reviewer guidance: ${r.guidance}` : '',
    `Product type: ${v.productType}. Application: ${v.applicationRef}.`,
    '', 'KNOWLEDGE BASE:', kbText, '', 'SUBMISSION EXCERPTS:', evText,
  ].join('\n');
  return {
    json: {
      ruleCode: r.ruleCode, rule: r.rule, severity: r.severity, requirementIds: r.requirementIds, version: r.version, use: r.use,
      evidence: r.evidence, kb: kb.map(({ id, title, source_key, kind, page }) => ({ id, title, sourceKey: source_key, kind, page })),
      request: llmRequest(v.config, system, user, schema, 'rule_finding'),
    },
  };
});
