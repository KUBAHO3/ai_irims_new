// LLM request and response helpers, shared by every node that talks to the model.
// OpenAI uses strict JSON-schema output; Ollama uses its "format" option.
function strictSchema(s) {
  // OpenAI strict mode: every object lists all its properties as required and allows no others.
  if (s && s.type === 'object') return { ...s, additionalProperties: false, required: Object.keys(s.properties), properties: Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, strictSchema(v)])) };
  if (s && s.type === 'array') return { ...s, items: strictSchema(s.items) };
  return s;
}
function llmRequest(config, system, user, schema, name) {
  const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];
  if (config.llmProvider === 'openai') {
    return { model: config.llmModel, temperature: 0, messages, response_format: { type: 'json_schema', json_schema: { name, strict: true, schema: strictSchema(schema) } } };
  }
  return { model: config.llmModel, stream: false, format: schema, options: { temperature: 0, num_ctx: 8192 }, messages };
}
// Returns { data, error, tokens } from either provider's response item.
function llmResult(json) {
  if (json.error) return { data: null, error: String(json.error.message || json.error), tokens: 0 };
  const content = json.choices ? json.choices[0] && json.choices[0].message && json.choices[0].message.content : json.message && json.message.content;
  const tokens = json.usage ? json.usage.total_tokens || 0 : (json.prompt_eval_count || 0) + (json.eval_count || 0);
  try { return { data: JSON.parse(content || ''), error: null, tokens }; } catch (e) { return { data: null, error: 'Invalid JSON from the model', tokens }; }
}
