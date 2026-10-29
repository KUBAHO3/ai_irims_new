const cfg = $('Validate request').first().json.config;
const docs = $('Prepare documents').all().map((i) => i.json);

const chunks = [];
const documents = [];
$input.all().forEach((item, i) => {
  const d = docs[i];
  let n = 0, pages = 0, characters = 0, truncated = false;
  for (const { page, text } of splitPages(item.json.data || '')) {
    if (page) pages = page;
    characters += text.length;
    for (const piece of chunkText(text, cfg.chunkSize, cfg.chunkOverlap)) {
      if (n >= cfg.maxChunksPerDocument) { truncated = true; break; }
      chunks.push({ id: 'S' + (chunks.length + 1), requirementId: d.requirementId, file: d.fileName, page, text: piece });
      n++;
    }
  }
  documents.push({ requirementId: d.requirementId, fileName: d.fileName, pages: pages || null, characters, chunks: n, truncated, noText: characters === 0 });
});
if (!chunks.length) throw new Error('No text could be extracted from the documents (scanned files without OCR?)');

const out = [];
for (let i = 0; i < chunks.length; i += cfg.embedBatch) {
  out.push({ json: { model: cfg.embedModel, input: chunks.slice(i, i + cfg.embedBatch).map((c) => c.text), ...(i === 0 ? { chunks, documents } : {}) } });
}
return out;
