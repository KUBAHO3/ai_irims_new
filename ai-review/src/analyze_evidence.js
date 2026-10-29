function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
const v = $('Validate request').first().json;
const { chunks } = $('Split into chunks').first().json;
const chunkVecs = $('Embed submission').all().flatMap((i) => i.json.embeddings);
const { evaluate } = $('Scope rules').first().json;
const ruleVecs = $input.first().json.embeddings;

// One item per rule: the best excerpts from the documents that rule applies to.
return evaluate.map((r, i) => {
  const evidence = chunks
    .map((c, j) => ({ c, j }))
    .filter(({ c }) => r.use.includes(c.requirementId))
    .map(({ c, j }) => ({ ...c, score: Math.round(cosine(ruleVecs[i], chunkVecs[j]) * 1000) / 1000 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, v.config.topKEvidence);
  return {
    json: {
      ...r, evidence,
      ruleVec: '[' + ruleVecs[i].join(',') + ']',
      reqArray: `ARRAY[${r.use.map((id) => `'${id}'`).join(',')}]::text[]`,
    },
  };
});
