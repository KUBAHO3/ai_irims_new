// Group the document's chunks into LLM-sized batches. The first row tells us whether the document exists.
const req = $('Validate request').first().json;
const rows = $input.all().map((i) => i.json).filter((r) => r && r.document_id);
if (!rows.length) return [{ json: { found: false } }];

const doc = { id: Number(rows[0].document_id), title: rows[0].title, kind: rows[0].kind, productTypes: rows[0].product_types || [], requirementIds: rows[0].requirement_ids || [] };
const batches = [];
let cur = null;
for (const r of rows.slice(0, req.maxChunks)) {
  if (!cur || cur.text.length + r.content.length > req.config.maxChars) { cur = { text: '', pages: new Set() }; batches.push(cur); }
  cur.text += (cur.text ? '\n\n' : '') + r.content;
  if (r.page) cur.pages.add(r.page);
}
return batches.map((b, i) => ({ json: { found: true, doc, batch: i + 1, of: batches.length, pages: [...b.pages], text: b.text, chunksRead: Math.min(rows.length, req.maxChunks), chunksTotal: rows.length } }));
