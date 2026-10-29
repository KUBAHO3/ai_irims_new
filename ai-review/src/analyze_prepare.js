// One item per document: uploaded files, plus the form fields and label text as virtual documents.
const v = $('Validate request').first().json;
const bins = $('Webhook POST /ai/analyses').first().binary || {};
const items = [];
const inline = (requirementId, fileName, text) => items.push({
  json: { requirementId, fileName },
  binary: { data: { data: Buffer.from(text, 'utf8').toString('base64'), mimeType: 'text/plain', fileName } },
});

const lines = Object.entries(v.fields).map(([k, val]) => `${k}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
if (lines.length) inline('application-form', 'application-form.txt', 'Application form\n' + lines.join('\n'));
if (v.labelText) inline('artwork', 'label-text.txt', 'Label text\n' + v.labelText);
for (const f of v.files) items.push({ json: { requirementId: f.requirementId, fileName: f.fileName }, binary: { data: bins[f.key] } });
return items;
