/* Realistic demo document contents for the seed, so the AI review has something real to check.
   Every document is marked as a demo. `issues` switch on deliberate problems, so some applications
   pass the rules (ai-review/rules/rfda-rules.json) and others do not. */

export type Issue =
  | 'cover-unsigned' | 'poa-not-notarized'
  | 'sameness-no-site' | 'gmp-expired' | 'auth-no-sharing' | 'm3-short-stability' | 'be-out-of-range'
  | 'fsc-expired' | 'coa-no-micro' | 'comp-no-quantities'
  | 'inci-no-percent' | 'safety-unsigned'
  | 'doc-no-class' | 'ifu-no-storage';

export interface DocApp {
  ref: string; applicant: string; applicantAddress: string; type: string; brand: string; generic: string; form: string; size: string;
  intendedUse: string; storage: string; shelfLife: string; description: string; mfrName: string; mfrCountry: string; mfrAddress: string;
  refAuthority: string; ltr: string; submittedDaysAgo: number; issues: Issue[];
}

const DAY = 86400000;
const date = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const daysAgo = (n: number) => date(new Date(Date.now() - n * DAY));
const validUntil = () => date(new Date(Date.now() + 2 * 365 * DAY));
const DEMO = 'DEMO DOCUMENT FOR TESTING - NOT A REAL DOCUMENT';

