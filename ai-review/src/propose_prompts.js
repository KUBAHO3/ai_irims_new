const req = $('Validate request').first().json;
const allowed = Object.entries(req.requirements).map(([id, name]) => `- ${id}: ${name}`).join('\n');

const schema = {
  type: 'object',
  properties: {
    rules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
          guidance: { type: 'string' },
          requirementIds: { type: 'array', items: { type: 'string' } },
          quote: { type: 'string' },
        },
        required: ['text', 'severity', 'guidance', 'requirementIds', 'quote'],
      },
    },
  },
  required: ['rules'],
};

const common = `Each rule must be ONE checkable statement that a reviewer can mark pass or fail by reading the applicant's documents. Split compound requirements into separate rules.
severity: "critical" for identity, safety or legal validity; "major" for content the dossier must have; "minor" for presentation.
guidance: one sentence telling the reviewer what is acceptable and what is not, or an empty string.
requirementIds: the documents where the reviewer should look, chosen ONLY from this list (empty list = the whole dossier):
${allowed}
quote: the sentence from the excerpt the rule comes from, copied word for word, at most 30 words.
Only use what the excerpt says. If it contains no requirement, return {"rules": []}. Respond with JSON only.`;

const system = {
  guideline: `You turn regulatory guidance into review rules for Rwanda FDA product registration.\nWrite each rule as a statement about the submission, e.g. "The label states the storage temperature."\n${common}`,
  template: `The excerpt is a TEMPLATE that applicants must follow. List the mandatory sections, fields and statements a completed document must contain.\nWrite each rule as "The <document> contains <section, field or statement>."\n${common}`,
  reference: `You turn regulatory reference material into review rules for Rwanda FDA product registration.\n${common}`,
};

return $input.all().map((item) => {
  const b = item.json;
  const scope = b.doc.requirementIds.length ? `This document applies to: ${b.doc.requirementIds.map((id) => req.requirements[id] || id).join('; ')}.` : '';
  return {
    json: {
      ...b,
      request: llmRequest(req.config, system[b.doc.kind] || system.guideline, `DOCUMENT: ${b.doc.title} (${b.doc.kind})\n${scope}\n\nEXCERPT:\n${b.text}`, schema, 'proposed_rules'),
    },
  };
});
