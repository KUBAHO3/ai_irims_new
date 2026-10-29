/* Reference data. Product types, fees and timelines are ILLUSTRATIVE (carried over from the
   prototype): replace them with Rwanda FDA's official values. */
import type { ProductType, Stage } from './types';

export interface ProductTypeInfo {
  name: string;
  short: string;
  categories: string[];
  forms: string[];
  sizeLabel: string;
  fee: number;
  timeline: string;
}

export const TYPES: Record<ProductType, ProductTypeInfo> = {
  HM: { name: 'Human medicines', short: 'Human medicine', categories: ['Prescription-only medicine', 'Over-the-counter medicine', 'Herbal medicine', 'Biological product'], forms: ['Tablet', 'Capsule', 'Oral suspension', 'Syrup', 'Injection', 'Cream or ointment', 'Other'], sizeLabel: 'Strength', fee: 1500000, timeline: 'up to 12 months' },
  VM: { name: 'Veterinary medicines', short: 'Veterinary medicine', categories: ['Prescription veterinary medicine', 'Over-the-counter veterinary medicine', 'Vaccine', 'Feed additive'], forms: ['Tablet', 'Oral solution', 'Injection', 'Powder', 'Pour-on', 'Other'], sizeLabel: 'Strength', fee: 900000, timeline: 'up to 9 months' },
  PF: { name: 'Food products', short: 'Food', categories: ['Pre-packaged food', 'Food supplements', 'Fortified foods', 'Bottled water and beverages'], forms: ['Powder', 'Liquid', 'Solid', 'Capsule or tablet', 'Other'], sizeLabel: 'Net content', fee: 300000, timeline: 'up to 90 days' },
  CO: { name: 'Cosmetics', short: 'Cosmetic', categories: ['Skin care', 'Hair care', 'Oral care', 'Fragrances', 'Make-up'], forms: ['Cream', 'Lotion', 'Gel', 'Powder', 'Liquid', 'Other'], sizeLabel: 'Net content', fee: 250000, timeline: 'up to 90 days' },
  MD: { name: 'Medical devices', short: 'Medical device', categories: ['Class A (low risk)', 'Class B (low to moderate risk)', 'Class C (moderate to high risk)', 'Class D (high risk)'], forms: ['Instrument', 'Implant', 'In-vitro diagnostic', 'Software', 'Consumable', 'Other'], sizeLabel: 'Model or size', fee: 600000, timeline: 'up to 6 months' },
};
export const PRODUCT_TYPES = Object.keys(TYPES) as ProductType[];

/** Conditions under which a document is required. Evaluated by `docsFor`. */
export type DocCondition = 'trademarkDiffers' | 'reliance';
export const CONDITION_LABEL: Record<DocCondition, string> = {
  trademarkDiffers: 'if the trademark holder is not the manufacturer',
  reliance: 'if registered by a reference regulatory authority',
};

export interface DocRequirement {
  id: string;
  name: string;
  req: boolean;
  group: string;
  /** Several files may be uploaded against this requirement (e.g. a CTD module). */
  multiple?: boolean;
  when?: DocCondition;
  hint?: string;
}

const ADMIN = 'Administrative documents';
const RELIANCE = 'Reliance on a reference regulatory authority';
const CTD = 'Common Technical Document (CTD) dossier';
const PRODUCT = 'Product documents';
const OTHER = 'Other';

export const COMMON_DOCS: DocRequirement[] = [
  { id: 'cover', name: 'Cover letter signed by the applicant', req: true, group: ADMIN },
  { id: 'poa', name: 'Notarized power of attorney from the manufacturer or market authorization holder to the local technical representative', req: true, group: ADMIN },
  { id: 'ltrletter', name: 'Letter appointing the local technical representative, if the applicant is not the manufacturer', req: false, group: ADMIN },
  { id: 'tm', name: 'Notarized agreement between trademark holder and manufacturer', req: true, when: 'trademarkDiffers', group: ADMIN },
];

