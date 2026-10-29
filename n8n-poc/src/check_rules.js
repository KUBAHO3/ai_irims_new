const req = $('Prepare request').first().json;
const rules = $input.all().map(i => i.json).filter(r => r && r.rule_code);

if (!rules.length) {
  throw new Error(`No active rules found for guideline set "${req.setCode}"`);
}
for (const r of rules) {
  if (!/^[A-Za-z0-9_.-]+$/.test(r.rule_code)) throw new Error('Invalid rule_code: ' + r.rule_code);
}
return [{ json: { rules, embedModel: req.config.embedModel } }];
