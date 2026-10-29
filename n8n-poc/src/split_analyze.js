const prepared = $('Prepare request').all();
const cfg = prepared[0].json.config;

const chunks = [];
$input.all().forEach((item, i) => {
  const fileName = prepared[i].json.fileName;
  for (const { page, text } of splitPages(item.json.data || '')) {
    for (const piece of chunkText(text, cfg.chunkSize, cfg.chunkOverlap)) {
      chunks.push({ id: 'S' + (chunks.length + 1), file: fileName, page, text: piece });
    }
  }
});

if (!chunks.length) {
  throw new Error('No text could be extracted from the submission (scanned file without OCR?)');
}
return [{ json: { chunks, embedModel: cfg.embedModel } }];