export const TYPE_DOCS: Record<ProductType, DocRequirement[]> = {
  HM: [
    { id: 'sameness', name: 'Declaration of sameness', req: true, when: 'reliance', group: RELIANCE, hint: 'Confirms the product is the same as the one approved by the reference regulatory authority.' },
    { id: 'rra-gmp', name: 'Good Manufacturing Practice (GMP) certificate issued by the reference regulatory authority', req: true, when: 'reliance', group: RELIANCE },
    { id: 'rra-auth', name: 'Letter of authorization permitting the reference regulatory authority to share relevant information with Rwanda FDA', req: true, when: 'reliance', group: RELIANCE },
    { id: 'm1', name: 'Module 1: Administrative information and prescribing information', req: true, multiple: true, group: CTD },
    { id: 'm2', name: 'Module 2: Common technical document summaries', req: true, multiple: true, group: CTD },
    { id: 'm3', name: 'Module 3: Quality (pharmaceutical documentation)', req: true, multiple: true, group: CTD },
    { id: 'm4', name: 'Module 4: Non-clinical study reports', req: true, multiple: true, group: CTD },
    { id: 'm5', name: 'Module 5: Clinical studies', req: true, multiple: true, group: CTD },
    { id: 'other', name: 'Other documents', req: false, multiple: true, group: OTHER },
  ],
  VM: [
    { id: 'gmp', name: 'Valid GMP certificate of the manufacturing site', req: true, group: PRODUCT },
    { id: 'coa', name: 'Certificate of analysis of the finished product (one batch)', req: true, group: PRODUCT },
    { id: 'spc', name: 'Summary of product characteristics and package insert', req: true, group: PRODUCT },
    { id: 'wd', name: 'Withdrawal period justification (food-producing animals)', req: false, group: PRODUCT },
  ],
  PF: [
    { id: 'fsc', name: 'Food safety certificate of the manufacturing site (e.g. HACCP, ISO 22000)', req: true, group: PRODUCT },
    { id: 'coa', name: 'Certificate of analysis of the product', req: true, group: PRODUCT },
    { id: 'comp', name: 'Product composition and formulation', req: true, group: PRODUCT },
    { id: 'fsale', name: 'Free sale certificate from the country of origin (imported products)', req: false, group: PRODUCT },
  ],
  CO: [
    { id: 'gmp', name: 'Cosmetics GMP certificate (ISO 22716) or equivalent', req: true, group: PRODUCT },
    { id: 'inci', name: 'Full ingredient list with INCI names and percentages', req: true, group: PRODUCT },
    { id: 'coa', name: 'Certificate of analysis of the product', req: true, group: PRODUCT },
    { id: 'safety', name: 'Product safety assessment report', req: true, group: PRODUCT },
  ],
  MD: [
    { id: 'iso', name: 'ISO 13485 certificate of the manufacturer', req: true, group: PRODUCT },
    { id: 'doc', name: 'Declaration of conformity', req: true, group: PRODUCT },
    { id: 'tech', name: 'Technical file summary', req: true, group: PRODUCT },
    { id: 'ifu', name: 'Instructions for use', req: true, group: PRODUCT },
  ],
};

/** Requirement ids reserved for files that are not dossier documents. */
export const ARTWORK_ID = 'artwork';
export const PAYMENT_PROOF_ID = 'payment-proof';
export const QUERY_FILE_ID = 'query';

export const ALLOWED_UPLOAD_EXT = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx', '.xls', '.xlsx', '.zip'];

export const LTRS = ['Imaginary Pharma Ltd (own licence)', 'Nyabugogo Pharmacy Wholesale Ltd', 'Kigali Regulatory Partners Ltd', 'Huye Medical Distributors Ltd'];
export const COUNTRIES = ['Rwanda', 'Kenya', 'Uganda', 'Tanzania', 'India', 'China', 'South Africa', 'Egypt', 'Belgium', 'Germany', 'France', 'United Kingdom', 'United States', 'Other'];
export const REFERENCE_AUTHORITIES = [
  'European Medicines Agency (EMA)',
  'US Food and Drug Administration (US FDA)',
  'Medicines and Healthcare products Regulatory Agency (MHRA, UK)',
  'Swissmedic',
  'Health Canada',
  'Therapeutic Goods Administration (TGA, Australia)',
  'WHO Prequalification',
  'EAC joint assessment',
  'Other WHO-listed authority',
];
export const INTENDED_USERS = ['Adults', 'Children', 'Adults and children over 12', 'Children and adults', 'Animals', 'Healthcare professionals', 'Everyone'];
export const LABEL_LANGUAGES = ['English', 'French', 'Kinyarwanda'];
export const ACCOUNT_TYPES = ['Local registered company', 'Foreign company', 'Local technical representative', 'Individual'];
export const HELPDESK_TOPICS = ['Problem with an application', 'Payment or invoice', 'Account and sign in', 'Something else'];

export const RAIL = ['Draft', 'Payment', 'Verification', 'Screening', 'Assessment', 'Approval', 'Decision'];
export const STAGE_INDEX: Record<Stage, number> = { draft: 0, payment: 1, verification: 2, screening: 3, assessment: 4, approval: 5, decision: 6 };
export const STAGE_NAME: Record<Stage, string> = { draft: 'Draft', payment: 'Payment', verification: 'Payment verification', screening: 'Screening', assessment: 'Assessment', approval: 'Approval', decision: 'Decision' };
/** Service-level days per stage (and for answering a query). */
export const SLA: Record<string, number> = { payment: 30, verification: 3, screening: 14, assessment: 60, approval: 7, queried: 30 };
export const FDA_STAGES: Stage[] = ['verification', 'screening', 'assessment', 'approval'];
export const CERT_VALID_YEARS = 5;

export const SERVICES = [
  { icon: 'pill', name: 'Product registration (market authorization)', text: 'Medicines, food, cosmetics, veterinary products and medical devices.', live: true },
  { icon: 'store', name: 'Premises licensing', text: 'Licences to operate pharmacies, wholesalers, manufacturers and food premises.', live: false },
  { icon: 'globe', name: 'Import and export permits', text: 'Permits to import or export medicines and allied products.', live: false },
  { icon: 'flask', name: 'Clinical trial authorization', text: 'Approval to conduct clinical trials in Rwanda.', live: false },
  { icon: 'megaphone', name: 'Promotion and advertising', text: 'Approval of promotional and advertising material.', live: false },
  { icon: 'box', name: 'Personal imports', text: 'Importation of medicines and products for personal use.', live: false },
] as const;

export const STEPS = [
  { t: 'Product details', s: 'Name, form, use and storage' },
  { t: 'Manufacturer and representative', s: 'Who makes it and who represents it' },
  { t: 'Dossier documents', s: 'Upload the required files' },
  { t: 'Label and artwork', s: 'Label as it will be sold' },
  { t: 'Review and submit', s: 'Check, declare and submit' },
];
