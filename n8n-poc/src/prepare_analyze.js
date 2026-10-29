// ---- Settings for the prototype -------------------------------------------
const CONFIG = {
  ollamaUrl: 'http://ollama:11434',
  embedModel: 'bge-m3',      // 1024-dim; must match vector(1024) in the schema
  llmModel: 'qwen2.5:7b',    // any Ollama model that handles JSON well
  topKEvidence: 5,           // submission chunks given to the LLM per rule
  topKKb: 3,                 // knowledge-base chunks given to the LLM per rule
  chunkSize: 1200,           // characters
  chunkOverlap: 200,
};
// ---------------------------------------------------------------------------

const req = $input.first();
const body = req.json.body || {};

const setCode = String(body.guidelineSet || '').trim();
if (!/^[A-Za-z0-9_-]{1,64}$/.test(setCode)) {
  throw new Error('"guidelineSet" is required (letters, digits, - or _ only)');
}
const output = String(body.output || 'json').toLowerCase() === 'text' ? 'text' : 'json';

let fields = body.fields || {};
if (typeof fields === 'string') {
  try { fields = JSON.parse(fields); } catch (e) { fields = { fields }; }
}

const meta = { setCode, output, fields, config: CONFIG };
const items = [];

// Free text and structured fields are analysed as a virtual document.
const inline = [];
if (body.text) inline.push(String(body.text));
const fieldLines = Object.entries(fields).map(
  ([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`
);
if (fieldLines.length) inline.push('Submission fields:\n' + fieldLines.join('\n'));
if (inline.length) {
  const txt = inline.join('\n\n');
  items.push({
    json: { ...meta, fileName: 'inline-submission.txt' },
    binary: {
      data: {
        data: Buffer.from(txt, 'utf8').toString('base64'),
        mimeType: 'text/plain',
        fileName: 'inline-submission.txt',
      },
    },
  });
}

// One item per uploaded file, whatever the multipart field names were.
for (const [key, bin] of Object.entries(req.binary || {})) {
  items.push({ json: { ...meta, fileName: bin.fileName || key }, binary: { data: bin } });
}

if (!items.length) throw new Error('Send at least one file or a "text" field');
return items;
