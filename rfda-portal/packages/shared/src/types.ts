export type ProductType = 'HM' | 'VM' | 'PF' | 'CO' | 'MD';
export type AppStatus = 'draft' | 'awaiting_payment' | 'in_review' | 'queried' | 'approved' | 'rejected';
export type Stage = 'draft' | 'payment' | 'verification' | 'screening' | 'assessment' | 'approval' | 'decision';
export type InvoiceStatus = 'unpaid' | 'proof_uploaded' | 'verified' | 'rejected';
export type Role = 'applicant' | 'assessor';
export type Party = 'applicant' | 'fda';

export interface UserDto {
  id: string;
  role: Role;
  email: string;
  name: string;
  customerNo: string | null;
  accountType: string | null;
  phone: string | null;
}

export interface FileDto {
  id: string;
  requirementId: string;
  queryId: string | null;
  name: string;
  size: number;
  at: string;
}

export interface InvoiceDto {
  no: string;
  amount: number;
  status: InvoiceStatus;
  issuedAt: string;
  proof: FileDto | null;
  momoRef: string | null;
}

export interface QueryDto {
  id: string;
  from: Party;
  stage: Stage;
  text: string;
  answered: boolean;
  at: string;
  files: FileDto[];
}

export interface HistoryDto {
  at: string;
  by: Party;
  action: string;
  note: string;
  stage: Stage;
}

/** Editable product fields of an application (wizard steps 1 and 2). */
export interface ProductFields {
  category: string;
  submissionType: string;
  brand: string;
  generic: string;
  form: string;
  size: string;
  intendedUse: string;
  intendedUsers: string;
  storage: string;
  shelfLife: string;
  description: string;
  warnings: string;
  mfrName: string;
  mfrCountry: string;
  mfrAddress: string;
  origin: string;
  srA: string;
  refAuthority: string;
  ltr: string;
  trademarkDiffers: boolean;
  labelText: string;
  labelLanguages: string[];
}

export const EDITABLE_FIELDS: (keyof ProductFields)[] = [
  'category', 'submissionType', 'brand', 'generic', 'form', 'size', 'intendedUse', 'intendedUsers', 'storage', 'shelfLife',
  'description', 'warnings', 'mfrName', 'mfrCountry', 'mfrAddress', 'origin', 'srA', 'refAuthority', 'ltr', 'trademarkDiffers',
  'labelText', 'labelLanguages',
];

export interface ApplicationDto extends ProductFields {
  id: string;
  ref: string;
  isDraft: boolean;
  type: ProductType;
  applicant: string;
  applicantAddress: string;
  status: AppStatus;
  stage: Stage;
  stageAt: string;
  step: number;
  queriedAt: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  certNo: string | null;
  expiresAt: string | null;
  recommendation: 'approve' | 'reject' | null;
  urgent: boolean;
  createdAt: string;
  updatedAt: string;
  files: FileDto[];
  invoice: InvoiceDto | null;
  queries: QueryDto[];
  history: HistoryDto[];
  /** Requirement ids ticked by the screening officer. */
  checks: string[];
}

/** Subset returned by public tracking. */
export interface TrackDto {
  ref: string;
  brand: string;
  type: ProductType;
  status: AppStatus;
  stage: Stage;
  stageAt: string;
  queriedAt: string | null;
  certNo: string | null;
  expiresAt: string | null;
  invoice: { no: string; amount: number } | null;
  queries: { from: Party; answered: boolean; at: string }[];
}

export type DecisionAction = 'pay-ok' | 'pay-bad' | 'accept' | 'query' | 'rec-approve' | 'rec-reject' | 'approve' | 'return' | 'reject';

/* ---------------------------------------------------------------- AI review (n8n service) */
export type AiFindingStatus = 'pass' | 'fail' | 'unclear' | 'not_applicable';

export interface AiFinding {
  ruleCode: string;
  rule: string;
  severity: 'critical' | 'major' | 'minor';
  requirementIds: string[];
  status: AiFindingStatus;
  confidence: number;
  explanation: string;
  suggestion: string;
  evidence: { chunkId: string; requirementId: string | null; document: string | null; page: number | null; quote: string; verified: boolean }[];
  kbReferences: { id: string; title: string; sourceKey: string; kind: string; page: number | null }[];
  checks: { parsed: boolean; notes: string[] };
}

/** The JSON the n8n "Analyze submission" workflow returns (see ai-review/GUIDE.md, step 8). */
export interface AiResult {
  analysisId: string;
  status: 'completed';
  overall: { verdict: 'compliant' | 'needs_review' | 'non_compliant'; counts: Record<string, number> };
  summary: string;
  findings: AiFinding[];
  skipped: { ruleCode: string; rule: string; severity: string; requirementIds: string[]; reason: string }[];
  documents: { requirementId: string; fileName: string; pages: number | null; characters: number; chunks: number; truncated: boolean; noText: boolean }[];
  trace: Record<string, unknown>;
}

export interface AiAnalysisDto {
  id: string;
  status: 'requesting' | 'running' | 'completed' | 'failed';
  stage: Stage;
  verdict: AiResult['overall']['verdict'] | null;
  summary: string | null;
  error: string | null;
  requestedBy: string;
  createdAt: string;
  finishedAt: string | null;
  /** Files left out because the request would exceed the AI service's upload limit. */
  notSent: { requirementId: string; fileName: string; size: number }[];
  result: AiResult | null;
}
