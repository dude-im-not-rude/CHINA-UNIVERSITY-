# China Uni Tracker — University Intelligence Architecture

## 1. Goal

Build a China-first university discovery platform with a polished directory and rich university profiles. The data model and crawler must support information that appears directly in HTML as well as information exposed through linked PDFs, Google Drive documents, embedded PDF viewers, iframes, and JavaScript-rendered pages.

The competitor/reference site described by the project owner is used only for product inspiration and field discovery. We should not copy its branding, proprietary text, images, or GSC-specific labels.

## 2. Source hierarchy

1. Official university website — authoritative source for university/program/admission facts.
2. Official university PDF/document — authoritative when published by the university.
3. Official government/scholarship source — authoritative for scholarship/program rules.
4. CUCAS and other discovery directories — discovery/cross-check source, not the final authority when an official source exists.
5. Third-party directories/consultancies — discovery/reference only; never label their claims as official.

Every extracted fact should retain its source URL, source type, last-checked time, and verification status.

## 3. Discovery pipeline

```text
Seed sources
  -> University discovery
  -> Canonical university identity / dedupe
  -> Official-domain resolution
  -> Source inventory
  -> Fetch / render
  -> Document discovery
  -> PDF / Drive / iframe extraction
  -> Structured extraction
  -> Provenance + confidence
  -> Normalization / dedupe
  -> Neon Postgres
  -> Web directory + university profile
```

## 4. Fetch modes

### A. Normal HTML
Fetch the page, extract links, headings, tables, metadata and structured data.

### B. JavaScript / SPA
Use a browser-rendering worker when the initial HTML does not contain the useful content. Wait for relevant content before extraction.

### C. Direct PDF
Detect PDF responses and PDF URLs. Download the document, extract text, identify tables, and map relevant sections to university/program fields.

### D. Embedded PDF viewer
Inspect `iframe`, `embed`, object and viewer configuration for the underlying document URL. Resolve the real PDF instead of treating the viewer page as the source document.

### E. Google Drive
Recognize common Google Drive/Docs/Viewer URL forms. Resolve the public document/file when accessible, download or fetch the rendered content, then run the same document extraction pipeline. Keep the original Drive URL as provenance.

### F. Scanned/image PDF
If normal text extraction returns little or no text, mark the document as image/scanned and send pages through OCR. Store extraction quality and do not silently treat OCR output as perfectly verified.

### G. Blocked source
403/429/robots/authentication failures are recorded as a crawl outcome. Do not attempt to bypass access controls. Keep the source for later retry or manual verification.

## 5. University profile data model

### Core identity
- university name (English/Chinese)
- short name
- canonical slug
- university type
- country/province/city/address
- official website
- admissions website
- international website
- logo/cover image

### Classification
- 985
- 211
- Double First-Class
- other official classifications
- establishment/founded year

### Overview / facts
- university description
- academic strength
- notable/popular majors
- student/international-student counts when officially available
- campus count
- library/canteen/facilities
- dormitory information
- estimated living cost
- city/living notes

### Programs
For each program:
- program name
- Chinese name
- degree level
- discipline/field
- language
- English-taught flag
- duration
- tuition fee + currency
- application fee + currency
- living-cost estimate when program-specific
- intake/application year
- official program URL
- application URL
- source/provenance

### Admission requirements
- academic qualification
- language requirement
- HSK/English requirements
- CSCA requirement
- age requirements
- documents
- application/deadline information
- additional program-specific requirements
- source and verification status

### Scholarships
- scholarship name
- coverage
- eligibility
- amount/benefits when officially published
- application route
- deadline
- source/provenance

### Sources/documents
Every important field should be traceable to one or more source records. Documents should record original URL, resolved URL when different, file type, official status, verification status and extraction status.

## 6. UI architecture

### `/universities`
Directory page inspired by the useful interaction pattern described for the reference site, but with China Uni Tracker branding.

Features:
- country selector
- China-focused filter
- search
- province/city filter
- university type
- 985/211/Double First-Class filters
- degree filter
- English-taught filter
- tuition range
- scholarship availability
- application year/intake
- result count
- university cards