/** Lines of text for one document requirement of one application. */
export function documentLines(a: DocApp, requirementId: string): string[] {
  const has = (i: Issue) => a.issues.includes(i);
  const site = `${a.mfrName}, ${a.mfrAddress}, ${a.mfrCountry}`;
  const product = `${a.brand} (${a.generic}${a.size ? ', ' + a.size : ''}${a.form ? ', ' + a.form.toLowerCase() : ''})`;
  const signed = `Signed: Jean Mugabo, Head of Regulatory Affairs, ${a.applicant}. Date: ${daysAgo(a.submittedDaysAgo + 3)}.`;
  const lines: Record<string, string[]> = {
    cover: [
      `${a.applicant}, ${a.applicantAddress}`, `Date: ${daysAgo(a.submittedDaysAgo + 1)}`, 'To: Rwanda Food and Drugs Authority, Kigali, Rwanda', '',
      `Subject: Application for the registration of ${product}`, '',
      `We submit an application for the new registration of ${product}. The product is manufactured by ${site}. The dossier documents required by Rwanda FDA are enclosed.`, '',
      has('cover-unsigned') ? 'Yours faithfully,' : `Yours faithfully, Jean Mugabo, Head of Regulatory Affairs, ${a.applicant}. Signed on ${daysAgo(a.submittedDaysAgo + 1)}.`,
    ],
    poa: [
      'POWER OF ATTORNEY', '',
      `${a.mfrName}, of ${a.mfrAddress}, ${a.mfrCountry}, appoints ${a.ltr.replace(' (own licence)', '')}, of Kigali, Rwanda, as its local technical representative for the product ${a.brand}, and authorizes it to act on its behalf before Rwanda FDA in all matters concerning the registration of the product.`, '',
      `Signed by Anne Kamau, Managing Director, ${a.mfrName}, on ${daysAgo(a.submittedDaysAgo + 30)}.`,
      ...(has('poa-not-notarized') ? [] : [`Notarized by: Me. Claudine Uwase, Notary Public, Kigali, stamp no. 2291, on ${daysAgo(a.submittedDaysAgo + 28)}.`]),
    ],
    sameness: [
      'DECLARATION OF SAMENESS', '',
      `1. Product name, strength and pharmaceutical form: ${a.brand}, ${a.generic} ${a.size} ${a.form.toLowerCase()}`,
      `2. Reference regulatory authority: ${a.refAuthority}`,
      `3. Registration number with the reference regulatory authority: EU/1/21/${a.ref.slice(-4)}`,
      ...(has('sameness-no-site') ? [] : [`4. Manufacturing site: ${site}`]),
      '5. Declaration: I declare that the product submitted to Rwanda FDA is identical to the product approved by the reference regulatory authority in formulation, manufacturing site, manufacturing process, specifications and packaging.',
      `6. ${signed}`,
    ],
    'rra-gmp': [
      'GOOD MANUFACTURING PRACTICE CERTIFICATE', '',
      `Issued by: ${a.refAuthority}`, `Certificate number: GMP-${a.ref.slice(-4)}-2024`, `Manufacturing site: ${site}`,
      `The manufacturing site has been inspected and complies with the principles of Good Manufacturing Practice for the manufacture of ${a.form.toLowerCase()}s.`,
      `Date of the last inspection: ${has('gmp-expired') ? '10 March 2022' : daysAgo(300)}`,
      `This certificate is valid until ${has('gmp-expired') ? '31 March 2025' : validUntil()}.`,
    ],
    'rra-auth': [
      'LETTER OF AUTHORIZATION', '', `To: ${a.refAuthority}`, `Product: ${a.brand}, ${a.generic} ${a.size}, registration number EU/1/21/${a.ref.slice(-4)}`, '',
      has('auth-no-sharing')
        ? `We confirm that the product named above is approved by ${a.refAuthority} and is marketed in the European Union.`
        : `We, ${a.applicant}, authorize ${a.refAuthority} to share with Rwanda FDA the assessment reports, inspection reports and any other information it holds about the product named above, for the purpose of its registration in Rwanda.`,
      '', signed,
    ],
    m1: [
      'MODULE 1: ADMINISTRATIVE INFORMATION AND PRESCRIBING INFORMATION', '',
      '1.0 Cover letter', '1.2 Application form', '1.3 Product information',
      `1.3.1 Summary of product characteristics (SmPC) for ${a.brand}: ${a.generic} ${a.size} ${a.form.toLowerCase()}. Therapeutic indications: ${a.intendedUse}. Posology and method of administration, contraindications, warnings, interactions and undesirable effects are given in sections 4.1 to 4.9.`,
      `1.3.2 Patient information leaflet for ${a.brand}, in English and French.`, '1.3.3 Labelling: outer carton and blister.',
    ],
    m2: [
      'MODULE 2: COMMON TECHNICAL DOCUMENT SUMMARIES', '',
      `2.3 Quality overall summary: ${a.generic} ${a.size} ${a.form.toLowerCase()}, manufactured by ${site}.`,
      `2.4 Non-clinical overview: ${a.generic} is a well-established active substance; the overview is based on published literature.`,
      '2.5 Clinical overview: efficacy and safety are supported by the bioequivalence study in Module 5 and published literature.',
    ],
    m3: [
      'MODULE 3: QUALITY', '',
      `3.2.S Drug substance: ${a.generic}, manufactured according to the European Pharmacopoeia monograph.`,
      `3.2.P.1 Description of the drug product: ${a.description}.`,
      '3.2.P.5 Control of the drug product: specifications for appearance, identification, assay (95.0-105.0%), dissolution and related substances, with validated methods.',
      has('m3-short-stability')
        ? `3.2.P.8 Stability: long-term stability data at 30°C/75% RH are available for 12 months on three production batches. The proposed shelf life is ${a.shelfLife} months.`
        : `3.2.P.8 Stability: long-term stability data at 30°C/75% RH for ${a.shelfLife} months on three production batches support a shelf life of ${a.shelfLife} months when stored below 30°C.`,
    ],
    m4: ['MODULE 4: NON-CLINICAL STUDY REPORTS', '', `Non-clinical data for ${a.generic} are taken from published literature, as allowed for well-established active substances. No new non-clinical studies were performed.`],
    m5: [
      'MODULE 5: CLINICAL STUDY REPORTS', '',
      `5.3.1 Bioequivalence study BE-2024-07: ${a.brand} was compared with the reference product in 24 healthy volunteers under fasting conditions.`,
      has('be-out-of-range')
        ? 'Results: 90% confidence intervals of the test/reference ratios: AUC 94.1-106.3%, Cmax 78.5-110.2%.'
        : 'Results: 90% confidence intervals of the test/reference ratios: AUC 94.1-106.3%, Cmax 91.8-108.9%, both within 80.00-125.00%. The products are bioequivalent.',
    ],
    fsc: [
      'FSSC 22000 CERTIFICATE', '', 'Issued by: Bureau Food Certification (accredited certification body)', `Certified organization and site: ${site}`,
      `Scope: manufacture of ${a.generic.toLowerCase()}.`, `Certificate number: FSSC-${a.ref.slice(-4)}`,
      `This certificate is valid until ${has('fsc-expired') ? '30 June 2025' : validUntil()}.`,
    ],
    coa: a.type === 'CO' ? [
      `CERTIFICATE OF ANALYSIS - ${a.brand}`, '', `Batch: L2409-${a.ref.slice(-2)}. Date of analysis: ${daysAgo(a.submittedDaysAgo + 20)}.`,
      'Appearance: conforms. pH: 5.6 (limit 5.0-6.5). Viscosity: 3200 mPa.s (limit 2500-4000).',
      'Total aerobic microbial count: <100 cfu/g (limit 1000). Yeasts and moulds: <10 cfu/g (limit 100). Pathogens (P. aeruginosa, S. aureus, C. albicans): absent.',
    ] : [
      `CERTIFICATE OF ANALYSIS - ${a.brand}`, '', `Batch: B2409-${a.ref.slice(-2)}. Date of analysis: ${daysAgo(a.submittedDaysAgo + 20)}.`,
      'Moisture: 4.1% (limit 5.0% max). Protein: 15.2 g/100 g (declared 15 g).',
      ...(has('coa-no-micro') ? [] : ['Total plate count: 2.1 x 10^3 cfu/g (limit 10^5). Coliforms: <10 cfu/g (limit 10^2). Salmonella: absent in 25 g. Yeasts and moulds: <100 cfu/g (limit 10^3).']),
      'Conclusion: the batch complies with the specification.',
    ],
    comp: [
      `PRODUCT COMPOSITION - ${a.brand}`, '',
      ...(has('comp-no-quantities')
        ? ['Ingredients: ' + compIngredients(a).map(([n]) => n).join(', ') + '.']
        : compIngredients(a).map(([n, q]) => `${n}: ${q}`)),
    ],
    gmp: [
      'ISO 22716 CERTIFICATE - COSMETICS GOOD MANUFACTURING PRACTICES', '', 'Issued by: QualiCert Africa (accredited certification body)',
      `Site: ${site}`, `Scope: manufacture and packaging of skin and hair care products.`, `This certificate is valid until ${validUntil()}.`,
    ],
    inci: [
      `FULL INGREDIENT LIST (INCI) - ${a.brand}`, '',
      ...(has('inci-no-percent') ? [inciIngredients(a).map(([n]) => n).join(', ')] : inciIngredients(a).map(([n, p]) => `${n}: ${p}`)),
    ],
    safety: [
      `PRODUCT SAFETY ASSESSMENT REPORT - ${a.brand}`, '',
      `Part A: product composition, physical and chemical characteristics, microbiological quality and exposure for ${a.intendedUse.toLowerCase()}.`,
      'Part B: assessment conclusion. The product is safe for human health when used under normal or reasonably foreseeable conditions of use.',
      ...(has('safety-unsigned') ? [] : [`Safety assessor: Dr. Aline Mukamana, PharmD, MSc Toxicology, qualified safety assessor. Signed on ${daysAgo(a.submittedDaysAgo + 15)}.`]),
    ],
    iso: [
      'ISO 13485:2016 CERTIFICATE', '', 'Issued by: TÜV Medical Certification', `Organization: ${site}`,
      'Scope: design, development and manufacture of blood glucose monitoring systems and test strips.', `This certificate is valid until ${validUntil()}.`,
    ],
    doc: [
      'DECLARATION OF CONFORMITY', '', `Manufacturer: ${site}`, `Device: ${a.brand} ${a.generic.toLowerCase()}, model ${a.size}`,
      ...(has('doc-no-class') ? [] : ['Risk class: B (low to moderate risk)']),
      'Standards applied: ISO 15197:2013, ISO 14971:2019, IEC 61010-1, IEC 61326-2-6.',
      `We declare under our sole responsibility that the device meets the applicable requirements. Signed: Dr. K. Weber, Managing Director, ${daysAgo(a.submittedDaysAgo + 40)}.`,
    ],
    tech: [
      `TECHNICAL FILE SUMMARY - ${a.brand}`, '', `Device description: ${a.description}. Intended use: ${a.intendedUse}.`,
      'Risk management: performed according to ISO 14971:2019; all risks reduced as far as possible, residual risk acceptable.',
      'Performance evaluation: system accuracy study according to ISO 15197:2013, 99% of results within the required limits.',
    ],
    ifu: [
      `INSTRUCTIONS FOR USE - ${a.brand}`, '', `Intended use: ${a.intendedUse}, by people with diabetes at home.`,
      'Warnings: not for the diagnosis of diabetes; not for use on neonates.',
      ...(has('ifu-no-storage') ? [] : ['Storage and operating conditions: store the meter and test strips between 5°C and 30°C, at 10-90% relative humidity. Do not freeze.']),
    ],
  };
  return [DEMO, '', ...(lines[requirementId] || [`${requirementId.toUpperCase()} - ${a.brand}`, '', `Document provided for ${product}.`])];
}

