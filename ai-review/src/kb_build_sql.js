// Upsert the document by sourceKey and replace all its chunks, in one statement.
const meta = $('Validate upload').first().json;
const { chunks, pages } = $('Split into chunks').first().json;
const vecs = $input.all().flatMap((i) => i.json.embeddings);
if (vecs.length !== chunks.length) throw new Error(`Got ${vecs.length} embeddings for ${chunks.length} chunks`);

const esc = (s) => "'" + String(s).replace(/\u0000/g, '').replace(/'/g, "''") + "'";
const arr = (a) => `ARRAY[${a.map(esc).join(',')}]::text[]`;

const values = chunks.map((c, i) => `(${Number.isInteger(c.page) ? c.page : 'NULL'}, ${c.chunkIndex}, ${esc(c.text)}, '[${vecs[i].join(',')}]')`);
const sql = `WITH doc AS (
  INSERT INTO kb_documents (source_key, title, kind, product_types, requirement_ids, version, file_name, pages, active, updated_at)
  VALUES (${esc(meta.sourceKey)}, ${esc(meta.title)}, ${esc(meta.kind)}, ${arr(meta.productTypes)}, ${arr(meta.requirementIds)}, ${esc(meta.version)}, ${esc(meta.fileName)}, ${pages || 'NULL'}, true, now())
  ON CONFLICT (source_key) DO UPDATE SET title = EXCLUDED.title, kind = EXCLUDED.kind, product_types = EXCLUDED.product_types,
    requirement_ids = EXCLUDED.requirement_ids, version = EXCLUDED.version, file_name = EXCLUDED.file_name, pages = EXCLUDED.pages,
    active = true, updated_at = now()
  RETURNING id, (xmax <> 0) AS replaced
), del AS (
  DELETE FROM kb_chunks WHERE document_id = (SELECT id FROM doc) RETURNING 1
), ins AS (
  INSERT INTO kb_chunks (document_id, page, chunk_index, content, embedding)
  SELECT (SELECT id FROM doc), v.page::int, v.idx::int, v.content, v.emb::vector
  FROM (VALUES ${values.join(',\n  ')}) AS v(page, idx, content, emb)
  RETURNING 1
)
SELECT (SELECT id FROM doc) AS "documentId", (SELECT replaced FROM doc) AS replaced,
       (SELECT count(*) FROM del)::int AS "chunksRemoved", (SELECT count(*) FROM ins)::int AS "chunksStored";`;

return [{ json: { sql } }];
