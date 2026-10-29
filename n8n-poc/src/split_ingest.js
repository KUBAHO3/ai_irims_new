const prepared = $('Prepare upload').all();
const cfg = prepared[0].json.config;

const chunks = [];
$input.all().forEach((item, i) => {
  const source = prepared[i].json.source;
  let chunkIndex = 0;
  for (const { page, text } of splitPages(item.json.data || '')) {
    for (const piece of chunkText(text, cfg.chunkSize, cfg.chunkOverlap)) {
      chunks.push({ source, page, chunkIndex: chunkIndex++, text: piece });
    }
  }
});
if (!chunks.length) throw new Error('No text could be extracted (scanned file without OCR?)');
return [{ json: { chunks, embedModel: cfg.embedModel } }];