function compIngredients(a: DocApp): [string, string][] {
  if (a.brand === 'Smocha') return [['Maize flour', '60%'], ['Soybean flour', '25%'], ['Sugar', '8%'], ['Skimmed milk powder', '6%'], ['Vitamin and mineral premix (iron 10 mg, zinc 5 mg, vitamin A 400 µg per 100 g)', '1%']];
  if (a.brand === 'Umuco Juice') return [['Water', '70%'], ['Passion fruit juice concentrate', '25%'], ['Sugar', '4.8%'], ['Citric acid', '0.2%']];
  return [['Sorghum flour', '100%']];
}

function inciIngredients(a: DocApp): [string, string][] {
  if (a.brand === 'Aloe Kivu') return [['Aqua', '72.0%'], ['Aloe Barbadensis Leaf Juice', '10.0%'], ['Glycerin', '5.0%'], ['Cetearyl Alcohol', '4.0%'], ['Caprylic/Capric Triglyceride', '4.0%'], ['Ceteareth-20', '3.0%'], ['Phenoxyethanol', '0.9%'], ['Parfum', '0.6%'], ['Ethylhexylglycerin', '0.5%']];
  return [['Butyrospermum Parkii Butter', '45.0%'], ['Cocos Nucifera Oil', '25.0%'], ['Ricinus Communis Seed Oil', '20.0%'], ['Simmondsia Chinensis Seed Oil', '9.0%'], ['Tocopherol', '0.5%'], ['Parfum', '0.5%']];
}

