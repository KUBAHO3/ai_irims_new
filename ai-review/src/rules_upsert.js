// POST /ai/rules: add or change rules. Send {"rules": [...]} or a plain array.
// Full rule: {code, text, severity, guidance?, productTypes?, requirementIds?, status?}
// Status only (e.g. approve a proposed rule): {code, status: "active"}
const PRODUCT_TYPES = ['HM', 'VM', 'PF', 'CO', 'MD'];
const STATUSES = ['proposed', 'active', 'retired'];
const SEVERITIES = ['critical', 'major', 'minor'];

const body = $input.first().json.body;
const rules = Array.isArray(body) ? body : (body && Array.isArray(body.rules) ? body.rules : null);
const errors = [];
if (!rules || !rules.length) errors.push('Send {"rules": [...]} with at least one rule');

const esc = (s) => "'" + String(s).replace(/\u0000/g, '').replace(/'/g, "''") + "'";
const arr = (a) => `ARRAY[${a.map(esc).join(',')}]::text[]`;
const list = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((s) => String(s).trim()).filter(Boolean);

const full = [], statusOnly = [];
(rules || []).forEach((r, i) => {
  const at = `rules[${i}]`;
  const code = String(r.code || '').trim();
  if (!/^[A-Za-z0-9_.-]{1,40}$/.test(code)) { errors.push(`${at}: code is required (letters, digits, _ . -)`); return; }
  const status = r.status === undefined ? undefined : String(r.status);
  if (status !== undefined && !STATUSES.includes(status)) errors.push(`${code}: status must be ${STATUSES.join(', ')}`);
  if (r.text === undefined) {
    if (status === undefined) errors.push(`${code}: send "text" (to add or change the rule) or "status"`);
    else statusOnly.push({ code, status });
    return;
  }
  const text = String(r.text).trim();
  if (text.length < 10) errors.push(`${code}: text is too short. Write one checkable statement.`);
  const severity = String(r.severity || '').toLowerCase();
  if (!SEVERITIES.includes(severity)) errors.push(`${code}: severity must be ${SEVERITIES.join(', ')}`);
  const productTypes = list(r.productTypes).map((s) => s.toUpperCase());
  productTypes.filter((t) => !PRODUCT_TYPES.includes(t)).forEach((t) => errors.push(`${code}: unknown product type "${t}"`));
  const requirementIds = list(r.requirementIds).map((s) => s.toLowerCase());
  requirementIds.filter((x) => !/^[a-z0-9-]{1,40}$/.test(x)).forEach((x) => errors.push(`${code}: invalid requirement id "${x}"`));
  full.push({ code, text, severity, guidance: r.guidance ? String(r.guidance) : null, productTypes, requirementIds, status: status || 'active' });
});
if (errors.length) return [{ json: { valid: false, errors } }];

// The version goes up whenever the wording changes, so each analysis records which wording it used.
const parts = [];
if (full.length) parts.push(`up AS (
  INSERT INTO guideline_rules (rule_code, rule_text, severity, guidance, product_types, requirement_ids, status)
  VALUES ${full.map((r) => `(${esc(r.code)}, ${esc(r.text)}, ${esc(r.severity)}, ${r.guidance === null ? 'NULL' : esc(r.guidance)}, ${arr(r.productTypes)}, ${arr(r.requirementIds)}, ${esc(r.status)})`).join(',\n  ')}
  ON CONFLICT (rule_code) DO UPDATE SET rule_text = EXCLUDED.rule_text, severity = EXCLUDED.severity, guidance = EXCLUDED.guidance,
    product_types = EXCLUDED.product_types, requirement_ids = EXCLUDED.requirement_ids, status = EXCLUDED.status,
    version = guideline_rules.version + CASE WHEN guideline_rules.rule_text IS DISTINCT FROM EXCLUDED.rule_text
      OR guideline_rules.guidance IS DISTINCT FROM EXCLUDED.guidance THEN 1 ELSE 0 END,
    updated_at = now()
  RETURNING rule_code, status, version
)`);
if (statusOnly.length) parts.push(`st AS (
  UPDATE guideline_rules g SET status = v.status, updated_at = now()
  FROM (VALUES ${statusOnly.map((r) => `(${esc(r.code)}, ${esc(r.status)})`).join(', ')}) AS v(code, status)
  WHERE g.rule_code = v.code
  RETURNING g.rule_code, g.status, g.version
)`);
const sources = [full.length && 'SELECT * FROM up', statusOnly.length && 'SELECT * FROM st'].filter(Boolean).join(' UNION ALL ');
const sql = `WITH ${parts.join(', ')}
SELECT COALESCE(json_agg(json_build_object('code', x.rule_code, 'status', x.status, 'version', x.version)), '[]'::json) AS saved
FROM (${sources}) x;`;
return [{ json: { valid: true, sql, requested: full.length + statusOnly.length, statusOnlyCodes: statusOnly.map((r) => r.code) } }];
