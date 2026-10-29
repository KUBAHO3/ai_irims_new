const CONFIG = {
  ollamaUrl: 'http://ollama:11434',
  embedModel: 'bge-m3',
  chunkSize: 1200,
  chunkOverlap: 200,
};

const req = $input.first();
const body = req.json.body || {};
const items = [];

for (const [key, bin] of Object.entries(req.binary || {})) {
  const fileName = bin.fileName || key;
  items.push({ json: { source: body.source || fileName, fileName, config: CONFIG }, binary: { data: bin } });
}
if (body.text) {
  const source = body.source || 'inline-text';
  items.push({
    json: { source, fileName: source, config: CONFIG },
    binary: {
      data: {
        data: Buffer.from(String(body.text), 'utf8').toString('base64'),
        mimeType: 'text/plain',
        fileName: source + '.txt',
      },
    },
  });
}
if (!items.length) throw new Error('Send at least one file or a "text" field');
return items;