/** A text-only PDF (Helvetica, A4, word wrap, several pages). */
export function textPdf(lines: string[]): Buffer {
  const wrapped: string[] = [];
  for (const line of lines) {
    if (!line) { wrapped.push(''); continue; }
    let cur = '';
    for (const word of line.split(' ')) {
      if ((cur + ' ' + word).trim().length > 92) { wrapped.push(cur); cur = word; } else cur = (cur + ' ' + word).trim();
    }
    wrapped.push(cur);
  }
  const pages: string[][] = [];
  for (let i = 0; i < Math.max(wrapped.length, 1); i += 52) pages.push(wrapped.slice(i, i + 52));
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const objs: Buffer[] = [Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'), Buffer.alloc(0), Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')];
  const kids: number[] = [];
  for (const page of pages) {
    const stream = Buffer.from('BT /F1 10.5 Tf 50 790 Td 14.5 TL ' + page.map((l) => `(${esc(l)}) Tj T*`).join(' ') + ' ET', 'latin1');
    objs.push(Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`), stream, Buffer.from('\nendstream')]));
    const contentId = objs.length;
    objs.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`));
    kids.push(objs.length);
  }
  objs[1] = Buffer.from(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`);
  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n')];
  let size = parts[0].length;
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(size);
    const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), o, Buffer.from('\nendobj\n')]);
    parts.push(chunk);
    size += chunk.length;
  });
  parts.push(Buffer.from(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`));
  return Buffer.concat(parts);
}
