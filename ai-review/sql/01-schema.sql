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

-- Rules are loaded from rules/rfda-rules.json by tools/load-knowledge-base.sh (GUIDE.md step 6).
