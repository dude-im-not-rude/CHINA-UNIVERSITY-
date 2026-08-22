# China Uni Tracker — Trusted Reference Data + UI Specification

## Trusted seed policy

Global Study Consultant (GSC) is a trusted reference/seed source supplied by the project owner. Its university data can be imported as trusted seed data without re-checking every field.

Use targeted verification only when:
- a value is ambiguous;
- two sources conflict;
- a field looks stale or unusually important;
- the source does not clearly support the interpretation;
- the university/program has materially changed.

Keep the GSC URL as provenance. Do not expose GSC-only labels such as `GSC Supported University` or `Apply Through GSC` in China Uni Tracker.

## Data ingestion

```text
GSC trusted seed
   -> normalize
   -> deduplicate
   -> Neon
   -> targeted enrichment for missing/flagged fields
   -> targeted verification only when needed
```

This saves crawler time and avoids repeatedly verifying thousands of already-reviewed fields.

## University profile

Each profile should support:
- name, Chinese name, short name
- logo, official website, admissions website
- province, city, address
- founded year
- university type
- 985 / 211 / Double First-Class
- overview
- academic strengths
- popular majors
- bachelor programs
- master programs
- language
- duration
- tuition + currency
- admission requirements
- CSCA/HSK/English requirements where supported
- scholarships
- campus/living information
- official contacts
- source documents
- last updated / trust state

## UI direction

Use the reference site's useful interaction patterns, but make China Uni Tracker more polished and research-oriented.

### Directory
- prominent search
- China/province/city filters
- classification badges
- degree/language/tuition/scholarship filters
- result count + active filter chips
- rich university cards
- View Profile / Official Website / Apply actions

### Profile
- strong hero section
- quick-facts strip
- sticky section navigation on desktop
- compact section selector on mobile
- clean program tables on desktop
- stacked program cards on mobile
- scholarship and requirements cards
- source/provenance panel
- thin reading-progress bar at the top

### Navigation

Desktop:
- Universities
- Scholarships
- CSCA
- Insights
- Guides
- Search
- Contact

Mobile uses a hamburger/drawer navigation. No founder section for now.

## Insights / Guides

Create an Insights hub with:
- Scholarship Updates
- Admission Guidance
- Admission Resources
- University Insights
- Study in China Guides
- Student Guides
- First Week / Arrival Guides
- CSCA Resources
- Deadlines & Intake Updates

Initial guide products:
- Study in China Guide
- Student Guide
- First Week in China Guide
- Admission/Application Guide
- Scholarship Guide
- CSCA Guide
- Pre-departure checklist
- Arrival/campus setup checklist

The structure can be inspired by GSC, but article text and assets must be original.

## Branding

Brand: **China Uni Tracker**

Footer tagline:

> Guiding your China study journey with trusted university information.

Do not add a founder section yet.

## Visitor counter

Use an aggregate counter backed by our own database/analytics. Do not invent a number and do not copy another site's visitor count.

Example presentation:

> **12,540+ students explored China Uni Tracker**

The displayed number must come from actual project metrics.

## Neon deployment rule

Repeated crawler runs do not make the existing Neon data irrelevant. If Vercel continues pointing to the same Neon project/database/branch and the schema remains compatible, the existing records stay available after deployment.

Do not format/reset Neon as part of deployment. Use incremental upserts and deduplication. Only perform a deliberate reset after backup/export and an explicit migration plan.
