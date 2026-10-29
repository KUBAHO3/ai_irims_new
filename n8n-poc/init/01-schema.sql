-- Runs automatically the first time the postgres container starts.
CREATE EXTENSION IF NOT EXISTS vector;

-- Guidelines are stored as explicit rules (checked one by one),
-- NOT as embedded chunks, so no rule can be silently skipped.
CREATE TABLE guideline_rules (
  id         serial PRIMARY KEY,
  set_code   text NOT NULL,
  rule_code  text NOT NULL CHECK (rule_code ~ '^[A-Za-z0-9_.-]+$'),
  rule_text  text NOT NULL,
  severity   text NOT NULL CHECK (severity IN ('critical', 'major', 'minor')),
  guidance   text,
  version    text NOT NULL DEFAULT '1',
  active     boolean NOT NULL DEFAULT true,
  UNIQUE (set_code, rule_code)
);

-- Knowledge base: reference material retrieved by similarity.
-- vector(1024) matches the bge-m3 embedding model. Change it if you change the model.
CREATE TABLE kb_chunks (
  id          bigserial PRIMARY KEY,
  source      text NOT NULL,
  page        int,
  chunk_index int NOT NULL,
  content     text NOT NULL,
  embedding   vector(1024) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kb_chunks_embedding_idx ON kb_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX kb_chunks_source_idx ON kb_chunks (source);

-- ILLUSTRATIVE sample rules for testing the flow only.
-- Replace with your real, approved guideline text.
INSERT INTO guideline_rules (set_code, rule_code, rule_text, severity, guidance) VALUES
('product-registration', 'GEN-001',
 'The application identifies the applicant (company name) and its physical address.',
 'critical', 'A P.O. Box alone is not a physical address.'),
('product-registration', 'GEN-002',
 'The product name, strength and dosage form are stated.',
 'major', 'All three elements must be present, e.g. "Paracetamol 500 mg tablets".'),
('product-registration', 'MFG-001',
 'The manufacturer name and manufacturing site address are stated, and a valid GMP certificate is referenced.',
 'critical', 'The GMP certificate must not be expired at the date of submission.'),
('product-registration', 'LBL-001',
 'The proposed label states the storage conditions, including a temperature range.',
 'major', 'Wording such as "Store below 30°C" is acceptable; "store properly" is not.'),
('product-registration', 'LBL-002',
 'The proposed label states the shelf life or expiry date format.',
 'major', NULL),
('product-registration', 'QC-001',
 'A certificate of analysis for at least one batch of the finished product is included or referenced.',
 'major', 'The certificate should show the batch number and test results against specifications.');
