/* Demo data, ported from the prototype. Wipes every table first: never run against production. */
import 'dotenv/config';
import { AppStatus, Party, PrismaClient, ProductType, Stage } from '@prisma/client';
import { ARTWORK_ID, LTRS, PAYMENT_PROOF_ID, TYPES, docsFor } from '@rfda/shared';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { documentLines, Issue, textPdf } from './seed-documents';

const prisma = new PrismaClient();
const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR || './uploads');
const DAY = 86400000;
const NOW = Date.now();
const ago = (days: number) => new Date(NOW - days * DAY);

export const DEMO = {
  applicant: { email: 'regulatory@imaginary-pharma.example', customerNo: '40112', password: 'Applicant#2026' },
  assessor: { email: 'assessor@rfda.example', password: 'Assessor#2026' },
};

/** Stores a demo PDF with the given text and returns the StoredFile fields. */
function storeDoc(name: string, lines: string[]) {
  const storedName = `seed-${randomUUID()}.pdf`;
  const buf = textPdf(lines);
  writeFileSync(resolve(UPLOAD_DIR, storedName), buf);
  return { originalName: name, storedName, mimeType: 'application/pdf', size: buf.length };
}

type H = [days: number, by: Party, action: string, note?: string, stage?: Stage];

interface SeedApp {
  ref: string; owner: string; applicant: string; applicantAddress: string; type: ProductType; category: string;
  brand: string; generic: string; form: string; size: string; intendedUse: string; intendedUsers?: string; storage: string; shelfLife: string;
  description?: string; warnings?: string; mfrName: string; mfrCountry: string; mfrAddress?: string; origin: string; srA?: string; refAuthority?: string;
  status: AppStatus; stage: Stage; stageAt: number; created: number; submittedAt?: number; queriedAt?: number; decidedAt?: number; step?: number;
  certNo?: string; expiresInDays?: number; recommendation?: string; urgent?: boolean;
  invoice?: { no: string; amount: number; status: 'unpaid' | 'proof_uploaded' | 'verified' | 'rejected'; issued: number; proof?: string };
  docs?: 'all' | 'none'; artwork?: string; labelText?: string;
  /** Deliberate problems in the documents (see seed-documents.ts); none = a clean dossier. */
  issues?: Issue[];
  queries?: { from: Party; days: number; stage: Stage; text: string; answered?: boolean }[];
  history: H[];
}

