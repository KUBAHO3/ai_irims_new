#!/usr/bin/env python3
"""Writes the ILLUSTRATIVE knowledge-base documents (guidelines and templates) as PDFs,
plus manifest.json that tools/load-knowledge-base.sh uses to upload them.

These texts were written for testing the portal. They are NOT official Rwanda FDA documents:
replace them with the approved guidelines before real use.

Usage: python3 tools/make_knowledge_base.py
"""
import json
from pathlib import Path

from pdf import write_pdf

OUT = Path(__file__).resolve().parent.parent / 'knowledge-base'
NOTE = 'ILLUSTRATIVE TEXT FOR TESTING - NOT AN OFFICIAL RWANDA FDA DOCUMENT'

DOCS = [
    {
        'sourceKey': 'rfda-guide-labelling', 'kind': 'guideline', 'productTypes': [], 'requirementIds': ['artwork'], 'version': '2026-01',
        'title': 'Guidelines on labelling of regulated products',
        'body': """
1. Scope
These guidelines apply to the labels of all products registered by Rwanda FDA: human and veterinary medicines, food products, cosmetics and medical devices. The label submitted with an application must be the label that will be used on the market.

2. Product identification
The label must state the brand name of the product. For medicines, it must also state the name of the active ingredient (INN), the strength and the pharmaceutical form, for example "Paracetamol 500 mg tablets".

3. Storage conditions
The label must state the storage conditions, including a specific temperature or temperature range, for example "Store below 30°C" or "Store between 2°C and 8°C". General statements such as "store in a cool, dry place" or "store properly" are not acceptable on their own.
The storage conditions on the label must be the same as the storage conditions declared in the application.

4. Expiry date
The label must show the expiry date, or the format in which it will be printed, preceded by "EXP", for example "EXP: MM/YYYY". The batch number must also be shown, preceded by "Batch" or "Lot".

5. Manufacturer
The label must state the name and the full address of the manufacturer, including the country.

6. Ingredients
Food products and cosmetics must list all ingredients on the label. Food products list ingredients in descending order of weight and highlight allergens such as milk, soy, wheat (gluten), eggs, peanuts and tree nuts. Cosmetics list ingredients using INCI names.

7. Language
Labels must be in English, French or Kinyarwanda. Additional languages may be added.
""",
    },
    {
        'sourceKey': 'rfda-guide-administrative', 'kind': 'guideline', 'productTypes': [], 'requirementIds': ['cover', 'poa', 'ltrletter', 'tm', 'application-form'], 'version': '2026-01',
        'title': 'Guidelines on administrative documents for product registration',
        'body': """
1. Cover letter
Every application starts with a cover letter on the applicant's letterhead. It identifies the product (brand name, generic or common name, strength or net content, and form), states the type of application, and is signed and dated by a responsible person of the applicant, whose name and title are given.

2. Power of attorney
When the applicant is not the manufacturer, the manufacturer or the marketing authorization holder must give a power of attorney to the local technical representative in Rwanda. The power of attorney names the product, names the local technical representative, states that it may act on the manufacturer's behalf before Rwanda FDA, and is notarized. An unsigned or un-notarized power of attorney is not accepted.

3. Application form
The application form must give the product name, the common name or active ingredient, the strength or net content, the form, the intended use, the storage conditions with a temperature, the shelf life, and the manufacturer's name and site address. A P.O. Box alone is not a site address.
""",
    },
    {
        'sourceKey': 'rfda-guide-reliance', 'kind': 'guideline', 'productTypes': ['HM'], 'requirementIds': ['sameness', 'rra-gmp', 'rra-auth'], 'version': '2026-01',
        'title': 'Guidelines on the reliance registration pathway for human medicines',
        'body': """
1. Purpose
A human medicine already approved by a reference regulatory authority may be registered through the reliance pathway. Rwanda FDA relies on the reference authority's assessment and inspection, so the applicant must prove that the product submitted is the same product.

2. Reference regulatory authorities
Accepted reference authorities include the European Medicines Agency, the US Food and Drug Administration, the MHRA, Swissmedic, Health Canada, the TGA, WHO Prequalification and the EAC joint assessment.

3. Declaration of sameness
The applicant submits a declaration of sameness, following the Rwanda FDA template. It states the reference authority and the product's registration number with that authority, names the manufacturing site, and declares that the product submitted to Rwanda FDA is identical to the approved product in formulation, manufacturing site, manufacturing process, specifications and packaging. It is signed and dated by the marketing authorization holder.

4. GMP certificate
A Good Manufacturing Practice certificate issued by the reference regulatory authority must be submitted for every manufacturing site. It must name the site and must be valid on the date of submission. Certificates issued by other authorities are not accepted for this pathway.

5. Letter of authorization
The applicant submits a letter, following the Rwanda FDA template, authorizing the reference regulatory authority to share its assessment and inspection reports about the product with Rwanda FDA. A letter that only confirms the product's approval is not sufficient.
""",
    },
    {
        'sourceKey': 'rfda-guide-ctd', 'kind': 'guideline', 'productTypes': ['HM'], 'requirementIds': ['m1', 'm2', 'm3', 'm4', 'm5'], 'version': '2026-01',
        'title': 'Guidelines on the Common Technical Document (CTD) for human medicines',
        'body': """
1. Structure
Human medicine dossiers are submitted in CTD format, in five modules.

2. Module 1: Administrative information and prescribing information
Module 1 contains the regional administrative information and the prescribing information: the summary of product characteristics (SmPC) and the patient information leaflet (PIL), with the labelling.

3. Module 2: Summaries
Module 2 contains the quality overall summary, the non-clinical overview and the clinical overview.

4. Module 3: Quality
Module 3 describes the active substance and the finished product. Section 3.2.P.8 must contain stability data that support the proposed shelf life and storage conditions. The duration of the long-term stability data must be at least as long as the proposed shelf life, unless an extrapolation is justified.

5. Module 4: Non-clinical study reports
Module 4 contains the non-clinical study reports. For well-established active substances, a literature-based non-clinical overview may be accepted.

6. Module 5: Clinical study reports
Module 5 contains the clinical study reports. For generic medicines, it must include a bioequivalence study against the reference product, with the 90% confidence intervals of the test/reference ratios for AUC and Cmax within 80.00-125.00%.
""",
    },
    {
        'sourceKey': 'rfda-guide-food', 'kind': 'guideline', 'productTypes': ['PF'], 'requirementIds': ['fsc', 'coa', 'comp', 'fsale', 'artwork'], 'version': '2026-01',
        'title': 'Guidelines on registration of food products',
        'body': """
1. Food safety certificate
The manufacturing site must hold a valid food safety management certificate, such as HACCP, ISO 22000 or FSSC 22000, issued by an accredited certification body. The certificate must name the site and must be valid on the date of submission.

2. Certificate of analysis
The certificate of analysis is for a named batch of the product. It shows the batch number, the date of analysis, and the results of each test against its specification limit, including microbiological tests (for example total plate count, coliforms, Salmonella, yeasts and moulds).

3. Composition
The composition lists every ingredient with its quantity or percentage. Fortified foods state the amount of each added vitamin and mineral per 100 g.

4. Labelling
In addition to the general labelling guidelines, the label of a food product lists the ingredients in descending order of weight, declares allergens, and states the net content. Fortified foods and food supplements give nutrition information per 100 g or per serving.
""",
    },
    {
        'sourceKey': 'rfda-guide-cosmetics', 'kind': 'guideline', 'productTypes': ['CO'], 'requirementIds': ['gmp', 'inci', 'safety', 'coa', 'artwork'], 'version': '2026-01',
        'title': 'Guidelines on registration of cosmetic products',
        'body': """
1. Good manufacturing practice
The manufacturer must hold a cosmetics GMP certificate according to ISO 22716, or an equivalent certificate from a competent authority, valid on the date of submission and naming the manufacturing site.

2. Ingredient list
The full ingredient list gives every ingredient by its INCI name with its concentration as a percentage (w/w). Restricted ingredients must be within the permitted limits.

3. Product safety assessment
The product safety assessment report evaluates the safety of the finished product for its intended use. It is signed and dated by a qualified safety assessor, whose qualifications are stated.

4. Labelling
The label lists the ingredients by INCI name, states the net content, the function of the product unless obvious, precautions for use, and the batch number.
""",
    },
    {
        'sourceKey': 'rfda-guide-devices', 'kind': 'guideline', 'productTypes': ['MD'], 'requirementIds': ['iso', 'doc', 'tech', 'ifu', 'artwork'], 'version': '2026-01',
        'title': 'Guidelines on registration of medical devices',
        'body': """
1. Quality management system
The manufacturer must hold an ISO 13485 certificate, valid on the date of submission, whose scope covers the design and manufacture of the device.

2. Declaration of conformity
The declaration of conformity names the device and its model, states its risk class (A, B, C or D), lists the standards applied, and is signed and dated by the manufacturer.

3. Technical file summary
The technical file summary describes the device and its intended use, and includes a summary of the risk management according to ISO 14971 and of the performance or clinical evidence.

4. Instructions for use
The instructions for use state the intended use, the users, contraindications and warnings, and the storage and operating conditions, including temperature limits.
""",
    },
    {
        'sourceKey': 'rfda-guide-veterinary', 'kind': 'guideline', 'productTypes': ['VM'], 'requirementIds': ['gmp', 'coa', 'spc', 'wd', 'artwork'], 'version': '2026-01',
        'title': 'Guidelines on registration of veterinary medicines',
        'body': """
1. Target species and dose
The summary of product characteristics states each target species, the dose, and the route of administration.

2. Withdrawal period
For products used in food-producing animals, the withdrawal period for meat, milk and eggs must be stated on the label and in the package insert, and justified by residue data.

3. GMP certificate
The manufacturing site must hold a GMP certificate valid on the date of submission.
""",
    },
    {
        'sourceKey': 'tpl-declaration-of-sameness', 'kind': 'template', 'productTypes': ['HM'], 'requirementIds': ['sameness'], 'version': '2026-01',
        'title': 'Template: Declaration of sameness',
        'body': """
DECLARATION OF SAMENESS (template)

1. Product name, strength and pharmaceutical form: ............
2. Reference regulatory authority: ............
3. Registration number with the reference regulatory authority: ............
4. Name and address of the manufacturing site(s): ............
5. Declaration: "I declare that the product submitted to Rwanda FDA is identical to the product approved by the reference regulatory authority in formulation, manufacturing site, manufacturing process, specifications and packaging."
6. Name, title and signature of the marketing authorization holder's representative, and date: ............
""",
    },
    {
        'sourceKey': 'tpl-reliance-authorization-letter', 'kind': 'template', 'productTypes': ['HM'], 'requirementIds': ['rra-auth'], 'version': '2026-01',
        'title': 'Template: Letter of authorization to share information with Rwanda FDA',
        'body': """
LETTER OF AUTHORIZATION (template)

To: [Reference regulatory authority]
Product: [name, strength, form], registration number [number]

"We, [marketing authorization holder], authorize [reference regulatory authority] to share with Rwanda FDA the assessment reports, inspection reports and any other information it holds about the product named above, for the purpose of its registration in Rwanda."

Name, title and signature of the marketing authorization holder's representative, and date.
""",
    },
    {
        'sourceKey': 'tpl-power-of-attorney', 'kind': 'template', 'productTypes': [], 'requirementIds': ['poa'], 'version': '2026-01',
        'title': 'Template: Power of attorney to the local technical representative',
        'body': """
POWER OF ATTORNEY (template)

[Manufacturer or marketing authorization holder], of [address], appoints [local technical representative], of [address in Rwanda], as its local technical representative for the product [name], and authorizes it to act on its behalf before Rwanda FDA in all matters concerning the registration of the product.

Signed by [name, title] on [date].
Notarized by: [notary public, stamp and date].
""",
    },
]


def main():
    OUT.mkdir(exist_ok=True)
    manifest = []
    for d in DOCS:
        name = f"{d['sourceKey']}.pdf"
        write_pdf(OUT / name, [NOTE, '', d['title'].upper(), f"Version {d['version']}", ''] + d['body'].strip().split('\n'))
        manifest.append({k: d[k] for k in ('sourceKey', 'title', 'kind', 'productTypes', 'requirementIds', 'version')} | {'file': name})
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'wrote {len(DOCS)} documents to {OUT.relative_to(OUT.parent.parent)}')


if __name__ == '__main__':
    main()
