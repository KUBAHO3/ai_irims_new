const cfg = $('Prepare request').first().json.config;
const selected = $('Select evidence').all().map(i => i.json);

const schema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['pass', 'fail', 'unclear', 'not_applicable'] },
    confidence: { type: 'number' },
    explanation: { type: 'string' },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        properties: { chunkId: { type: 'string' }, quote: { type: 'string' } },
        required: ['chunkId', 'quote'],
      },
    },
    kbReferences: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'confidence', 'explanation', 'evidence', 'kbReferences'],
};

const system = `You are a meticulous regulatory reviewer. You evaluate ONE rule at a time against excerpts from an applicant's submission.

Decide the status:
- "pass": the SUBMISSION EXCERPTS clearly show the rule is met.
- "fail": the SUBMISSION EXCERPTS clearly show the rule is not met, or contain something that contradicts it.
- "unclear": the excerpts do not contain enough information to decide. The excerpts are only part of the submission, so missing information means "unclear", not "fail".
- "not_applicable": the excerpts show the rule does not apply to this submission.

Rules for your answer:
- Base the decision only on the SUBMISSION EXCERPTS. KNOWLEDGE BASE REFERENCES explain how to interpret the rule; they are never evidence that the submission complies.
- For "pass" or "fail", add evidence items. chunkId must be an S-id shown in the excerpts. quote must be copied word for word from that excerpt, at most 30 words.
- kbReferences: the K-ids you relied on, or an empty list.
- explanation: 1 to 3 plain sentences a human reviewer can check.
- confidence: a number between 0 and 1.
Respond with JSON only.`;

return $input.all().map(item => {
  const row = item.json;
  const r = selected.find(s => s.ruleCode === row.rule_code);
  const kb = Array.isArray(row.kb) ? row.kb : (typeof row.kb === 'string' ? JSON.parse(row.kb) : []);

  const where = (name, page) => `${name}${page ? ', page ' + page : ''}`;
  const kbText = kb.length
    ? kb.map(k => `[${k.id}] (${where(k.source, k.page)})\n${k.text}`).join('\n\n')
    : '(none)';
  const evText = r.evidence.map(e => `[${e.id}] (${where(e.file, e.page)})\n${e.text}`).join('\n\n');

  const user = [
    `RULE ${r.ruleCode} (severity: ${r.severity})`,
    r.ruleText,
    r.guidance ? `Reviewer guidance: ${r.guidance}` : '',
    '',
    'KNOWLEDGE BASE REFERENCES:',
    kbText,
    '',
    'SUBMISSION EXCERPTS:',
    evText,
  ].join('\n');

  return {
    json: {
      ruleCode: r.ruleCode,
      ruleText: r.ruleText,
      severity: r.severity,
      evidence: r.evidence,
      kb: kb.map(({ id, source, page }) => ({ id, source, page })),
      request: {
        model: cfg.llmModel,
        stream: false,
        format: schema,
        options: { temperature: 0, num_ctx: 8192 },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
    },
  };
});
