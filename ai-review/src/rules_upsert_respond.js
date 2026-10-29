const req = $('Validate rules').first().json;
const saved = $input.first().json.saved || [];
const found = new Set(saved.map((r) => r.code));
const notFound = req.statusOnlyCodes.filter((c) => !found.has(c));
return [{ json: { code: notFound.length ? 207 : 200, body: { saved, notFound } } }];