async function main() {
  // The database is wiped below, so every stored file becomes an orphan.
  rmSync(UPLOAD_DIR, { recursive: true, force: true });
  mkdirSync(UPLOAD_DIR, { recursive: true });
  await prisma.$transaction([
    prisma.aiAnalysis.deleteMany(), prisma.documentCheck.deleteMany(), prisma.historyEvent.deleteMany(), prisma.invoice.deleteMany(), prisma.storedFile.deleteMany(),
    prisma.query.deleteMany(), prisma.application.deleteMany(), prisma.user.deleteMany(), prisma.counter.deleteMany(), prisma.helpdeskTicket.deleteMany(),
  ]);

  const applicantHash = await bcrypt.hash(DEMO.applicant.password, 10);
  const mkApplicant = (customerNo: string, name: string, email: string, address: string) =>
    prisma.user.create({ data: { role: 'applicant', customerNo, name, email, address, accountType: 'Local registered company', passwordHash: applicantHash, phone: '+250 788 000 000' } });
  const me = await mkApplicant('40112', 'Imaginary Pharma Ltd', DEMO.applicant.email, 'KG 7 Ave, Kigali');
  const kivu = await mkApplicant('40007', 'Kivu Agro Foods Ltd', 'info@kivu-agro.example', 'Rubavu');
  const nyungwe = await mkApplicant('40008', 'Nyungwe Naturals Ltd', 'info@nyungwe-naturals.example', 'Huye');
  const umuco = await mkApplicant('40009', 'Umuco Foods Ltd', 'info@umuco-foods.example', 'Musanze');
  const akagera = await mkApplicant('40010', 'Akagera Medical Supplies Ltd', 'info@akagera-medical.example', 'Kigali');
  const assessor = await prisma.user.create({ data: { role: 'assessor', name: 'Assessor (demo)', email: DEMO.assessor.email, passwordHash: await bcrypt.hash(DEMO.assessor.password, 10) } });

  const mine = { owner: me.id, applicant: me.name, applicantAddress: 'KG 7 Ave, Kigali' };
  const apps: SeedApp[] = [
    {
      ...mine, ref: 'RFDA26/PF/0013', type: 'PF', category: 'Fortified foods', brand: 'Smocha', generic: 'Fortified processed cereal-based food',
      form: 'Powder', size: '400 g', intendedUse: 'Complementary food for children from 6 months', intendedUsers: 'Children', storage: 'Store below 30°C in a dry place. Use within 4 weeks of opening.', shelfLife: '18',
      description: 'Fine yellow powder', warnings: 'Not a breast-milk substitute.', mfrName: 'Kivu Agro Foods Ltd', mfrCountry: 'Rwanda', mfrAddress: 'Rubavu Industrial Zone, Rubavu', origin: 'Locally manufactured',
      status: 'in_review', stage: 'assessment', stageAt: 18, created: 52, submittedAt: 45,
      invoice: { no: '1012026-0413', amount: 300000, status: 'verified', issued: 45, proof: 'momo-receipt-0413.pdf' },
      docs: 'all', artwork: 'smocha-label-v3.pdf', labelText: 'SMOCHA Fortified cereal porridge flour. Net content: 400 g. Ingredients: maize flour (60%), soybean flour (25%), sugar, skimmed milk powder, vitamin and mineral premix. Allergens: contains soy and milk. Nutrition per 100 g: energy 1650 kJ, protein 15 g, iron 10 mg, zinc 5 mg, vitamin A 400 µg. Store below 30°C in a dry place. Use within 4 weeks of opening. EXP: MM/YYYY. Batch: XXXX. Manufactured by Kivu Agro Foods Ltd, Rubavu Industrial Zone, Rubavu, Rwanda.',
      history: [[52, 'applicant', 'Application started', '', 'draft'], [45, 'applicant', 'Application submitted', 'Invoice 1012026-0413 issued', 'draft'], [44, 'applicant', 'Proof of payment uploaded', '', 'payment'], [42, 'fda', 'Payment confirmed', '', 'verification'], [18, 'fda', 'Dossier accepted for assessment', 'All mandatory documents present.', 'screening']],
    },
    {
      ...mine, ref: 'RFDA26/HM/0207', type: 'HM', category: 'Over-the-counter medicine', brand: 'Paracet-IP', generic: 'Paracetamol',
      form: 'Tablet', size: '500 mg', intendedUse: 'Relief of mild to moderate pain and fever', intendedUsers: 'Adults and children over 12', storage: 'Store below 30°C. Protect from moisture.', shelfLife: '36',
      description: 'White, round, biconvex tablets', warnings: 'Do not exceed 8 tablets in 24 hours.', mfrName: 'Example Manufacturing Co.', mfrCountry: 'Kenya', mfrAddress: 'Plot 7 Industrial Area, Nairobi', origin: 'Imported', srA: 'Yes', refAuthority: 'European Medicines Agency (EMA)',
      status: 'queried', stage: 'screening', stageAt: 9, queriedAt: 4, created: 30, submittedAt: 22,
      invoice: { no: '1012026-0398', amount: 1500000, status: 'verified', issued: 22, proof: 'bank-slip-0398.pdf' },
      docs: 'all', artwork: 'paracet-carton.pdf', issues: ['gmp-expired', 'auth-no-sharing'],
      labelText: 'PARACET-IP Paracetamol 500 mg tablets. 20 tablets. Do not exceed 8 tablets in 24 hours. Keep out of reach of children. Store in a cool, dry place. EXP: MM/YYYY. Batch: XXXX. Manufactured by Example Manufacturing Co.',
      queries: [{ from: 'fda', days: 4, stage: 'screening', text: 'The GMP certificate issued by the reference authority expired on 31 March 2025. Upload a GMP certificate that is valid on the date of submission. Also confirm the storage temperature on the carton: “store in a cool, dry place” does not state a temperature.' }],
      history: [[30, 'applicant', 'Application started', '', 'draft'], [22, 'applicant', 'Application submitted', 'Invoice 1012026-0398 issued', 'draft'], [21, 'applicant', 'Proof of payment uploaded', '', 'payment'], [19, 'fda', 'Payment confirmed', '', 'verification'], [4, 'fda', 'Query raised', 'GMP certificate expired; storage statement incomplete.', 'screening']],
    },
    {
      ...mine, ref: 'RFDA26/CO/0041', type: 'CO', category: 'Skin care', brand: 'Aloe Kivu', generic: 'Aloe vera body lotion',
      form: 'Lotion', size: '250 mL', intendedUse: 'Moisturising body lotion', intendedUsers: 'Adults', storage: 'Store below 25°C', shelfLife: '24',
      description: 'White, non-greasy lotion', warnings: 'For external use only.', mfrName: 'Imaginary Pharma Ltd', mfrCountry: 'Rwanda', mfrAddress: 'Masoro Industrial Park, Kigali', origin: 'Locally manufactured',
      status: 'awaiting_payment', stage: 'payment', stageAt: 2, created: 6, submittedAt: 2,
      invoice: { no: '1012026-0452', amount: 250000, status: 'unpaid', issued: 2 },
      docs: 'all', artwork: 'aloe-kivu-label.pdf', labelText: 'ALOE KIVU Aloe vera body lotion. 250 mL. Moisturises and softens the skin. Ingredients: Aqua, Aloe Barbadensis Leaf Juice, Glycerin, Cetearyl Alcohol, Caprylic/Capric Triglyceride, Ceteareth-20, Phenoxyethanol, Parfum, Ethylhexylglycerin. For external use only. Store below 25°C. EXP: MM/YYYY. Batch: XXXX. Manufactured by Imaginary Pharma Ltd, Masoro Industrial Park, Kigali, Rwanda.',
      history: [[6, 'applicant', 'Application started', '', 'draft'], [2, 'applicant', 'Application submitted', 'Invoice 1012026-0452 issued', 'draft']],
    },
    {
      ...mine, ref: 'DRAFT-5821', type: 'PF', category: 'Food supplements', brand: 'Olive Vitality', generic: 'Olive leaf extract food supplement', form: 'Powder', size: '200 g',
      intendedUse: 'Food supplement for adults, one scoop daily', intendedUsers: 'Adults', storage: 'Store below 25°C', shelfLife: '24',
      description: 'Green-yellow powder', mfrName: 'Mediterra Nutrition SA', mfrCountry: 'Egypt', mfrAddress: 'El Obour Industrial City, Cairo', origin: 'Imported', status: 'draft', stage: 'draft', stageAt: 3, created: 3, step: 3, docs: 'none',
      // Deliberately incomplete label: no temperature, expiry, net content, manufacturer or allergen (whey = milk).
      labelText: 'OLIVE VITALITY Olive leaf extract powder. Ingredients: olive leaf extract, maltodextrin, whey protein concentrate. Take one scoop daily in water. Store in a cool place. Distributed by Imaginary Pharma Ltd, Kigali.',
      history: [[3, 'applicant', 'Application started', '', 'draft']],
    },
    {
      ...mine, ref: 'RFDA25/HM/0988', type: 'HM', category: 'Prescription-only medicine', brand: 'Amoxi-IP', generic: 'Amoxicillin',
      form: 'Oral suspension', size: '250 mg/5 mL', intendedUse: 'Treatment of bacterial infections', intendedUsers: 'Children and adults', storage: 'Store below 25°C. After reconstitution store in a refrigerator (2°C to 8°C) and use within 7 days.', shelfLife: '24',
      description: 'Powder for oral suspension', warnings: 'Prescription only.', mfrName: 'Example Manufacturing Co.', mfrCountry: 'India', mfrAddress: 'MIDC Area, Aurangabad', origin: 'Imported', srA: 'Yes', refAuthority: 'WHO Prequalification',
      status: 'approved', stage: 'decision', stageAt: 210, created: 520, submittedAt: 500, decidedAt: 210, certNo: 'RW-FDA-HM-2025-0988', expiresInDays: 70,
      invoice: { no: '1012025-0911', amount: 1500000, status: 'verified', issued: 500, proof: 'bank-slip-0911.pdf' },
      docs: 'all', artwork: 'amoxi-carton.pdf',
      labelText: 'AMOXI-IP Amoxicillin 250 mg/5 mL powder for oral suspension. 100 mL after reconstitution. Prescription only medicine. Store below 25°C. After reconstitution store in a refrigerator (2°C to 8°C) and use within 7 days. EXP: MM/YYYY. Batch: XXXX. Manufactured by Example Manufacturing Co., MIDC Area, Aurangabad, India.',
      history: [[500, 'applicant', 'Application submitted', '', 'draft'], [497, 'fda', 'Payment confirmed', '', 'verification'], [470, 'fda', 'Dossier accepted for assessment', '', 'screening'], [230, 'fda', 'Recommended for approval', '', 'assessment'], [210, 'fda', 'Approved', 'Certificate RW-FDA-HM-2025-0988 issued', 'approval']],
    },
    // Other applicants (visible to assessors only)
    {
      ref: 'RFDA26/PF/0015', owner: kivu.id, applicant: kivu.name, applicantAddress: 'Rubavu', type: 'PF', category: 'Pre-packaged food', brand: 'Gorilla Grain', generic: 'Sorghum flour', form: 'Powder', size: '1 kg', intendedUse: 'Porridge flour', storage: 'Store in a cool dry place below 30°C', shelfLife: '12', mfrName: 'Kivu Agro Foods Ltd', mfrCountry: 'Rwanda', mfrAddress: 'Rubavu Industrial Zone, Rubavu', origin: 'Locally manufactured',
      status: 'in_review', stage: 'verification', stageAt: 1, submittedAt: 2, created: 5, invoice: { no: '1012026-0449', amount: 300000, status: 'proof_uploaded', issued: 2, proof: 'momo-receipt.pdf' }, docs: 'all', artwork: 'gorilla-grain-label.pdf',
      issues: ['fsc-expired'], labelText: 'GORILLA GRAIN Sorghum flour. Net weight: 1 kg. Ingredients: whole grain sorghum (100%). Allergens: none. Store in a cool dry place below 30°C. Produced by Kivu Agro Foods Ltd, Rubavu Industrial Zone, Rubavu, Rwanda.',
      history: [[2, 'applicant', 'Application submitted', '', 'draft'], [1, 'applicant', 'Proof of payment uploaded', '', 'payment']],
    },
    {
      ref: 'RFDA26/CO/0038', owner: nyungwe.id, applicant: nyungwe.name, applicantAddress: 'Huye', type: 'CO', category: 'Hair care', brand: 'Nyungwe Shea', generic: 'Shea butter hair cream', form: 'Cream', size: '200 g', intendedUse: 'Hair conditioning', storage: 'Store below 30°C', shelfLife: '24', mfrName: 'Nyungwe Naturals Ltd', mfrCountry: 'Rwanda', mfrAddress: 'Plot 4 Tumba, Huye', origin: 'Locally manufactured',
      status: 'in_review', stage: 'screening', stageAt: 11, submittedAt: 15, created: 16, invoice: { no: '1012026-0431', amount: 250000, status: 'verified', issued: 15, proof: 'bank-slip.pdf' }, docs: 'all', artwork: 'nyungwe-shea-label.pdf',
      issues: ['inci-no-percent', 'safety-unsigned'], labelText: 'NYUNGWE SHEA Shea butter hair cream. 200 g. Nourishes and softens dry hair. Store below 30°C. EXP: MM/YYYY. Batch: XXXX. Made by Nyungwe Naturals Ltd, Plot 4 Tumba, Huye, Rwanda.',
      history: [[15, 'applicant', 'Application submitted', '', 'draft'], [11, 'fda', 'Payment confirmed', '', 'verification']],
    },
    {
      ref: 'RFDA26/PF/0009', owner: umuco.id, applicant: umuco.name, applicantAddress: 'Musanze', type: 'PF', category: 'Bottled water and beverages', brand: 'Umuco Juice', generic: 'Passion fruit juice drink', form: 'Liquid', size: '500 mL', intendedUse: 'Beverage', storage: 'Store below 25°C', shelfLife: '9', mfrName: 'Umuco Foods Ltd', mfrCountry: 'Rwanda', mfrAddress: 'Musanze Industrial Park, Musanze', origin: 'Locally manufactured',
      status: 'in_review', stage: 'screening', stageAt: 17, submittedAt: 21, created: 25, urgent: true, invoice: { no: '1012026-0402', amount: 300000, status: 'verified', issued: 21, proof: 'bank-slip.pdf' }, docs: 'all', artwork: 'umuco-juice-label.pdf',
      labelText: 'UMUCO JUICE Passion fruit juice drink. 500 mL. Ingredients: water, passion fruit juice concentrate (25%), sugar, citric acid. Allergens: none. Store below 25°C. Once opened, keep refrigerated and consume within 3 days. EXP: DD/MM/YYYY. Batch: XXXX. Produced by Umuco Foods Ltd, Musanze Industrial Park, Musanze, Rwanda.',
      history: [[21, 'applicant', 'Application submitted', '', 'draft'], [17, 'fda', 'Payment confirmed', '', 'verification']],
    },
    {
      ref: 'RFDA26/HM/0181', owner: akagera.id, applicant: akagera.name, applicantAddress: 'Kigali', type: 'HM', category: 'Prescription-only medicine', brand: 'Metfo-AK', generic: 'Metformin hydrochloride', form: 'Tablet', size: '500 mg', intendedUse: 'Type 2 diabetes', storage: 'Store below 30°C', shelfLife: '36', mfrName: 'Generic Labs Pvt Ltd', mfrCountry: 'India', mfrAddress: 'Plot 21 Pharma City, Hyderabad', origin: 'Imported', srA: 'Yes', refAuthority: 'European Medicines Agency (EMA)', description: 'White, oblong, film-coated tablets',
      status: 'in_review', stage: 'approval', stageAt: 3, submittedAt: 160, created: 170, recommendation: 'approve', invoice: { no: '1012026-0117', amount: 1500000, status: 'verified', issued: 160, proof: 'bank-slip.pdf' }, docs: 'all', artwork: 'metfo-ak-carton.pdf',
      labelText: 'METFO-AK Metformin hydrochloride 500 mg film-coated tablets. 60 tablets. Prescription only medicine. Store below 30°C. Keep out of the reach of children. EXP: MM/YYYY. Batch: XXXX. Manufactured by Generic Labs Pvt Ltd, Plot 21 Pharma City, Hyderabad, India.',
      history: [[160, 'applicant', 'Application submitted', '', 'draft'], [157, 'fda', 'Payment confirmed', '', 'verification'], [140, 'fda', 'Dossier accepted for assessment', '', 'screening'], [3, 'fda', 'Recommended for approval', 'Quality and bioequivalence data satisfactory.', 'assessment']],
    },
    {
      ref: 'RFDA26/MD/0022', owner: akagera.id, applicant: akagera.name, applicantAddress: 'Kigali', type: 'MD', category: 'Class B (low to moderate risk)', brand: 'GlucoCheck', generic: 'Blood glucose meter', form: 'In-vitro diagnostic', size: 'GC-200', intendedUse: 'Self-testing of blood glucose', storage: 'Store between 5°C and 30°C', shelfLife: '24', mfrName: 'MedTech Devices GmbH', mfrCountry: 'Germany', mfrAddress: 'Industriestrasse 12, 72760 Reutlingen', origin: 'Imported', description: 'Hand-held meter with test strips, 0.6 µL capillary blood sample',
      status: 'in_review', stage: 'assessment', stageAt: 64, submittedAt: 80, created: 82, invoice: { no: '1012026-0201', amount: 600000, status: 'verified', issued: 80, proof: 'bank-slip.pdf' }, docs: 'all', artwork: 'glucocheck-label.pdf',
      issues: ['doc-no-class', 'ifu-no-storage'], labelText: 'GLUCOCHECK GC-200 Blood glucose meter for self-testing. Store between 5°C and 30°C. EXP: MM/YYYY (test strips). Lot: XXXX. MedTech Devices GmbH, Industriestrasse 12, 72760 Reutlingen, Germany.',
      history: [[80, 'applicant', 'Application submitted', '', 'draft'], [78, 'fda', 'Payment confirmed', '', 'verification'], [64, 'fda', 'Dossier accepted for assessment', '', 'screening']],
    },
  ];

  for (const s of apps) {
    const srA = s.srA || 'No';
    const app = await prisma.application.create({
      data: {
        ref: s.ref, isDraft: s.status === 'draft', ownerId: s.owner, applicant: s.applicant, applicantAddress: s.applicantAddress, type: s.type, category: s.category,
        brand: s.brand, generic: s.generic, form: s.form, size: s.size, intendedUse: s.intendedUse, intendedUsers: s.intendedUsers || 'Adults', storage: s.storage, shelfLife: s.shelfLife,
        description: s.description || '', warnings: s.warnings || '', mfrName: s.mfrName, mfrCountry: s.mfrCountry, mfrAddress: s.mfrAddress || '', origin: s.origin, srA, refAuthority: s.refAuthority || '',
        ltr: s.status === 'draft' ? '' : LTRS[0], labelText: s.labelText || '', status: s.status, stage: s.stage, stageAt: ago(s.stageAt), step: s.step || 0,
        createdAt: ago(s.created), submittedAt: s.submittedAt !== undefined ? ago(s.submittedAt) : null, queriedAt: s.queriedAt !== undefined ? ago(s.queriedAt) : null,
        decidedAt: s.decidedAt !== undefined ? ago(s.decidedAt) : null, certNo: s.certNo, expiresAt: s.expiresInDays ? new Date(NOW + s.expiresInDays * DAY) : null,
        recommendation: s.recommendation, urgent: !!s.urgent,
      },
    });
    const uploader = s.owner;
    const docApp = {
      ...s, description: s.description || '', mfrAddress: s.mfrAddress || '', refAuthority: s.refAuthority || '', ltr: LTRS[0],
      submittedDaysAgo: s.submittedAt ?? 0, issues: s.issues || [],
    };
    if (s.docs === 'all') {
      for (const d of docsFor({ type: s.type, srA, trademarkDiffers: false })) {
        if (!d.req) continue;
        await prisma.storedFile.create({ data: { applicationId: app.id, requirementId: d.id, uploadedById: uploader, createdAt: ago((s.submittedAt ?? 0) + 1), ...storeDoc(`${d.id}-${s.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`, documentLines(docApp, d.id)) } });
      }
    }
    if (s.artwork) {
      const label = ['DEMO LABEL ARTWORK - NOT A REAL LABEL', '', ...(s.labelText || s.brand).split('. ').map((x) => x.replace(/\.$/, '') + '.')];
      await prisma.storedFile.create({ data: { applicationId: app.id, requirementId: ARTWORK_ID, uploadedById: uploader, createdAt: ago((s.submittedAt ?? 0) + 1), ...storeDoc(s.artwork, label) } });
    }
    if (s.invoice) {
      const proof = s.invoice.proof
        ? await prisma.storedFile.create({ data: { applicationId: app.id, requirementId: PAYMENT_PROOF_ID, uploadedById: uploader, createdAt: ago(s.invoice.issued - 1), ...storeDoc(s.invoice.proof, ['DEMO PROOF OF PAYMENT', '', `Payment of RWF ${s.invoice.amount.toLocaleString('en-US')} for Rwanda FDA invoice ${s.invoice.no}.`, `Payer: ${s.applicant}.`]) } })
        : null;
      await prisma.invoice.create({ data: { applicationId: app.id, no: s.invoice.no, amount: s.invoice.amount || TYPES[s.type].fee, status: s.invoice.status, issuedAt: ago(s.invoice.issued), proofId: proof?.id } });
    }
    for (const q of s.queries || []) {
      await prisma.query.create({ data: { applicationId: app.id, from: q.from, stage: q.stage, text: q.text, answered: !!q.answered, createdAt: ago(q.days), authorId: q.from === 'fda' ? assessor.id : uploader } });
    }
    await prisma.historyEvent.createMany({
      data: s.history.map(([days, by, action, note = '', stage = s.stage]) => ({ applicationId: app.id, at: ago(days), by, action, note, stage, actorId: by === 'fda' ? assessor.id : uploader })),
    });
    // updatedAt is set automatically on create; align it with the last event so lists sort as in the prototype.
    await prisma.$executeRaw`UPDATE "Application" SET "updatedAt" = ${ago(Math.min(...s.history.map((h) => h[0])))} WHERE id = ${app.id}`;
  }

  // Screening ticks on the cosmetic already in screening, to show the checklist in use.
  const shea = await prisma.application.findUniqueOrThrow({ where: { ref: 'RFDA26/CO/0038' } });
  await prisma.documentCheck.createMany({ data: ['cover', 'poa'].map((requirementId) => ({ applicationId: shea.id, requirementId, checkedById: assessor.id })) });

  await prisma.counter.createMany({
    data: [
      { key: 'customer', value: 40112 }, { key: 'draft', value: 5821 }, { key: 'invoice-2026', value: 452 }, { key: 'cert', value: 100 }, { key: 'helpdesk', value: 1000 },
      { key: 'ref-26-PF', value: 15 }, { key: 'ref-26-HM', value: 207 }, { key: 'ref-26-CO', value: 41 }, { key: 'ref-26-VM', value: 3 }, { key: 'ref-26-MD', value: 22 },
    ],
  });

  console.log(`Seeded ${apps.length} applications.`);
  console.log(`Applicant: ${DEMO.applicant.customerNo} or ${DEMO.applicant.email} / ${DEMO.applicant.password}`);
  console.log(`Assessor:  ${DEMO.assessor.email} / ${DEMO.assessor.password}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
