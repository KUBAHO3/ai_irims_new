-- AI review service: knowledge base, rules and analyses.
-- Run once against the n8n stack's Postgres (database "aipoc"), see GUIDE.md step 2.
CREATE EXTENSION IF NOT EXISTS vector;

-- Every document fed into the knowledge base: guidelines, templates and other references.
CREATE TABLE IF NOT EXISTS kb_documents (
  id              bigserial PRIMARY KEY,
  source_key      text NOT NULL UNIQUE CHECK (source_key ~ '^[a-z0-9][a-z0-9_.-]{1,80}$'),
  title           text NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('guideline', 'template', 'reference')),
  product_types   text[] NOT NULL DEFAULT '{}',  -- e.g. {HM}; empty = all product types
  requirement_ids text[] NOT NULL DEFAULT '{}',  -- portal document requirements it covers, e.g. {rra-gmp}; empty = any
  version         text NOT NULL DEFAULT '1',
  file_name       text,
  pages           int,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Text chunks of those documents with their embeddings (the vector store).
-- vector(1024) matches the bge-m3 embedding model. Change both together.
CREATE TABLE IF NOT EXISTS kb_chunks (
  id          bigserial PRIMARY KEY,
  document_id bigint NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  page        int,
  chunk_index int NOT NULL,
  content     text NOT NULL,
  embedding   vector(1024) NOT NULL
);
CREATE INDEX IF NOT EXISTS kb_chunks_embedding_idx ON kb_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS kb_chunks_document_idx ON kb_chunks (document_id);

-- Rules are checked one by one, so none can be silently skipped.
-- "proposed" rules come from the LLM and are ignored until a person sets them to "active".
CREATE TABLE IF NOT EXISTS guideline_rules (
  id                 serial PRIMARY KEY,
  rule_code          text NOT NULL UNIQUE CHECK (rule_code ~ '^[A-Za-z0-9_.-]{1,40}$'),
  rule_text          text NOT NULL,
  severity           text NOT NULL CHECK (severity IN ('critical', 'major', 'minor')),
  guidance           text,
  product_types      text[] NOT NULL DEFAULT '{}',  -- empty = all product types
  requirement_ids    text[] NOT NULL DEFAULT '{}',  -- documents to look in; empty = every document sent
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('proposed', 'active', 'retired')),
  source_document_id bigint REFERENCES kb_documents(id) ON DELETE SET NULL,
  version            int NOT NULL DEFAULT 1,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- One row per analysis request: what was asked, what came back, for the audit trail.
CREATE TABLE IF NOT EXISTS analyses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status          text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  application_ref text NOT NULL,
  product_type    text NOT NULL,
  request         jsonb NOT NULL,
  result          jsonb,
  error           text,
  callback_url    text,
  execution_id    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);
CREATE INDEX IF NOT EXISTS analyses_ref_idx ON analyses (application_ref, created_at DESC);
CREATE INDEX IF NOT EXISTS analyses_execution_idx ON analyses (execution_id);

-- ILLUSTRATIVE starter rules so the flow can be tested. Replace them with approved Rwanda FDA rules.
-- requirement_ids use the portal's ids: application-form (the form fields), artwork (label),
-- sameness, rra-gmp, rra-auth, m1 ... m5, other, cover, poa, and so on.
INSERT INTO guideline_rules (rule_code, rule_text, severity, guidance, product_types, requirement_ids) VALUES
('APP-001', 'The application states the product name, strength and dosage form.', 'major',
 'All three must be present, e.g. "Paracetamol 500 mg tablets".', '{HM,VM}', '{application-form}'),
('LBL-001', 'The label states the storage conditions, including a temperature.', 'major',
 '"Store below 30°C" is acceptable; "store in a cool, dry place" is not.', '{}', '{artwork}'),
('LBL-002', 'The label shows an expiry date or its format (e.g. EXP: MM/YYYY).', 'major', NULL, '{}', '{artwork}'),
('LBL-003', 'The storage conditions on the label match the storage conditions in the application.', 'major',
 'Compare the temperature in both. Different temperatures are a fail.', '{}', '{application-form,artwork}'),
('REL-001', 'The declaration of sameness states that the product is the same as the one approved by the reference regulatory authority, including formulation and manufacturing site.', 'critical',
 NULL, '{HM}', '{sameness}'),
('REL-002', 'The GMP certificate is issued by the reference regulatory authority, names the manufacturing site, and is valid on the analysis date.', 'critical',
 'Compare the certificate''s expiry date with the analysis date given in the prompt.', '{HM}', '{rra-gmp}'),
('REL-003', 'The letter of authorization allows the reference regulatory authority to share information about the product with Rwanda FDA.', 'major',
 NULL, '{HM}', '{rra-auth}'),
('CTD-001', 'Module 1 includes the summary of product characteristics or prescribing information.', 'major', NULL, '{HM}', '{m1}'),
('CTD-003', 'Module 3 includes stability data that supports the proposed shelf life.', 'major', NULL, '{HM}', '{m3}')
ON CONFLICT (rule_code) DO NOTHING;