University card should show:
- logo
- university name
- city/province
- classification badges
- founded year
- short academic summary
- key strengths/majors
- relevant program count
- scholarship indicator
- `View Profile`
- `Official Website`
- `Apply` only when an official application URL is verified

### `/universities/[slug]`
Profile page sections:
1. Hero / identity
2. Quick facts
3. About
4. Academic strengths
5. Popular majors
6. Bachelor programs
7. Master programs
8. Admission requirements
9. Scholarships
10. Campus / living information
11. Official contacts
12. Official sources & documents
13. Last verified / data confidence

Do not include consultancy-specific labels such as `GSC Supported University` or `Apply Through GSC`.

### `/insights`
Content hub for:
- scholarship updates
- admission guidance
- admission resources
- university insights
- China study guides
- CSCA resources
- deadline/admission updates

Do not add a success-story section until there is a real content strategy for it.

## 7. Branding / footer

Brand: **China Uni Tracker**

Footer should contain a short neutral tagline, for example:

> Guiding your China study journey with verified university information.

No founder section for now. Founder information can be added later without changing the core architecture.

## 8. Visitor counter

The product can show an aggregate visit counter, but it should be privacy-conscious and independent of the crawler. Recommended design:

```text
page_views / site_metrics
  -> aggregate daily/total counts
  -> display public total
```

Do not store unnecessary personal browsing data merely to display a counter.

## 9. Existing Neon integration

The current production database already contains the main entities needed for the first version: universities, programs, intakes, admission requirements, documents, sources, contacts, campuses, scholarships and monitoring events.

The next schema work should extend the existing model only where necessary, rather than replacing it. Candidate additions include:
- richer university facts/strengths
- structured popular majors
- extraction/provenance records
- crawl/document status
- source confidence
- public aggregate site metrics

## 10. Data quality rules

- Never invent missing tuition, requirements, deadlines or scholarship values.
- Prefer official sources when conflicting values exist.
- Preserve conflicting third-party values as unverified references rather than overwriting official data.
- Store the exact source URL for important facts.
- Store when a source was checked.
- Mark fields as verified/unverified/needs-review.
- Normalize duplicate university and program records.
- Separate bachelor/master/PhD/other records correctly.
- Do not classify a program as English-taught unless the source supports it.

## 11. Crawl strategy for scale

Do not make one giant crawler responsible for everything. Use stages:

1. Discovery worker — find/refresh university identities.
2. Official-source resolver — find canonical official domains.
3. Source inventory worker — enumerate admissions/program/scholarship/document URLs.
4. Document worker — resolve HTML/PDF/Drive/embed sources.
5. Extraction worker — convert content into structured candidate facts.
6. Verification worker — compare candidate facts with official sources.
7. Persistence worker — upsert normalized records and provenance.
8. Monitoring worker — detect changes and emit events.

This makes failures observable and prevents a blocked university from stopping the entire run.

## 12. Immediate implementation priorities

### P0 — fix data coverage
- Increase official-domain resolution coverage.
- Crawl real program/admission pages instead of relying on a small fixed URL set.
- Persist discovered PDFs/documents, not only count them.
- Resolve embedded PDF viewers and public Drive documents.
- Add extraction status and provenance.
- Correct degree/language classification so `other` does not swallow useful programs.

### P1 — build the directory/profile experience
- China filter + search + filters.
- Rich university cards.
- University profile sections.
- Official-source links.
- Program tables with tuition/language/duration.
- Requirements and scholarship blocks.

### P2 — insights and monitoring
- Insights hub.
- Scholarship/admission updates.
- Change detection.
- Last-verified indicators.

### P3 — polish
- progress bar
- responsive mobile navigation
- aggregate visitor count
- accessibility/performance polish

## 13. Reference-site analysis boundary

The supplied consultancy site could not be fetched reliably in the current tool session, so this architecture uses the project owner's detailed walkthrough as the source for its described information architecture and UI patterns. The implementation should use the reference site for interaction ideas only and should independently verify university facts from official sources.
