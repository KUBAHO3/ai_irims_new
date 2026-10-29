const meta = $('Validate upload').first().json;
const cfg = meta.config;

const chunks = [];
let pages = 0;
for (const { page, text } of splitPages($input.first().json.data || '')) {
  if (page) pages = page;
  for (const piece of chunkText(text, cfg.chunkSize, cfg.chunkOverlap)) chunks.push({ page, chunkIndex: chunks.length, text: piece });
}
if (!chunks.length) throw new Error('No text could be extracted from the document (scanned file without OCR?)');

// One item per batch of chunks, so large documents are embedded in several requests.
const out = [];
for (let i = 0; i < chunks.length; i += cfg.embedBatch) {
  out.push({ json: { model: cfg.embedModel, input: chunks.slice(i, i + cfg.embedBatch).map((c) => c.text), ...(i === 0 ? { chunks, pages } : {}) } });
}
return out;
