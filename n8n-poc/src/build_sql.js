// Re-ingesting a source replaces its previous chunks (single statement).
const chunks = $('Split into chunks').first().json.chunks;
const vecs = $input.first().json.embeddings;
const esc = s => "'" + String(s).replace(/\u0000/g, '').replace(/'/g, "''") + "'";

const sources = [...new Set(chunks.map(c => c.source))];
const values = chunks.map((c, i) =>
  `(${esc(c.source)}, ${Number.isInteger(c.page) ? c.page : 'NULL'}, ${c.chunkIndex}, ${esc(c.text)}, '[${vecs[i].join(',')}]'::vector)`
);

const sql = `WITH del AS (
  DELETE FROM kb_chunks WHERE source IN (${sources.map(esc).join(', ')}) RETURNING 1
), ins AS (
  INSERT INTO kb_chunks (source, page, chunk_index, content, embedding) VALUES
  ${values.join(',\n  ')}
  RETURNING 1
)
SELECT (SELECT count(*) FROM del) AS deleted, (SELECT count(*) FROM ins) AS inserted;`;

return [{ json: { sql, sources } }];
