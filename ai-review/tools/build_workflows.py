#!/usr/bin/env python3
"""Builds the n8n workflow files in ../workflows from the Code node sources in ../src.

Edit the JavaScript in src/, then run:  python3 tools/build_workflows.py
The JSON files are what you import into n8n (GUIDE.md step 4).
"""
import json
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
OUT = ROOT / 'workflows'
NS = uuid.UUID('6f1c6a52-3f7e-4d0b-9b8e-6a1d2c9e0a11')

# Credentials are referenced by name; after import you pick your own in each node (GUIDE.md step 5).
CRED_DB = {'postgres': {'id': 'airevPostgres001', 'name': 'AI review database'}}
CRED_API = {'httpHeaderAuth': {'id': 'airevApiKey00001', 'name': 'AI review API key'}}
CRED_CALLBACK = {'httpHeaderAuth': {'id': 'airevCallback001', 'name': 'Portal callback key'}}
CRED_OPENAI = {'openAiApi': {'id': 'airevOpenAi00001', 'name': 'OpenAI account'}}

WF_IDS = {
    'kb': 'aiRevKnowledge01', 'rules': 'aiRevRulesApi001', 'propose': 'aiRevPropose0001',
    'analyze': 'aiRevAnalyze0001', 'get': 'aiRevGetResult01', 'errors': 'aiRevErrors00001',
}


def js(*files):
    return '\n\n'.join((SRC / f).read_text().strip() for f in files) + '\n'


