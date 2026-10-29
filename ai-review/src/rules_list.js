// GET /ai/rules?status=proposed&productType=HM&requirementId=rra-gmp  (all filters optional)
const q = $input.first().json.query || {};
const status = ['proposed', 'active', 'retired'].includes(q.status) ? q.status : '';
const productType = /^[A-Z]{2}$/.test(String(q.productType || '').toUpperCase()) ? String(q.productType).toUpperCase() : '';
const requirementId = /^[a-z0-9-]{1,40}$/.test(String(q.requirementId || '')) ? q.requirementId : '';
return [{ json: { params: [status, productType, requirementId] } }];
