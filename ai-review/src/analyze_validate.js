// ---- Settings ---------------------------------------------------------------
const CONFIG = {
  llmProvider: 'openai',        // 'openai' (credential "OpenAI account") or 'ollama' (local, no data leaves the server)
  llmModel: 'gpt-4o-mini',      // for Ollama use e.g. 'qwen2.5:7b'
  ollamaUrl: 'http://ollama:11434',
  embedModel: 'bge-m3',         // local embeddings, 1024 dimensions: must match vector(1024) in the schema
  topKEvidence: 5,              // submission excerpts given to the LLM per rule
  topKKb: 3,                    // knowledge-base excerpts given to the LLM per rule
  chunkSize: 1200,
  chunkOverlap: 200,
  embedBatch: 32,
  maxChunksPerDocument: 400,    // very long documents are cut here (reported in the result)
};
const PRODUCT_TYPES = ['HM', 'VM', 'PF', 'CO', 'MD'];
// -----------------------------------------------------------------------------

const req = $input.first();
const body = req.json.body || {};
const errors = [];

const applicationRef = String(body.applicationRef || '').trim();
if (!/^[A-Za-z0-9/_.-]{1,64}$/.test(applicationRef)) errors.push('applicationRef is required, e.g. RFDA26/HM/0207');
const productType = String(body.productType || '').trim().toUpperCase();
if (!PRODUCT_TYPES.includes(productType)) errors.push(`productType must be one of ${PRODUCT_TYPES.join(', ')}`);

let fields = body.fields || {};
if (typeof fields === 'string') { try { fields = JSON.parse(fields); } catch (e) { errors.push('fields must be a JSON object'); fields = {}; } }
if (!fields || typeof fields !== 'object' || Array.isArray(fields)) { errors.push('fields must be a JSON object'); fields = {}; }
const labelText = String(body.labelText || '').trim();
const callbackUrl = String(body.callbackUrl || '').trim();
if (callbackUrl && !/^https?:\/\/\S+$/.test(callbackUrl)) errors.push('callbackUrl must be an http(s) URL');

// Each file's form field name is its document requirement id: m3, rra-gmp, artwork; a second file is m3__2.
const files = Object.entries(req.binary || {}).map(([key, b]) => ({ key, requirementId: key.split('__')[0].toLowerCase(), fileName: b.fileName || key, size: b.fileSize || null }));
files.filter((f) => !/^[a-z0-9-]{1,40}$/.test(f.requirementId)).forEach((f) => errors.push(`File field "${f.key}": name it after the document requirement, e.g. m3 or m3__2`));
if (!files.length && !labelText && !Object.keys(fields).length) errors.push('Send at least one file, labelText or fields');

const request = { applicationRef, productType, fieldNames: Object.keys(fields), labelText: !!labelText, files: files.map(({ key, requirementId, fileName, size }) => ({ key, requirementId, fileName, size })) };
return [{ json: { valid: !errors.length, errors, applicationRef, productType, fields, labelText, callbackUrl, files, request, config: CONFIG } }];