class Flow:
    def __init__(self, key, name):
        self.key, self.name, self.nodes, self.conn = key, name, [], {}
        self.settings = {'executionOrder': 'v1'}

    def add(self, name, type_, version, params, pos, **extra):
        node = {'id': str(uuid.uuid5(NS, f'{self.key}/{name}')), 'name': name, 'type': type_, 'typeVersion': version,
                'position': list(pos), 'parameters': params}
        node.update(extra)
        self.nodes.append(node)
        return name

    def link(self, a, b, out=0):
        outs = self.conn.setdefault(a, {'main': []})['main']
        while len(outs) <= out:
            outs.append([])
        outs[out].append({'node': b, 'type': 'main', 'index': 0})

    def chain(self, *names):
        for a, b in zip(names, names[1:]):
            self.link(a, b)

    def save(self):
        data = {'id': WF_IDS[self.key], 'name': self.name, 'nodes': self.nodes, 'connections': self.conn,
                'active': False, 'settings': self.settings, 'pinData': {}, 'meta': {'templateCredsSetupCompleted': False}}
        path = OUT / f'{list(WF_IDS).index(self.key) + 1:02d}-{self.key}.json'
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
        print('wrote', path.relative_to(ROOT))

    # ---- node helpers -------------------------------------------------------
    def webhook(self, name, method, path, pos):
        return self.add(name, 'n8n-nodes-base.webhook', 2, {
            'httpMethod': method, 'path': path, 'authentication': 'headerAuth', 'responseMode': 'responseNode', 'options': {},
        }, pos, webhookId=str(uuid.uuid5(NS, f'webhook/{self.key}/{name}')), credentials=CRED_API)

    def code(self, name, source, pos, **extra):
        return self.add(name, 'n8n-nodes-base.code', 2, {'jsCode': source}, pos, **extra)

    def if_(self, name, expr, pos):
        return self.add(name, 'n8n-nodes-base.if', 2.2, {
            'conditions': {
                'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 2},
                'conditions': [{'id': str(uuid.uuid5(NS, f'if/{self.key}/{name}')), 'leftValue': expr, 'rightValue': '',
                                'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}],
                'combinator': 'and',
            },
            'options': {},
        }, pos)

    def postgres(self, name, query, pos, params=None, once=False, batching=None):
        options = {}
        if params:
            options['queryReplacement'] = params
        if batching:
            options['queryBatching'] = batching
        extra = {'alwaysOutputData': True, 'credentials': CRED_DB}
        if once:
            extra['executeOnce'] = True
        return self.add(name, 'n8n-nodes-base.postgres', 2.8, {'operation': 'executeQuery', 'query': query, 'options': options}, pos, **extra)

    def tika(self, name, pos):
        return self.add(name, 'n8n-nodes-base.httpRequest', 4.2, {
            'method': 'PUT', 'url': 'http://tika:9998/tika/html',
            'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'Accept', 'value': 'text/html'}]},
            'sendBody': True, 'contentType': 'binaryData', 'inputDataFieldName': 'data',
            'options': {'timeout': 300000, 'response': {'response': {'responseFormat': 'text', 'outputPropertyName': 'data'}}},
        }, pos)

    def ollama(self, name, endpoint, config_node, body_expr, pos, one_at_a_time=False):
        options = {'timeout': 900000}
        if one_at_a_time:
            options['batching'] = {'batch': {'batchSize': 1, 'batchInterval': 0}}
        return self.add(name, 'n8n-nodes-base.httpRequest', 4.2, {
            'method': 'POST', 'url': f"={{{{ $('{config_node}').first().json.config.ollamaUrl }}}}/api/{endpoint}",
            'sendBody': True, 'specifyBody': 'json', 'jsonBody': body_expr, 'options': options,
        }, pos)

    def llm(self, name, config_node, pos):
        """The model call: a switch on CONFIG.llmProvider in front of an OpenAI node and an Ollama node.
        Returns (switch, openai, ollama) node names; connect both model nodes to the next step."""
        switch = self.if_(f'Use OpenAI?', f"={{{{ $('{config_node}').first().json.config.llmProvider === 'openai' }}}}", pos)
        body = '={{ JSON.stringify($json.request) }}'
        # A failed call becomes an error item (reported as "unclear") instead of failing the whole run.
        common = dict(retryOnFail=True, maxTries=3, waitBetweenTries=5000, onError='continueRegularOutput')
        openai = self.add(f'{name} (OpenAI)', 'n8n-nodes-base.httpRequest', 4.2, {
            'method': 'POST', 'url': 'https://api.openai.com/v1/chat/completions',
            'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'openAiApi',
            'sendBody': True, 'specifyBody': 'json', 'jsonBody': body,
            'options': {'timeout': 120000, 'batching': {'batch': {'batchSize': 4, 'batchInterval': 500}}},
        }, (pos[0] + 240, pos[1] - 100), credentials=CRED_OPENAI, **common)
        ollama = self.add(f'{name} (Ollama)', 'n8n-nodes-base.httpRequest', 4.2, {
            'method': 'POST', 'url': f"={{{{ $('{config_node}').first().json.config.ollamaUrl }}}}/api/chat",
            'sendBody': True, 'specifyBody': 'json', 'jsonBody': body,
            'options': {'timeout': 900000, 'batching': {'batch': {'batchSize': 1, 'batchInterval': 0}}},
        }, (pos[0] + 240, pos[1] + 100), **common)
        self.link(switch, openai)
        self.link(switch, ollama, 1)
        return switch, openai, ollama

    def respond(self, name, pos, body='={{ JSON.stringify($json.body) }}', code='={{ $json.code || 200 }}'):
        return self.add(name, 'n8n-nodes-base.respondToWebhook', 1.1, {
            'respondWith': 'text', 'responseBody': body,
            'options': {'responseCode': code, 'responseHeaders': {'entries': [{'name': 'Content-Type', 'value': 'application/json'}]}},
        }, pos)

    def bad_request(self, name, pos):
        return self.respond(name, pos, body="={{ JSON.stringify({ message: 'Invalid request', errors: $json.errors }) }}", code=400)


def x(i, y=0):
    return (i * 240, y)


def knowledge_base():
    f = Flow('kb', 'AI review - 1. Knowledge base')
    f.chain(
        f.webhook('Webhook POST /ai/kb/documents', 'POST', 'ai/kb/documents', x(0)),
        f.code('Validate upload', js('kb_validate.js'), x(1)),
        f.if_('Valid?', '={{ $json.valid }}', x(2)),
    )
    f.link('Valid?', f.bad_request('Respond 400', x(3, 200)), 1)
    f.link('Valid?', f.tika('Extract text (Tika)', x(3)))
    f.chain(
        'Extract text (Tika)',
        f.code('Split into chunks', js('shared_text.js', 'kb_split.js'), x(4)),
        f.ollama('Embed chunks', 'embed', 'Validate upload', '={{ JSON.stringify({ model: $json.model, input: $json.input }) }}', x(5)),
        f.code('Build SQL', js('kb_build_sql.js'), x(6)),
        f.postgres('Store in knowledge base', '={{ $json.sql }}', x(7)),
        f.code('Build response', js('kb_respond.js'), x(8)),
        f.respond('Respond 201', x(9), code=201),
    )
    f.chain(
        f.webhook('Webhook GET /ai/kb/documents', 'GET', 'ai/kb/documents', x(0, 400)),
        f.postgres('List documents', """SELECT COALESCE(json_agg(json_build_object(
  'documentId', d.id, 'sourceKey', d.source_key, 'title', d.title, 'kind', d.kind, 'productTypes', d.product_types,
  'requirementIds', d.requirement_ids, 'version', d.version, 'fileName', d.file_name, 'pages', d.pages, 'active', d.active,
  'chunks', (SELECT count(*) FROM kb_chunks c WHERE c.document_id = d.id), 'updatedAt', d.updated_at) ORDER BY d.title), '[]'::json) AS body
FROM kb_documents d;""", x(1, 400)),
        f.respond('Respond with list', x(2, 400)),
    )
    f.save()


def rules_api():
    f = Flow('rules', 'AI review - 2. Rules')
    f.chain(
        f.webhook('Webhook POST /ai/rules', 'POST', 'ai/rules', x(0)),
        f.code('Validate rules', js('rules_upsert.js'), x(1)),
        f.if_('Valid?', '={{ $json.valid }}', x(2)),
    )
    f.link('Valid?', f.bad_request('Respond 400', x(3, 200)), 1)
    f.link('Valid?', f.postgres('Save rules', '={{ $json.sql }}', x(3)))
    f.chain('Save rules', f.code('Build response', js('rules_upsert_respond.js'), x(4)), f.respond('Respond', x(5)))
    f.chain(
        f.webhook('Webhook GET /ai/rules', 'GET', 'ai/rules', x(0, 400)),
        f.code('Read filters', js('rules_list.js'), x(1, 400)),
        f.postgres('List rules', """SELECT COALESCE(json_agg(json_build_object(
  'code', r.rule_code, 'text', r.rule_text, 'severity', r.severity, 'guidance', r.guidance, 'productTypes', r.product_types,
  'requirementIds', r.requirement_ids, 'status', r.status, 'version', r.version, 'sourceDocument', d.source_key, 'updatedAt', r.updated_at
) ORDER BY r.status, r.rule_code), '[]'::json) AS body
FROM guideline_rules r LEFT JOIN kb_documents d ON d.id = r.source_document_id
WHERE ($1 = '' OR r.status = $1)
  AND ($2 = '' OR cardinality(r.product_types) = 0 OR $2 = ANY(r.product_types))
  AND ($3 = '' OR cardinality(r.requirement_ids) = 0 OR $3 = ANY(r.requirement_ids));""", x(2, 400), params='={{ $json.params }}'),
        f.respond('Respond with list', x(3, 400)),
    )
    f.save()


def propose_rules():
    f = Flow('propose', 'AI review - 3. Propose rules from a document')
    f.chain(
        f.webhook('Webhook POST /ai/rules/propose', 'POST', 'ai/rules/propose', x(0)),
        f.code('Validate request', js('propose_validate.js'), x(1)),
        f.if_('Valid?', '={{ $json.valid }}', x(2)),
    )
    f.link('Valid?', f.bad_request('Respond 400', x(3, 200)), 1)
    f.link('Valid?', f.postgres('Load document', """SELECT d.id AS document_id, d.title, d.kind, d.product_types, d.requirement_ids, c.page, c.content
FROM kb_documents d JOIN kb_chunks c ON c.document_id = d.id
WHERE d.source_key = $1
ORDER BY c.chunk_index;""", x(3), params='={{ [$json.sourceKey] }}'))
    f.chain('Load document', f.code('Batch chunks', js('propose_batch.js'), x(4)), f.if_('Found?', '={{ $json.found }}', x(5)))
    f.link('Found?', f.respond('Respond 404', x(6, 200), body="={{ JSON.stringify({ message: 'No document with that sourceKey. Upload it first.' }) }}", code=404), 1)
    f.link('Found?', f.respond('Respond 202', x(6), code=202,
                               body="={{ JSON.stringify({ status: 'started', sourceKey: $('Validate request').first().json.sourceKey, batches: $json.of, chunksRead: $json.chunksRead, chunksTotal: $json.chunksTotal, next: 'GET /webhook/ai/rules?status=proposed when it finishes' }) }}"))
    switch, openai, ollama = f.llm('Propose rules', 'Validate request', x(8))
    f.chain('Respond 202', f.code('Build prompts', js('llm.js', 'propose_prompts.js'), x(7)), switch)
    check = f.code('Check proposals', js('llm.js', 'propose_save.js'), x(10))
    f.link(openai, check)
    f.link(ollama, check)
    f.chain(check, f.postgres('Save proposed rules', '={{ $json.sql }}', x(11)))
    f.save()


def analyze():
    f = Flow('analyze', 'AI review - 4. Analyze submission')
    f.settings['errorWorkflow'] = WF_IDS['errors']
    f.chain(
        f.webhook('Webhook POST /ai/analyses', 'POST', 'ai/analyses', x(0)),
        f.code('Validate request', js('analyze_validate.js'), x(1)),
        f.if_('Valid?', '={{ $json.valid }}', x(2)),
    )
    f.link('Valid?', f.bad_request('Respond 400', x(3, 200)), 1)
    f.link('Valid?', f.postgres('Create analysis record', """INSERT INTO analyses (status, application_ref, product_type, request, callback_url, execution_id)
VALUES ('running', $1, $2, $3::jsonb, NULLIF($4, ''), $5)
RETURNING id;""", x(3), params='={{ [$json.applicationRef, $json.productType, JSON.stringify($json.request), $json.callbackUrl, $execution.id] }}'))
    f.chain(
        'Create analysis record',
        f.respond('Respond 202', x(4), code=202,
                  body="={{ JSON.stringify({ analysisId: $json.id, status: 'running', statusUrl: '/webhook/ai/analyses?id=' + $json.id }) }}"),
        f.code('Prepare documents', js('analyze_prepare.js'), x(5)),
        f.tika('Extract text (Tika)', x(6)),
        f.code('Split into chunks', js('shared_text.js', 'analyze_split.js'), x(7)),
        f.ollama('Embed submission', 'embed', 'Validate request', '={{ JSON.stringify({ model: $json.model, input: $json.input }) }}', x(8)),
        f.postgres('Load rules', """SELECT rule_code, rule_text, severity, COALESCE(guidance, '') AS guidance, requirement_ids, version
FROM guideline_rules
WHERE status = 'active' AND (cardinality(product_types) = 0 OR $1 = ANY(product_types))
ORDER BY rule_code;""", x(9), params="={{ [$('Validate request').first().json.productType] }}", once=True),
        f.code('Scope rules', js('analyze_scope.js'), x(10)),
        f.if_('Any rules to evaluate?', '={{ $json.evaluate.length > 0 }}', x(11)),
    )
    f.link('Any rules to evaluate?', f.ollama('Embed rules', 'embed', 'Validate request', '={{ JSON.stringify({ model: $json.model, input: $json.input }) }}', x(12)))
    f.chain(
        'Embed rules',
        f.code('Select evidence', js('analyze_evidence.js'), x(13)),
        f.postgres('Search knowledge base', """WITH q AS (SELECT '{{ $json.ruleVec }}'::vector AS v)
SELECT '{{ $json.ruleCode }}' AS rule_code, COALESCE(json_agg(t ORDER BY t.distance), '[]'::json) AS kb
FROM (
  SELECT 'K' || c.id AS id, d.title, d.source_key, d.kind, c.page, c.content AS text,
         round((c.embedding <=> q.v)::numeric, 4) AS distance
  FROM kb_chunks c JOIN kb_documents d ON d.id = c.document_id, q
  WHERE d.active
    AND (cardinality(d.product_types) = 0 OR '{{ $('Validate request').first().json.productType }}' = ANY(d.product_types))
    AND (cardinality(d.requirement_ids) = 0 OR d.requirement_ids && {{ $json.reqArray }})
  ORDER BY c.embedding <=> q.v
  LIMIT {{ $('Validate request').first().json.config.topKKb }}
) t;""", x(14), batching='independently'),
        f.code('Build prompts', js('llm.js', 'analyze_prompts.js'), x(15)),
    )
    switch, openai, ollama = f.llm('Evaluate rule', 'Validate request', x(16))
    f.link('Build prompts', switch)
    check = f.code('Validate findings', js('llm.js', 'analyze_findings.js'), x(18))
    f.link(openai, check)
    f.link(ollama, check)
    f.chain(check, f.code('Build report', js('analyze_report.js'), x(19)))
    f.link('Any rules to evaluate?', 'Build report', 1)
    f.chain(
        'Build report',
        f.postgres('Save result', """UPDATE analyses SET status = 'completed', result = $1::jsonb, finished_at = now()
WHERE id = $2::uuid
RETURNING id, COALESCE(callback_url, '') AS callback_url;""", x(20), params='={{ [$json.resultJson, $json.analysisId] }}'),
        f.if_('Callback URL given?', "={{ $json.callback_url !== '' }}", x(21)),
    )
    f.link('Callback URL given?', f.add('Send result to portal', 'n8n-nodes-base.httpRequest', 4.2, {
        'method': 'POST', 'url': '={{ $json.callback_url }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpHeaderAuth',
        'sendBody': True, 'specifyBody': 'json', 'jsonBody': "={{ $('Build report').first().json.resultJson }}", 'options': {'timeout': 30000},
    }, x(22), credentials=CRED_CALLBACK, retryOnFail=True, maxTries=3, waitBetweenTries=5000, onError='continueRegularOutput'))
    f.save()


def get_result():
    f = Flow('get', 'AI review - 5. Get analysis result')
    f.chain(
        f.webhook('Webhook GET /ai/analyses', 'GET', 'ai/analyses', x(0)),
        f.postgres('Load analysis', """SELECT id, status, application_ref, product_type, result, error, created_at, finished_at
FROM analyses WHERE id::text = $1;""", x(1), params="={{ [String($json.query.id || '')] }}"),
        f.code('Build response', js('get_analysis.js'), x(2)),
        f.respond('Respond', x(3)),
    )
    f.save()


def errors():
    f = Flow('errors', 'AI review - 6. Analysis failures')
    f.chain(
        f.add('When an analysis fails', 'n8n-nodes-base.errorTrigger', 1, {}, x(0)),
        f.postgres('Mark analysis failed', """UPDATE analyses SET status = 'failed', error = $1, finished_at = now()
WHERE execution_id = $2 AND status = 'running'
RETURNING id, COALESCE(callback_url, '') AS callback_url, application_ref, product_type, error;""", x(1),
                   params="={{ [($json.execution.lastNodeExecuted ? $json.execution.lastNodeExecuted + ': ' : '') + ($json.execution.error && $json.execution.error.message || 'Unknown error'), String($json.execution.id)] }}"),
        f.if_('Callback URL given?', "={{ !!$json.id && $json.callback_url !== '' }}", x(2)),
    )
    f.link('Callback URL given?', f.add('Tell the portal', 'n8n-nodes-base.httpRequest', 4.2, {
        'method': 'POST', 'url': '={{ $json.callback_url }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpHeaderAuth',
        'sendBody': True, 'specifyBody': 'json',
        'jsonBody': "={{ JSON.stringify({ analysisId: $json.id, status: 'failed', applicationRef: $json.application_ref, productType: $json.product_type, error: $json.error }) }}",
        'options': {'timeout': 30000},
    }, x(3), credentials=CRED_CALLBACK, retryOnFail=True, maxTries=3, waitBetweenTries=5000, onError='continueRegularOutput'))
    f.save()


if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    for build in (knowledge_base, rules_api, propose_rules, analyze, get_result, errors):
        build()
