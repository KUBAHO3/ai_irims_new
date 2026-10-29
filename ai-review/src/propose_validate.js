// ---- Settings ---------------------------------------------------------------
const CONFIG = {
  llmProvider: 'openai',   // 'openai' (credential "OpenAI account") or 'ollama' (local, no data leaves the server)
  llmModel: 'gpt-4o-mini', // for Ollama use e.g. 'qwen2.5:7b'
  ollamaUrl: 'http://ollama:11434',
  maxChars: 3500,          // text per LLM call
  defaultMaxChunks: 40,    // chunks read per request unless "maxChunks" is sent
};
// The portal's document requirements (keep in sync with packages/shared/src/reference.ts).
const REQUIREMENTS = {
  'application-form': 'Application form fields', artwork: 'Label or artwork',
  cover: 'Cover letter', poa: 'Power of attorney', ltrletter: 'Letter appointing the local technical representative', tm: 'Trademark agreement',
  sameness: 'Declaration of sameness', 'rra-gmp': 'GMP certificate issued by the reference regulatory authority',
  'rra-auth': 'Letter of authorization for the reference regulatory authority to share information with Rwanda FDA',
  m1: 'CTD Module 1: Administrative and prescribing information', m2: 'CTD Module 2: Summaries', m3: 'CTD Module 3: Quality',
  m4: 'CTD Module 4: Non-clinical study reports', m5: 'CTD Module 5: Clinical studies', other: 'Other documents',
  gmp: 'GMP certificate', coa: 'Certificate of analysis', spc: 'Summary of product characteristics', wd: 'Withdrawal period justification',
  fsc: 'Food safety certificate', comp: 'Product composition', fsale: 'Free sale certificate', inci: 'Ingredient list (INCI)',
  safety: 'Product safety assessment', iso: 'ISO 13485 certificate', doc: 'Declaration of conformity', tech: 'Technical file summary', ifu: 'Instructions for use',
};
// -----------------------------------------------------------------------------
const body = $input.first().json.body || {};
const sourceKey = String(body.sourceKey || '').trim().toLowerCase();
const maxChunks = Math.min(500, Math.max(1, parseInt(body.maxChunks, 10) || CONFIG.defaultMaxChunks));
const errors = [];
if (!/^[a-z0-9][a-z0-9_.-]{1,80}$/.test(sourceKey)) errors.push('sourceKey is required: the id used when the document was uploaded');
return [{ json: { valid: !errors.length, errors, sourceKey, maxChunks, config: CONFIG, requirements: REQUIREMENTS } }];
