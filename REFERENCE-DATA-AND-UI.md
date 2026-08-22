# China Uni Tracker — Trusted Reference Data + UI Specification

## Trusted seed policy

Global Study Consult (GSC) is the project's preferred trusted reference/seed source for China university data, as directed by the project owner. Its supplied university facts can be imported as trusted seed data without routine field-by-field re-verification.

Use targeted verification only when:
- a value is ambiguous;
- two sources conflict;
- a field looks stale or unusually important;
- the source does not clearly support the interpretation;
- the university/program has materially changed;
- a user submits a report that identifies a possible error.

Keep the GSC URL as provenance. Do not expose GSC-only labels such as `GSC Supported University` or `Apply Through GSC` in China Uni Tracker.

### Source precedence

When multiple sources provide a value, use this order:

1. GSC trusted seed/reference data for the project's current China directory dataset.
2. Official university source for targeted checks, conflicts, missing fields, contacts and application links.
3. Official government/scholarship source for government-controlled rules.
4. Existing CUCAS data as a retained lower-priority legacy/discovery source during the transition period.

GSC takes precedence over conflicting retained CUCAS values unless a deliberate manual override is recorded.

Do not delete retained CUCAS records during this migration. Mark/retain their provenance so they can be removed later without damaging canonical records.

## Data ingestion

```text
GSC trusted seed
   -> normalize
   -> deduplicate
   -> Neon
   -> targeted enrichment for missing/flagged fields
   -> targeted verification only when needed

Retained CUCAS legacy data
   -> lower priority
   -> compare against canonical GSC records
   -> preserve provenance
   -> removable later by source migration
```

## Guides and Insights policy

The reference site's guide and insight topics can be used to identify useful subject areas and information architecture. Do not reproduce full third-party guide articles verbatim. Create original English-language China Uni Tracker guides based on the useful facts, topics and structure, while removing all GSC branding, calls-to-action and consultancy-specific references.

Planned original guides:
- Study in China Guide
- Student Guide
- First Week / Arrival Guide
- Admission & Application Guide
- Scholarship Guide
- CSCA Guide
- Pre-departure Checklist
- Arrival & Campus Setup Checklist
- China Student Documents Guide
- Medical / Foreigner Physical Examination Guide

If a reference page contains GSC-specific mentions, record them internally as removal/redaction targets rather than publishing them.

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
- other degree/non-degree programs
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

Use useful interaction patterns from the reference site, but make China Uni Tracker more polished and research-oriented with its own branding, copy and visual system.

### Directory
- prominent search
- China/province/city filters
- classification badges
- degree/language/tuition/scholarship filters
- result count + active filter chips
- rich university cards
- university name itself is clickable
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
- university contact block
- direct official application links
- program-level official links when available

### Program actions

Each program should support:
- View program details
- Official program page
- Apply, only when an official application/program URL is available
- Tuition/language/duration summary
- Requirements summary

A university's main `Official Website` action must point to the canonical university domain. Program `Apply` actions must point to the official university/application destination, not a consultancy route.

### Major explorer

Create a major/discipline explorer supporting:
- degree level
- language
- discipline cluster
- individual major
- university count
- university list for a selected major
- direct university profile navigation
- direct official program/application links when available

Initial discipline clusters may include:
- Engineering & Technology
- Computer Science & Data
- Medicine & Health
- Natural Sciences
- Business, Economics & Management
- Chinese Language & Literature
- Humanities & Social Sciences
- Law & Public Policy
- Architecture & Design
- Agriculture & Forestry
- Food Science & Safety
- Arts, Media & Photography

Descriptions must be original China Uni Tracker copy rather than copied reference-site prose.

## Navigation

Desktop:
- Universities
- Majors
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

Guide pages should be original English content, fact-focused, source-aware and free of GSC-specific branding.

## Loading and interaction polish

Do not show a loading screen for every normal navigation. Use loading states only when data fetching/rendering is actually delayed or when a route needs a meaningful asynchronous load.

Loading states should:
- be short and unobtrusive;
- show rotating educational China-study micro-facts/tips;
- avoid distracting animation;
- remain accessible with reduced-motion support.

Use restrained micro-interactions such as subtle card transitions, floating educational snippets, filter transitions and reading-progress indicators. Do not let animation interfere with research tasks.

## Branding

Brand: **China Uni Tracker**

Footer tagline:

> Guiding your China study journey with trusted university information.

No founder section for now.

## Visitor counter

Use an aggregate counter backed by our own database/analytics. Do not invent a number and do not copy another site's visitor count.

The displayed number must come from actual project metrics.

## User reports

Keep the existing report/wrong-information flow. Reports should be associated with the affected university/program/source where possible and become targeted verification tasks rather than triggering broad re-crawls.

## Neon deployment rule

Repeated crawler runs do not make the existing Neon data irrelevant. If Vercel continues pointing to the same Neon project/database/branch and the schema remains compatible, existing records stay available after deployment.

Do not format/reset Neon as part of deployment. Use incremental upserts and deduplication. Keep legacy CUCAS provenance during the transition. A later source cleanup can remove CUCAS-derived records after canonical GSC coverage is confirmed and after a backup/export.
