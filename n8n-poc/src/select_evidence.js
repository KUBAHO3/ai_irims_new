function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

const cfg = $('Prepare request').first().json.config;
const chunks = $('Split into chunks').first().json.chunks;
const chunkVecs = $('Embed submission').first().json.embeddings;
const rules = $('Check rules').first().json.rules;
const ruleVecs = $input.first().json.embeddings;

// One output item per rule = one LLM evaluation per rule (the "map" step).
return rules.map((r, i) => {
  const evidence = chunks
    .map((c, j) => ({ ...c, score: Math.round(cosine(ruleVecs[i], chunkVecs[j]) * 1000) / 1000 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, cfg.topKEvidence);
  return {
    json: {
      ruleCode: r.rule_code,
      ruleText: r.rule_text,
      severity: r.severity,
      guidance: r.guidance,
      evidence,
      ruleVec: '[' + ruleVecs[i].join(',') + ']',
    },
  };
});
