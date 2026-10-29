// ---- Settings ---------------------------------------------------------------
const CONFIG = {
  ollamaUrl: 'http://ollama:11434',
  embedModel: 'bge-m3',   // 1024 dimensions: must match vector(1024) in the schema
  chunkSize: 1200,        // characters per chunk
  chunkOverlap: 200,
  embedBatch: 32,         // chunks per embedding request
};
const PRODUCT_TYPES = ['HM', 'VM', 'PF', 'CO', 'MD'];
const KINDS = ['guideline', 'template', 'reference'];
// -----------------------------------------------------------------------------

const req = $input.first();
const body = req.json.body || {};
const errors = [];
const list = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((s) => String(s).trim()).filter(Boolean);

const sourceKey = String(body.sourceKey || '').trim().toLowerCase();
if (!/^[a-z0-9][a-z0-9_.-]{1,80}$/.test(sourceKey)) errors.push('sourceKey is required: a stable id such as "rfda-labelling-guideline" (a-z, 0-9, . _ -)');
const title = String(body.title || '').trim();
if (!title) errors.push('title is required');
const kind = String(body.kind || 'guideline').trim().toLowerCase();
if (!KINDS.includes(kind)) errors.push(`kind must be one of ${KINDS.join(', ')}`);
const productTypes = list(body.productTypes).map((s) => s.toUpperCase());
productTypes.filter((t) => !PRODUCT_TYPES.includes(t)).forEach((t) => errors.push(`Unknown product type "${t}"`));
const requirementIds = list(body.requirementIds).map((s) => s.toLowerCase());
requirementIds.filter((r) => !/^[a-z0-9-]{1,40}$/.test(r)).forEach((r) => errors.push(`Invalid requirement id "${r}"`));
const version = String(body.version || '1').trim().slice(0, 40);

const files = Object.entries(req.binary || {});
if (files.length > 1) errors.push('Send one document per request');
const text = String(body.text || '').trim();
if (!files.length && !text) errors.push('Send a file (field "file") or a "text" field');

const meta = { valid: !errors.length, errors, sourceKey, title, kind, productTypes, requirementIds, version, config: CONFIG };
if (!meta.valid) return [{ json: meta }];

if (files.length) {
  const [, bin] = files[0];
  return [{ json: { ...meta, fileName: bin.fileName || sourceKey }, binary: { data: bin } }];
}
return [{
  json: { ...meta, fileName: sourceKey + '.txt' },
  binary: { data: { data: Buffer.from(text, 'utf8').toString('base64'), mimeType: 'text/plain', fileName: sourceKey + '.txt' } },
}];
