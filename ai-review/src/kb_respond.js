const meta = $('Validate upload').first().json;
const r = $input.first().json;
return [{ json: { body: {
  status: 'stored', documentId: Number(r.documentId), sourceKey: meta.sourceKey, title: meta.title, kind: meta.kind,
  productTypes: meta.productTypes, requirementIds: meta.requirementIds, version: meta.version,
  pages: $('Split into chunks').first().json.pages || null, chunksStored: r.chunksStored, replacedPreviousVersion: r.replaced,
} } }];
