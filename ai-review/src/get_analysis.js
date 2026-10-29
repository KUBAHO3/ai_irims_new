const row = $input.first().json;
if (!row || !row.id) return [{ json: { code: 404, body: { message: 'Analysis not found' } } }];
const body = row.result || { analysisId: row.id, status: row.status, applicationRef: row.application_ref, productType: row.product_type };
if (row.status === 'failed') body.error = row.error;
body.createdAt = row.created_at;
body.finishedAt = row.finished_at;
return [{ json: { code: 200, body } }];
