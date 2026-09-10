# AI Trend News Bot — IMPLEMENTATION PLAN V2
## Localhost-First AI Video Factory + Multi-Platform Publishing

**Version:** 2.0  
**Target:** Local Windows development machine  
**Stack:** Node.js + JavaScript/TypeScript + Remotion + SQLite + Gemini + Edge TTS  
**Platforms:** YouTube Shorts, TikTok, Instagram Reels, Facebook Reels

---

## 1. Executive Summary

AI Trend News Bot should evolve from a script-based news-to-YouTube pipeline into a **local-first AI Video Factory**.

The canonical flow is:

```text
NEWS / RSS
   ↓
COLLECT
   ↓
NORMALIZE
   ↓
EXACT DEDUP
   ↓
SEMANTIC DEDUP
   ↓
EVENT CLUSTERING
   ↓
RESEARCH
   ├── PRIMARY SOURCE DISCOVERY
   ├── EVIDENCE
   ├── CLAIMS
   ├── CONTRADICTIONS
   └── TIMELINE
   ↓
FACT CHECK
   ↓
STORY PACKAGE
   ↓
STORYBOARD
   ↓
ASSET PLANNING
   ↓
TTS + SUBTITLES
   ↓
REMOTION
   ├── YouTube Shorts
   ├── TikTok
   ├── Instagram Reels
   └── Facebook Reels
   ↓
FINAL FACT CHECK
   ↓
QC
   ↓
HUMAN APPROVAL
   ↓
PUBLISHING QUEUE
   ↓
MULTI-PLATFORM PUBLISH
   ↓
ANALYTICS
   ↓
FEEDBACK / OPTIMIZATION
```

The entire factory runs on the user's **localhost PC**. No cloud application server is required initially.

The design must nevertheless use clean domain boundaries so it can later migrate to PostgreSQL, object storage, cloud workers, or a hosted dashboard without rewriting the core business logic.

---

# 2. Product Principles

1. **Local-first.**
2. **Event-first, not article-first.**
3. **Research once, generate many stories.**
4. **Evidence before narrative.**
5. **Every important claim must be traceable to evidence.**
6. **Final fact checking is independent from script generation.**
7. **Real/official/licensed media is preferred.**
8. **AI B-roll is used only when it adds real value.**
9. **Never fabricate quotes, numbers, dates, sources, or events.**
10. **Never create dummy audio/video and call it successful.**
11. **Platform publishing is independent per platform.**
12. **Official APIs are preferred over browser automation.**
13. **Human approval is the default before automatic publishing.**
14. **SQLite is the authoritative local state.**
15. **All important outputs are versioned and reproducible.**
16. **Analytics should eventually feed back into topic/story decisions.**

---

# 3. Current Repository

Current project contains:

```text
bin/
build/
public/
src/
.gitignore
.prettierrc
IMPLEMENTATION-PLAN.md
LICENSE
README.md
auto_pipeline.js
config.example.json
dashboard.js
db_jobs.json
eslint.config.mjs
generateAudio.js
generateTechTts.py
generateTrafficTts.py
generateTts.py
generate_tech_audio.py
makeCaptions.py
out.png
package-lock.json
package.json
parseTech.py
remotion.config.ts
test_collector.js
test_factory.js
test_researcher.js
trend_bot.js
upload_youtube.js
```

Existing `src` areas:

```text
BusinessNews/
DynamicNews/
HelloWorld/
SportsNews/
TechNews/
TrafficNews/
ai/
collector/
design/
engine/
scheduler/
scraper/
```

The refactor should preserve useful existing functionality while eliminating duplicate/legacy pipelines.

---

# 4. Main Problems in Current Architecture

## 4.1 Script-centric pipeline

Current architecture is approximately:

```text
RSS
→ trend_bot.js
→ Gemini
→ auto_pipeline.js
→ scraper
→ Gemini
→ TTS
→ Python duration
→ Remotion
→ YouTube
```

Problems:

- no authoritative persistent workflow state
- JSON job storage
- stdout parsing used as state
- tight coupling
- weak recovery
- weak idempotency
- article-level rather than event-level processing
- semantic duplicate events are not handled
- fact checking is too weak
- no independent final verification
- asset rights/provenance are weak
- publishing is YouTube-specific
- no TikTok/Instagram/Facebook abstraction
- no platform-specific metadata
- no independent platform retry
- no platform analytics model

---

# 5. Target Localhost Architecture

```text
                         LOCALHOST PC
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Dashboard :4000                                            │
│       │                                                     │
│       ▼                                                     │
│  Application / Factory Orchestrator                         │
│       │                                                     │
│       ├─────────────── SQLite: data/factory.db              │
│       │                                                     │
│       ├── Scheduler / Worker                                │
│       ├── Collector                                         │
│       ├── Event + Dedup                                     │
│       ├── Research / Verification                           │
│       ├── Story / Script / Storyboard                       │
│       ├── Assets                                             │
│       ├── Voice / TTS                                       │
│       ├── Subtitles                                         │
│       ├── Remotion Renderer                                 │
│       ├── QC                                                │
│       └── Publishing                                        │
│                                                             │
│  data/                                                      │
│   ├── factory.db                                            │
│   ├── articles/                                             │
│   ├── events/                                               │
│   ├── research/                                             │
│   ├── stories/                                              │
│   ├── assets/                                               │
│   ├── audio/                                                │
│   ├── subtitles/                                            │
│   ├── renders/                                              │
│   ├── thumbnails/                                           │
│   ├── publications/                                         │
│   └── logs/                                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘

External services:
Gemini / News / TTS / YouTube / TikTok / Meta APIs
```

The PC is the factory. External services are providers, not the application itself.

---

# 6. Local Directory Layout

Recommended:

```text
data/
├── factory.db
├── cache/
├── articles/
├── events/
├── research/
├── stories/
├── assets/
├── audio/
├── subtitles/
├── renders/
│   ├── master/
│   ├── youtube/
│   ├── tiktok/
│   ├── instagram/
│   └── facebook/
├── thumbnails/
├── manifests/
├── publications/
├── logs/
├── temp/
└── secrets/
```

Add to `.gitignore`:

```gitignore
data/
*.db
*.db-shm
*.db-wal
.env
.env.*
data/secrets/
tokens/
*.token.json
client_secret*.json
```

Never commit OAuth tokens or API keys.

---

# 7. Recommended Project Structure

```text
src/
├── application/
│   ├── video_factory_pipeline.js
│   └── services/
│       ├── collection_service.js
│       ├── event_service.js
│       ├── research_service.js
│       ├── story_service.js
│       ├── asset_service.js
│       ├── voice_service.js
│       ├── subtitle_service.js
│       ├── render_service.js
│       ├── verification_service.js
│       ├── qc_service.js
│       ├── publication_service.js
│       └── analytics_service.js
│
├── domain/
│   ├── article/
│   ├── source/
│   ├── event/
│   ├── claim/
│   ├── evidence/
│   ├── story/
│   ├── asset/
│   ├── render/
│   ├── publication/
│   └── analytics/
│
├── ai/
│   ├── providers/
│   │   └── gemini.js
│   ├── agents/
│   │   ├── researcher.js
│   │   ├── verifier.js
│   │   ├── story_planner.js
│   │   ├── script_writer.js
│   │   ├── visual_planner.js
│   │   └── editorial_qc.js
│   ├── prompts/
│   ├── schemas/
│   └── model_router.js
│
├── collector/
│   ├── adapters/
│   │   ├── base.js
│   │   ├── rss.js
│   │   ├── article.js
│   │   └── arxiv.js
│   ├── registry.js
│   ├── normalizer.js
│   └── index.js
│
├── dedup/
│   ├── exact.js
│   ├── semantic.js
│   └── event_clusterer.js
│
├── research/
│   ├── researcher.js
│   ├── primary_source_finder.js
│   ├── contradiction_detector.js
│   ├── research_budget.js
│   └── timeline.js
│
├── topic/
│   ├── ontology.js
│   ├── classifier.js
│   ├── diversity.js
│   └── saturation.js
│
├── assets/
│   ├── providers/
│   ├── planner.js
│   ├── registry.js
│   ├── rights.js
│   └── provenance.js
│
├── voice/
│   ├── providers/
│   ├── profiles.js
│   ├── pronunciation.js
│   ├── timing.js
│   └── cache.js
│
├── subtitles/
│   ├── generator.js
│   ├── aligner.js
│   └── formats/
│
├── render/
│   ├── renderer.js
│   ├── chunker.js
│   ├── profiles.js
│   └── manifest.js
│
├── remotion/
│   ├── compositions/
│   ├── scenes/
│   ├── layouts/
│   ├── components/
│   └── templates/
│
├── scheduler/
│   ├── queue.js
│   ├── worker.js
│   ├── pipeline.js
│   ├── states.js
│   ├── retry.js
│   └── dlq.js
│
├── publishing/
│   ├── publisher.js
│   ├── metadata.js
│   ├── scheduler.js
│   ├── adapters/
│   │   └── platform_adapter.js
│   └── providers/
│       ├── youtube.js
│       ├── tiktok.js
│       ├── instagram.js
│       └── facebook.js
│
├── analytics/
│   ├── youtube.js
│   ├── tiktok.js
│   ├── instagram.js
│   ├── facebook.js
│   ├── metrics.js
│   └── feedback.js
│
├── storage/
│   ├── db.js
│   ├── migrations/
│   └── repositories/
│
├── security/
│   ├── url_validator.js
│   ├── secrets.js
│   └── sanitizer.js
│
└── observability/
    ├── logger.js
    ├── metrics.js
    └── tracing.js
```

---

# 8. Canonical Domain Flow

The canonical chain is:

```text
SOURCE
  ↓
ARTICLE
  ↓
EVENT
  ↓
CLAIMS
  ↓
EVIDENCE
  ↓
RESEARCH PACKAGE
  ↓
STORY
  ↓
STORY VERSION
  ↓
RENDER
  ↓
PUBLICATION
```

An article is not the canonical editorial object.

An event is.

---

# 9. Event-First Architecture

Example:

```text
10 websites report:
"Company X announces AI Model Y"
```

Do not create 10 independent videos.

Create:

```text
EVENT-001
├── source A
├── source B
├── source C
├── official announcement
├── timeline
└── verified claims
```

Then create:

```text
Story A → 60 sec breaking news
Story B → 90 sec explainer
Story C → 3 min deeper explanation
Story D → Vietnam angle
Story E → follow-up
```

Research is reused.

---

# 10. Source Registry

Persistent fields:

```text
sourceId
name
domain
type
country
language
trustLevel
primarySource
rssUrl
articlePattern
enabled
rateLimit
robotsPolicy
lastFetchedAt
```

Types:

```text
OFFICIAL
GOVERNMENT
ACADEMIC
WIRE
MAJOR_NEWS
SPECIALIZED
BLOG
SOCIAL
AGGREGATOR
UNKNOWN
```

Trust level is a signal, not proof.

---

# 11. Collection

Collector should:

1. fetch RSS
2. fetch supported article sources
3. normalize data
4. canonicalize URLs
5. extract metadata
6. detect language
7. persist article
8. calculate content hash
9. queue for deduplication

Article fields:

```text
title
description
url
canonicalUrl
sourceId
author
publishedAt
updatedAt
language
content
contentHash
metadata
```

---

# 12. Deep Scraping

Existing `src/scraper/browser.js` is useful but should be hardened.

Extraction order:

```text
JSON-LD
→ OpenGraph
→ Readability
→ Cheerio
→ source-specific adapter
```

Extract:

```text
canonical URL
title
author
published time
modified time
language
description
body
images
JSON-LD
```

Detect:

```text
paywall
consent wall
anti-bot
empty content
login page
```

Do not silently treat an error page as article content.

---

# 13. Exact Deduplication

Use:

```text
canonical URL
normalized title
content hash
source external ID
```

Cache can optimize this, but cache is not authoritative state.

---

# 14. Semantic Deduplication

Different headlines can describe the same event.

Compare:

```text
title
summary
entities
time
location
keywords
```

Output:

```text
NEW_EVENT
EXISTING_EVENT
POSSIBLE_DUPLICATE
```

---

# 15. Event Clustering

Persistent event fields:

```text
eventId
canonicalTopic
entities
locations
startTime
lastUpdatedAt
status
importance
sourceCount
primarySourceId
```

Lifecycle:

```text
DETECTED
DEVELOPING
CONFIRMED
RESOLVED
UPDATED
CORRECTED
RETRACTED
```

---

# 16. Event Timeline

Maintain a timeline:

```text
10:05 Official announcement
10:17 News report
10:31 Company clarification
11:02 Government statement
12:15 Correction
```

The timeline prevents stale facts from being presented as current.

---

# 17. Research Architecture

Research stages:

```text
source discovery
→ primary source discovery
→ evidence collection
→ claim extraction
→ contradiction detection
→ timeline
→ impact analysis
→ confidence scoring
```

Research depth should depend on:

```text
importance
risk
controversy
source disagreement
audience impact
budget
```

---

# 18. Primary Source Discovery

Attempt to find:

- official announcements
- government statements
- company filings
- research papers
- original datasets
- court documents
- original interviews
- original videos

A secondary article should not automatically outrank primary evidence.

---

# 19. Claim Model

Recommended statuses:

```text
VERIFIED
PARTIALLY_VERIFIED
CONFLICTING
UNVERIFIED
FALSE
OUTDATED
RETRACTED
```

Example:

```json
{
  "claimId": "C-001",
  "statement": "Company X released Model Y",
  "status": "VERIFIED",
  "evidence": [
    {
      "sourceId": "official-company",
      "url": "...",
      "quote": "...",
      "context": "official announcement"
    }
  ]
}
```

---

# 20. Verification Rule

Do not use:

```text
evidence exists => VERIFIED
```

Verification must consider:

```text
source reliability
source relevance
quote support
date
context
claim scope
contradictions
```

The model must not silently turn uncertainty into certainty.

---

# 21. Contradiction Detection

Example:

```text
Source A → 100 people affected
Source B → 120 people affected
```

Do not arbitrarily choose one.

Mark:

```text
CONFLICTING
```

Then:

- search for primary evidence
- state uncertainty
- report a range
- or omit the disputed detail

---

# 22. AI Agent Architecture

Use specialized agents:

```text
Researcher
   ↓
Verifier
   ↓
Story Planner
   ↓
Script Writer
   ↓
Visual Planner
   ↓
Final Verifier
   ↓
Editorial QC
```

All agents should consume/produce structured schemas.

---

# 23. Gemini Configuration

Remove speculative model names from the old `src/ai/agents.js`.

Do not use unsupported hard-coded fallbacks.

Use:

```env
GEMINI_API_KEY=
GEMINI_MODEL=
GEMINI_FALLBACK_MODEL=
```

Only configured/verified models may be used.

---

# 24. Model Router

Create:

```text
src/ai/model_router.js
```

Responsibilities:

- task-based model selection
- transient retry
- JSON/schema validation
- usage/cost tracking
- configured fallback
- timeout handling

---

# 25. Story Package

The StoryPackage is the canonical content artifact.

Example:

```json
{
  "storyId": "ST-001",
  "eventId": "EV-001",
  "version": 3,
  "language": "vi",
  "audience": "general",
  "angle": "why_it_matters",
  "targetDurationSec": 60,
  "title": "...",
  "hook": "...",
  "claims": [],
  "scenes": [],
  "assets": [],
  "voice": {},
  "subtitles": {},
  "platforms": []
}
```

---

# 26. Story Variants

One research package should generate:

```text
30 sec
60 sec
90 sec
3 min
5 min
8 min
10 min
```

Do not research the same event again for each duration.

---

# 27. Retention

Every 15–30 seconds should add meaningful value:

```text
new fact
new visual
question
consequence
comparison
timeline point
implication
```

Avoid generic AI-news filler.

---

# 28. Scientific / Medical / Legal / Financial Content

Scientific stories should distinguish:

```text
abstract
method
sample
results
limitations
peer-review status
real-world interpretation
```

Never convert correlation into causation.

Medical content must not become diagnosis or prescription.

High-risk subjects require stricter QC and human review.

---

# 29. Asset Architecture

Priority:

```text
official
licensed
public domain
properly attributed
generated graphics
AI B-roll when justified
```

Avoid generic:

```text
futuristic AI city
robot walking
random server room
fake breaking-news imagery
```

when they do not represent the actual story.

---

# 30. Asset Provenance

Each asset:

```text
assetId
type
path
sourceUrl
sourceName
license
attribution
rightsStatus
createdAt
contentHash
```

If rights are unknown:

```text
DO_NOT_PUBLISH
```

or require approval.

---

# 31. Voice Service

Consolidate old TTS scripts into:

```text
src/voice/
├── providers/
├── profiles.js
├── pronunciation.js
├── timing.js
└── cache.js
```

Voice profile:

```json
{
  "id": "vi-news-female-01",
  "language": "vi-VN",
  "voice": "...",
  "rate": "+5%",
  "pitch": "+0Hz"
}
```

---

# 32. TTS Failure Policy

Never do:

```text
TTS failed
→ dummy audio
→ success
```

Correct:

```text
TTS failed
→ retry
→ alternate configured provider/voice
→ retry job
→ DLQ after max attempts
```

---

# 33. Audio Timing

Actual audio duration is authoritative.

Do not use:

```text
max(realDuration, declaredDuration)
```

as the primary duration rule.

Visual hold/padding must be bounded.

No accidental long silence.

---

# 34. Subtitle Engine

One canonical subtitle service:

```text
src/subtitles/
```

Support:

```text
SRT
VTT
ASS
burned-in subtitles
```

Requirements:

- Vietnamese diacritics
- timing
- line length
- safe area
- no overlaps
- configurable styling
- accessibility

---

# 35. Remotion

Use profile-driven rendering.

Do not hard-code FPS, width, height inside the engine.

Example:

```json
{
  "youtubeShorts": {
    "width": 1080,
    "height": 1920,
    "fps": 30
  },
  "tiktok": {
    "width": 1080,
    "height": 1920,
    "fps": 30
  },
  "instagramReels": {
    "width": 1080,
    "height": 1920,
    "fps": 30
  },
  "facebookReels": {
    "width": 1080,
    "height": 1920,
    "fps": 30
  }
}
```

Platform constraints must be validated by providers because requirements can change.

---

# 36. Multi-Format Rendering

The StoryPackage should not know how each platform is rendered.

Use:

```text
StoryPackage
      ↓
RenderProfile
      ↓
Platform Render
```

Outputs:

```text
data/renders/youtube/ST-001-v3.mp4
data/renders/tiktok/ST-001-v3.mp4
data/renders/instagram/ST-001-v3.mp4
data/renders/facebook/ST-001-v3.mp4
```

If identical, one master vertical render can be reused.

---

# 37. Thumbnail

Store:

```text
thumbnailId
storyId
variant
imagePath
headline
experimentId
```

Later support A/B tests.

---

# 38. Render Manifest

Every render gets a manifest:

```json
{
  "storyId": "ST-001",
  "storyVersion": 3,
  "renderProfile": "youtubeShorts",
  "video": "data/renders/youtube/ST-001-v3.mp4",
  "audio": "...",
  "subtitles": "...",
  "assets": [],
  "claims": [],
  "generatedAt": "...",
  "hash": "..."
}
```

---

# 39. SQLite

Replace:

```text
db_jobs.json
```

with:

```text
data/factory.db
```

SQLite is appropriate for a single-machine local factory.

Benefits:

- transactions
- persistence
- indexes
- concurrent reads
- crash recovery
- easy dashboard queries
- no database server

---

# 40. Database Tables

Recommended:

```text
sources
source_fetches
articles
article_versions

events
event_sources
event_timeline

claims
claim_evidence
claim_contradictions

research_packages
research_runs

stories
story_versions
story_claims
story_scenes

assets
asset_sources
asset_rights
asset_versions

voices
voice_pronunciations
tts_jobs

renders
render_scenes

qc_runs
qc_findings

jobs
job_events
job_attempts

publications
publication_attempts

 topic_taxonomy
topic_coverage

analytics_snapshots
experiments
cost_events
corrections
```

---

# 41. Job State Machine

Use:

```text
PENDING
COLLECTING
NORMALIZING
DEDUPLICATING
CLUSTERING
RESEARCHING
VERIFYING
STORY_PLANNING
SCRIPTING
STORYBOARDING
ASSET_PLANNING
ASSET_FETCHING
VOICE_GENERATING
SUBTITLE_GENERATING
RENDERING
FINAL_FACT_CHECK
QC
APPROVAL
PUBLISHING
PUBLISHED
CANCELLED
RETRYING
DLQ
FAILED
```

---

# 42. Job Schema

```text
jobId
idempotencyKey
eventId
storyId
stage
status
priority
attempts
maxAttempts
lockedBy
lockedAt
scheduledAt
startedAt
finishedAt
errorCode
errorMessage
payload
createdAt
updatedAt
```

---

# 43. Idempotency

Every stage must tolerate duplicate execution.

Key:

```text
job/stage + inputHash
```

For publishing:

```text
storyId
+
platform
+
accountId
+
renderHash
+
metadataVersion
```

Before creating a remote publication, query local/remote state.

---

# 44. Retry

Use:

```text
exponential backoff + jitter
```

Classify errors:

```text
RETRYABLE
NON_RETRYABLE
AUTH_ERROR
RATE_LIMIT
CONTENT_ERROR
SYSTEM_ERROR
```

Example:

```text
5s
15s
45s
2m
5m
```

---

# 45. Dead Letter Queue

After maximum attempts:

```text
FAILED → DLQ
```

Dashboard should show:

```text
job
stage
error
attempts
last attempt
retry
```

---

# 46. Crash Recovery

On localhost restart:

```text
find jobs with expired locks
→ unlock
→ RETRYING
→ resume
```

Do not regenerate everything.

---

# 47. Scheduler

Use database-backed scheduling.

Examples:

```text
collect trends every 10 minutes
research queue continuously
render queue continuously
publish according to schedule
analytics periodically
```

`setInterval()` can trigger checks but must not be the authoritative state.

---

# 48. Dashboard

Current `dashboard.js` should stop inferring state from stdout.

Target:

```text
Dashboard
→ REST API
→ SQLite
```

SSE can remain for live events/logs, but SQLite is authoritative.

Pages:

```text
Overview
Jobs
Events
Research
Stories
Renders
Approval
Publishing
Analytics
Sources
Settings
Logs
DLQ
```

---

# 49. Dashboard Overview

Show:

```text
Today
├── collected
├── events
├── stories
├── renders
├── approved
├── published
└── failures
```

Platform cards:

```text
YouTube
TikTok
Instagram
Facebook
```

with:

```text
published
scheduled
pending
failed
```

---

# 50. Human Approval

Default:

```text
GENERATE
→ FINAL FACT CHECK
→ QC
→ HUMAN APPROVAL
→ PUBLISH
```

Approval screen:

```text
video
title
caption
claims
sources
asset rights
platform metadata
```

Actions:

```text
Approve
Reject
Edit
Regenerate
Publish
Schedule
```

---

# 51. Multi-Platform Publishing — P1

This is a first-class subsystem.

```text
src/publishing/
├── publisher.js
├── metadata.js
├── scheduler.js
├── adapters/
│   └── platform_adapter.js
└── providers/
    ├── youtube.js
    ├── tiktok.js
    ├── instagram.js
    └── facebook.js
```

Each provider is independent.

---

# 52. Platform Adapter

Conceptual contract:

```javascript
class PlatformAdapter {
  authenticate() {}
  validateAccount() {}
  validateMedia() {}
  upload() {}
  schedule() {}
  publish() {}
  getPublication() {}
  getAnalytics() {}
  deletePublication() {}
}
```

A provider should expose only operations actually supported by the current platform/API/account.

---

# 53. YouTube Shorts

Move:

```text
upload_youtube.js
```

to:

```text
src/publishing/providers/youtube.js
```

Use the official YouTube APIs.

Responsibilities:

```text
OAuth
token refresh
account validation
media validation
upload
metadata
privacy
scheduling where supported
publication status
analytics
retry
```

Do not hard-code:

```text
out/auto_news_result.mp4
```

Read the render manifest instead.

---

# 54. TikTok

Create:

```text
src/publishing/providers/tiktok.js
```

Use TikTok's official developer/publishing APIs available to the approved application/account.

Responsibilities:

```text
OAuth
account validation
media validation
upload/publish
status
retry
analytics where permitted
```

Important:

API products, publishing permissions, account eligibility, region, and approval requirements can differ.

The provider must check actual account capability rather than assuming every TikTok account has every API feature.

---

# 55. Instagram Reels

Create:

```text
src/publishing/providers/instagram.js
```

Use Meta's official Graph API capabilities for Instagram publishing.

Typical architecture:

```text
prepare media
→ create media container
→ wait/process
→ publish container
→ store media ID
```

Capabilities depend on:

```text
Instagram account type
Meta setup
Facebook Page/business connection
app permissions
API version
```

Validate before publishing.

---

# 56. Facebook Reels

Create:

```text
src/publishing/providers/facebook.js
```

Use official Meta APIs supported by the target Page/account.

Responsibilities:

```text
OAuth/token
Page/account validation
media upload
publish
status
analytics
retry
```

---

# 57. No Browser Automation for Social Publishing

Do not build production publishing as:

```text
Puppeteer
→ login
→ click upload
→ type caption
→ publish
```

Prefer official APIs.

Browser automation is brittle because of:

- UI changes
- MFA
- CAPTCHA
- session expiration
- account security
- rate limits
- platform terms

Puppeteer can remain for article scraping where justified.

---

# 58. OAuth and Token Storage

Never store:

```text
API keys
client secrets
access tokens
refresh tokens
```

in source code or Git.

Use:

```text
.env
+
local secure token storage
```

Recommended token record:

```text
provider
accountId
accessToken
refreshToken
expiresAt
scopes
createdAt
updatedAt
```

Encrypt at rest where practical.

Never display tokens in dashboard.

---

# 59. Platform Accounts

Dashboard:

```text
Settings
→ Publishing Accounts
```

Example:

```text
YouTube       Connected
TikTok        Connected
Instagram     Connected
Facebook      Connected
```

Actions:

```text
Connect
Reconnect
Disconnect
Test connection
```

---

# 60. Publication Model

Each platform gets an independent record:

```text
publicationId
storyId
renderId
platform
accountId
platformVideoId
status
scheduledAt
publishedAt
url
title
caption
metadataVersion
attempt
lastError
createdAt
updatedAt
```

---

# 61. Platform Failure Isolation

Example:

```text
Story ST-100
│
├── YouTube      ✓ PUBLISHED
├── TikTok       ↻ RETRYING / 429
├── Instagram    ✓ PUBLISHED
└── Facebook     ! AUTH_ERROR
```

The story itself is not failed.

Only the affected publication is failed/retrying.

---

# 62. Publication Idempotency

Before publishing:

```text
storyId + platform + accountId + renderHash + metadataVersion
```

Check local database.

If:

```text
PUBLISHED
```

do not upload again.

If remote status is uncertain:

```text
query remote publication
```

before creating another upload.

This protects against:

```text
remote upload succeeds
→ localhost crashes
→ restart
→ accidental duplicate upload
```

---

# 63. Platform Metadata

One StoryPackage generates different metadata.

```text
StoryPackage
├── YouTubeMetadata
├── TikTokMetadata
├── InstagramMetadata
└── FacebookMetadata
```

YouTube:

```text
title
description
hashtags
category
language
privacy
```

TikTok:

```text
caption
hashtags
keywords
```

Instagram:

```text
caption
hashtags
```

Facebook:

```text
description
hashtags
link
```

Do not blindly copy the same caption everywhere.

---

# 64. Metadata Rules

Metadata must remain factually consistent with the verified story.

Never generate:

```text
fake urgency
unsupported superlatives
fake numbers
fake quotes
```

just to improve CTR.

---

# 65. Platform Scheduling

Store:

```text
scheduledAt
timezone
platform
account
```

Example:

```text
YouTube      18:00
TikTok       19:00
Instagram    19:15
Facebook     20:00
```

Later optimize based on actual analytics.

---

# 66. Publishing Queue

Dashboard columns:

```text
Story
Platform
Account
Scheduled
Status
Attempts
Last Error
```

Actions:

```text
Publish now
Schedule
Reschedule
Retry
Cancel
Reconnect
```

---

# 67. Publishing Modes

Support:

```text
MANUAL
APPROVAL_REQUIRED
AUTO_PUBLISH
```

Recommended default:

```text
APPROVAL_REQUIRED
```

Only enable full automatic publishing after the pipeline has demonstrated stable QC.

---

# 68. Platform Compliance

Before publishing validate:

```text
duration
resolution
aspect ratio
codec
file size
caption limits
account permission
rate limits
API capability
```

Keep these rules inside platform providers/configuration so they can be updated without changing the content pipeline.

---

# 69. Analytics

Create:

```text
analytics/
├── youtube.js
├── tiktok.js
├── instagram.js
├── facebook.js
├── metrics.js
└── feedback.js
```

Track available metrics:

```text
views
likes
comments
shares
watch time
average watch time
completion rate
followers/subscribers gained
engagement rate
```

Exact metrics depend on platform API access.

---

# 70. Analytics Feedback

Eventually optimize:

```text
topic
hook
duration
posting time
voice
visual density
thumbnail
caption
```

Example:

```text
Topic A
→ high completion
→ increase ranking

Topic B
→ low retention
→ reduce frequency

Hook C
→ strong early retention
→ test more
```

Do not optimize only for raw views.

---

# 71. Topic Engine

Taxonomy:

```text
AI
Technology
Business
Science
Health
Finance
World
Vietnam
Sports
Traffic
```

Track:

```text
recent coverage
topic saturation
audience performance
source diversity
```

Prevent the factory from producing repetitive videos about the same subject.

---

# 72. Diversity Ranking

Candidate ranking can combine:

```text
trend score
impact
source confidence
novelty
audience interest
topic diversity
production cost
saturation penalty
```

---

# 73. Correction System

If an important source publishes a correction:

```text
source correction
→ article version
→ event
→ claim
→ story
→ publication
```

Track:

```text
correctionId
sourceId
eventId
claimId
storyId
reason
severity
detectedAt
resolvedAt
```

If a published video contains a corrected claim, dashboard must flag it.

---

# 74. Final Fact Check

Before publish:

```text
final script
+
claim registry
+
evidence
+
latest event timeline
```

Run an independent verifier.

Result:

```text
PASS
FAIL
REVIEW
```

Check:

- unsupported numbers
- invented quotes
- incorrect dates
- wrong names
- wrong causality
- stale claims
- contradictions
- exaggerated wording
- unsupported certainty

---

# 75. QC Architecture

Separate:

```text
Schema QC
Fact QC
Editorial QC
Visual QC
Audio QC
Subtitle QC
Rights QC
Platform QC
```

---

# 76. Visual QC

Check:

```text
resolution
aspect ratio
duration
black frames
frozen frames
missing assets
subtitle safe area
text overflow
audio/video sync
```

---

# 77. Audio QC

Check:

```text
audio exists
duration > 0
valid codec
volume
clipping
silence
sync
```

A dummy or invalid audio file must never pass.

---

# 78. Security — SSRF

Scraping must validate URLs.

Block by default:

```text
localhost
127.0.0.1
0.0.0.0
private IPv4 ranges
link-local
metadata endpoints
internal hostnames
```

unless explicitly allowlisted.

---

# 79. Security — Shell Injection

Avoid:

```javascript
execSync(`command ${filePath}`)
```

Use:

```text
spawn()
spawnSync()
```

with argument arrays.

Validate all paths.

---

# 80. Resource Limits

Set:

```text
maximum article size
maximum image size
maximum HTTP response
maximum concurrent browsers
maximum concurrent downloads
maximum concurrent TTS
maximum concurrent renders
maximum render duration
```

Local machine example:

```text
browsers = 2
renders = 1
tts = 3
```

Tune for actual hardware.

---

# 81. Caching

Cache:

```text
RSS
article fetches
AI results where appropriate
TTS
assets
render intermediates
```

Cache key should include:

```text
provider
model
promptVersion
inputHash
configuration
```

Old cache must not silently override a newer research version.

---

# 82. Versioning

Version:

```text
prompts
models
schemas
research
stories
scripts
storyboards
assets
voices
render profiles
metadata
```

Example:

```text
storyVersion = 4
promptVersion = 7
renderProfileVersion = 2
metadataVersion = 3
```

---

# 83. Reproducibility

A video must be reproducible from:

```text
event
research package
story version
claims
assets
voice
prompt version
render profile
```

---

# 84. Cost Tracking

Track:

```text
AI tokens
AI calls
TTS duration
asset downloads
render time
```

Table:

```text
cost_events
├── eventId
├── jobId
├── provider
├── service
├── inputUnits
├── outputUnits
├── estimatedCost
└── createdAt
```

---

# 85. Logging

Structured log example:

```json
{
  "jobId": "JOB-001",
  "eventId": "EV-001",
  "stage": "RESEARCHING",
  "durationMs": 4300,
  "status": "SUCCESS"
}
```

Never log:

```text
API keys
OAuth tokens
refresh tokens
cookies
credentials
```

---

# 86. Observability

Track:

```text
pipeline duration
failure rate
retry count
AI latency
render latency
publication latency
```

---

# 87. Template Refactor

`DynamicNews` should become the primary generic composition driven by `StoryPackage`.

Other templates:

```text
BusinessNews
SportsNews
TechNews
TrafficNews
```

should become reusable layout/template primitives rather than independent business pipelines.

`HelloWorld` should move to examples or be removed later.

---

# 88. Shared Design System

Promote existing:

```text
SafeArea
ScrimOverlay
tokens
```

into reusable components.

Recommended:

```text
Headline
Kicker
StatCard
QuoteCard
Timeline
Chart
Map
ImagePanel
SourceBadge
ProgressBar
Subtitle
```

---

# 89. Scene Contract

Each scene should contain:

```text
id
narrativeArc
layoutType
headline
keyTakeaways
voiceover
durationSec
assetRefs
claimRefs
visualInstructions
```

`claimRefs` is mandatory for traceability.

---

# 90. Claim-to-Scene Traceability

Example:

```text
Scene 03
→ Claim C-04
→ Evidence E-12
→ Source S-03
```

This enables automatic final verification.

---

# 91. Full Traceability

```text
Publication
→ Render
→ Story Version
→ Scene
→ Claim
→ Evidence
→ Source
```

Any published factual statement can be traced back to its evidence.

---

# 92. Local File Naming

Use deterministic IDs:

```text
EV-20260910-001
ST-20260910-001
RN-20260910-001
PUB-20260910-001
```

Do not use human titles as primary IDs.

---

# 93. Configuration

Use `.env`.

Example:

```env
NODE_ENV=development

PORT=4000

DATA_DIR=./data
DATABASE_PATH=./data/factory.db

GEMINI_API_KEY=
GEMINI_MODEL=
GEMINI_FALLBACK_MODEL=

TTS_PROVIDER=edge
TTS_VOICE=vi-VN-HoaiMyNeural
TTS_RATE=+5%
TTS_PITCH=+0Hz

YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=

TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=

META_APP_ID=
META_APP_SECRET=

MAX_CONCURRENT_RENDERS=1
MAX_CONCURRENT_BROWSERS=2
MAX_CONCURRENT_TTS=3
```

---

# 94. Configuration Files

Use:

```text
config/
├── default.json
├── development.json
├── production.json
├── sources.json
├── voices.json
└── render_profiles.json
```

Secrets stay outside Git.

---

# 95. NPM Scripts

Target:

```json
{
  "scripts": {
    "dev": "node dashboard.js",
    "worker": "node src/scheduler/worker.js",
    "factory": "node src/application/video_factory_pipeline.js",
    "build": "remotion bundle",
    "lint": "eslint src && tsc",
    "test": "node --test",
    "db:migrate": "node src/storage/migrations/run.js",
    "publish": "node bin/publish.js"
  }
}
```

---

# 96. Localhost Startup

Recommended:

```text
Terminal 1:
npm run dev

Terminal 2:
npm run worker
```

One-shot:

```text
npm run factory
```

The dashboard remains:

```text
http://localhost:4000
```

---

# 97. Local Development / Dry Run

Add:

```env
DRY_RUN=true
```

In dry-run:

```text
collect ✓
research ✓
render ✓
QC ✓
publish ✗
```

Instead create publication records marked:

```text
DRY_RUN
```

---

# 98. Mock Providers

Create:

```text
src/publishing/providers/mock.js
```

Simulate:

```text
success
429
timeout
auth error
remote processing
duplicate request
```

Use it for integration tests.

---

# 99. Legacy File Migration

## `upload_youtube.js`

Move logic to:

```text
src/publishing/providers/youtube.js
```

Keep a temporary CLI wrapper if required.

## `dashboard.js`

Refactor into control-plane HTTP/SSE responsibilities.

## `auto_pipeline.js`

Replace with:

```text
src/application/video_factory_pipeline.js
```

Keep a temporary compatibility wrapper.

## `trend_bot.js`

Split into:

```text
collector
scheduler
topic ranking
```

## `src/ai/agents.js`

Deprecate and move useful functions into specialized agents.

## `src/ai/researcher.js`

Retain useful research code but split responsibilities.

## `src/scheduler/queue.js`

Rewrite around SQLite.

## `src/scheduler/pipeline.js`

Make it orchestration-only.

## `src/scheduler/qc.js`

Split into independent QC stages.

---

# 100. Legacy Python Scripts

Current:

```text
generateTts.py
generateTechTts.py
generateTrafficTts.py
generate_tech_audio.py
makeCaptions.py
parseTech.py
```

Consolidate useful functionality into:

```text
src/voice/
src/subtitles/
src/research/
```

Keep old scripts only during migration.

---

# 101. Dependency Review

Retain where useful:

```text
remotion
@remotion/cli
react
react-dom
zod
axios
googleapis
puppeteer
cheerio
jsdom
@mozilla/readability
rss-parser
bottleneck
node-cache
```

Add a SQLite package compatible with the Node version and Windows environment.

Before adding dependencies:

```text
check Node compatibility
check Windows/native build requirements
check license
```

---

# 102. Phase P0 — Reliability and Security

Implement first:

```text
P0.1 Remove dummy audio
P0.2 Remove fake/speculative model fallbacks
P0.3 Move secrets out of config/source
P0.4 SQLite persistence
P0.5 Idempotent jobs
P0.6 Unified AI pipeline
P0.7 Claim/evidence mapping
P0.8 Independent final fact check
P0.9 SSRF protection
P0.10 Safe process spawning
P0.11 Database-backed state instead of stdout
P0.12 Crash recovery
P0.13 Retry + DLQ
```

---

# 103. Phase P1 — Editorial Intelligence

```text
P1.1 Event clustering
P1.2 Semantic dedup
P1.3 Source trust
P1.4 Primary source discovery
P1.5 Research budget
P1.6 Event timeline
P1.7 Contradiction detection
P1.8 Story variants
P1.9 Asset provenance
P1.10 Rights registry
P1.11 Multi-format rendering
P1.12 Subtitle engine
P1.13 Human approval
```

---

# 104. Phase P1 — Multi-Platform Publishing

Implement:

```text
P1.14 Publishing adapter
P1.15 YouTube provider
P1.16 TikTok provider
P1.17 Instagram provider
P1.18 Facebook provider
P1.19 OAuth/account management
P1.20 Token refresh
P1.21 Platform metadata
P1.22 Platform render profiles
P1.23 Publication database
P1.24 Publication queue
P1.25 Idempotent publication
P1.26 Independent retries
P1.27 Scheduling
P1.28 Rate-limit handling
P1.29 Platform compliance validation
P1.30 Dashboard publishing UI
P1.31 Dry-run
P1.32 Mock providers
```

---

# 105. Phase P2 — Optimization

```text
P2.1 Topic ontology
P2.2 Topic saturation
P2.3 Cost engine
P2.4 Analytics aggregation
P2.5 Analytics feedback
P2.6 Thumbnail experiments
P2.7 Hook experiments
P2.8 Posting-time optimization
P2.9 Correction propagation
P2.10 Advanced provider abstraction
P2.11 Long-form chunking
P2.12 Controlled auto-publishing
```

---

# 106. Phase P3 — Advanced AI Video Factory

Future:

```text
trend forecasting
audience segmentation
automatic story portfolio
multi-language publishing
A/B hook generation
A/B thumbnail generation
publishing-time prediction
cross-platform performance prediction
automatic follow-up detection
automatic correction detection
```

---

# 107. Exact Implementation Order

```text
1. SQLite
2. migrations
3. repositories
4. job state machine
5. worker
6. idempotency
7. retry/DLQ
8. AI provider
9. researcher/verifier split
10. claim/evidence mapping
11. final verifier
12. TTS service
13. subtitle service
14. Remotion renderer
15. render profiles
16. manifests
17. asset provenance
18. event clustering
19. story versions
20. dashboard API
21. approval UI
22. publishing adapter
23. YouTube
24. TikTok
25. Instagram
26. Facebook
27. publication queue
28. independent platform retries
29. scheduling
30. analytics
31. feedback
32. controlled auto-publish
```

---

# 108. End-to-End Job Example

```text
JOB-001
│
├── COLLECTING ✓
├── NORMALIZING ✓
├── DEDUPLICATING ✓
├── CLUSTERING ✓
├── RESEARCHING ✓
├── VERIFYING ✓
├── STORY_PLANNING ✓
├── SCRIPTING ✓
├── STORYBOARDING ✓
├── ASSET_PLANNING ✓
├── ASSET_FETCHING ✓
├── VOICE_GENERATING ✓
├── SUBTITLE_GENERATING ✓
├── RENDERING ✓
├── FINAL_FACT_CHECK ✓
├── QC ✓
├── APPROVAL ✓
└── PUBLISHING
      ├── YouTube ✓
      ├── TikTok ✓
      ├── Instagram ✓
      └── Facebook ↻
```

---

# 109. E2E Test

Test:

```text
RSS fixture
→ article
→ event
→ claims
→ research
→ story
→ TTS
→ subtitles
→ render
→ final fact check
→ QC
→ mock YouTube
→ mock TikTok
→ mock Instagram
→ mock Facebook
```

Test failure cases:

```text
duplicate article
duplicate event
conflicting claims
invalid AI JSON
TTS failure
render failure
network timeout
OAuth expiry
429
remote upload success + local crash
duplicate publish
correction propagation
```

---

# 110. Golden Dataset

Create:

```text
tests/fixtures/
├── events/
├── articles/
├── research/
├── stories/
└── expected/
```

Use representative real-world cases.

Regression-test:

```text
claim extraction
fact status
story structure
scene mapping
```

---

# 111. Hallucination Canary

Test specifically for:

```text
invented quote
invented number
invented source
invented date
invented person
unsupported causality
```

Failures must be visible and block publishing.

---

# 112. Definition of Done — P0

```text
[ ] SQLite authoritative
[ ] jobs survive restart
[ ] no dummy audio
[ ] no fake model fallbacks
[ ] secrets removed
[ ] SSRF protection
[ ] safe process spawning
[ ] AI schema validation
[ ] claims map to evidence
[ ] independent final fact check
[ ] dashboard reads database
[ ] stdout no longer controls workflow
[ ] retry + DLQ
[ ] crash recovery
```

---

# 113. Definition of Done — Multi-Platform P1

```text
[ ] YouTube provider
[ ] TikTok provider
[ ] Instagram provider
[ ] Facebook provider
[ ] OAuth
[ ] token refresh
[ ] account validation
[ ] media validation
[ ] platform metadata
[ ] render profiles
[ ] publication records
[ ] publication attempts
[ ] idempotency
[ ] retry
[ ] rate-limit handling
[ ] independent status
[ ] scheduling
[ ] dashboard publishing UI
[ ] human approval
[ ] dry-run
[ ] mock providers
```

---

# 114. Definition of Done — Analytics

```text
[ ] platform analytics adapters
[ ] analytics snapshots
[ ] daily aggregation
[ ] story performance
[ ] topic performance
[ ] hook performance
[ ] duration performance
[ ] posting-time performance
[ ] feedback into ranking
```

---

# 115. Localhost Production Mode

Recommended stable flow:

```text
Collector
   ↓
Event Ranking
   ↓
Research
   ↓
Verification
   ↓
Story
   ↓
Render
   ↓
QC
   ↓
Approval
   ↓
Publishing Queue
   ↓
YouTube
TikTok
Instagram
Facebook
   ↓
Analytics
```

The PC becomes a continuously running local video factory.

---

# 116. Localhost Advantage

Local-first is appropriate because:

- Remotion rendering is resource-intensive
- video files are large
- TTS can run locally
- SQLite is sufficient for one machine
- no cloud database cost initially
- no object-storage bill initially
- dashboard is simple
- credentials remain under local control
- development/debugging is faster

---

# 117. Future Cloud Migration

Later:

```text
LOCAL SQLITE
    ↓
PostgreSQL

LOCAL FILES
    ↓
Object Storage

LOCAL WORKER
    ↓
Cloud Workers

LOCAL DASHBOARD
    ↓
Hosted Control Plane
```

The domain model and provider interfaces should remain unchanged.

---

# 118. Critical Architectural Rule

Do NOT define the canonical product as:

```text
YouTube video
```

The canonical product is:

```text
Verified StoryPackage
```

Then:

```text
StoryPackage
→ YouTube
→ TikTok
→ Instagram
→ Facebook
```

---

# 119. Second Critical Rule

Do NOT define the canonical editorial object as:

```text
Article
```

Use:

```text
Event
```

because:

```text
10 articles
→ 1 event

1 event
→ many stories

1 story
→ many platform publications
```

---

# 120. Production Publish Gate

Publishing is allowed only if:

```text
research.status = VERIFIED
story.status = READY
finalFactCheck = PASS
qc = PASS
approval = APPROVED
publication.account = CONNECTED
```

Otherwise:

```text
DO_NOT_PUBLISH
```

---

# 121. Final Architecture

```text
                         ┌───────────────────────┐
                         │   LOCAL DASHBOARD     │
                         │       :4000           │
                         └───────────┬───────────┘
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │        SQLITE         │
                         │      factory.db       │
                         └───────────┬───────────┘
                                     │
                                     ▼
┌───────────────┐          ┌──────────────────────┐
│ RSS / SOURCES │─────────▶│   FACTORY WORKER     │
└───────────────┘          └──────────┬───────────┘
                                      │
                                      ▼
                              NORMALIZE / DEDUP
                                      │
                                      ▼
                               EVENT CLUSTERING
                                      │
                                      ▼
                               DEEP RESEARCH
                                      │
                              ┌───────┴───────┐
                              ▼               ▼
                           CLAIMS          EVIDENCE
                              └───────┬───────┘
                                      ▼
                               FACT CHECK
                                      │
                                      ▼
                              STORY PACKAGE
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
                  ASSETS             TTS            SUBTITLES
                    └─────────────────┼─────────────────┘
                                      ▼
                                  REMOTION
                                      │
                         ┌────────────┼────────────┐
                         ▼            ▼            ▼
                       MASTER      THUMBNAIL    MANIFEST
                         │
                         ▼
                  FINAL FACT CHECK
                         │
                         ▼
                        QC
                         │
                         ▼
                     APPROVAL
                         │
                         ▼
                 PUBLISHING QUEUE
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼                ▼
    YOUTUBE           TIKTOK          INSTAGRAM         FACEBOOK
     SHORTS                           REELS             REELS
        │                │                │                │
        └────────────────┼────────────────┴────────────────┘
                         ▼
                      ANALYTICS
                         │
                         ▼
                  FEEDBACK ENGINE
                         │
                         └──────────────▶ TOPIC / STORY / PUBLISHING
                                          OPTIMIZATION
```

---

# 122. Final Priority Matrix

| Area | Priority | Reason |
|---|---:|---|
| SQLite state | P0 | Reliability |
| Idempotent jobs | P0 | Recovery |
| Remove dummy audio | P0 | Correctness |
| Secure AI configuration | P0 | Security |
| Claim/evidence mapping | P0 | Trust |
| Final fact check | P0 | Editorial safety |
| SSRF protection | P0 | Security |
| Safe process execution | P0 | Security |
| Retry + DLQ | P0 | Reliability |
| Event clustering | P1 | Duplicate prevention |
| Semantic dedup | P1 | Duplicate prevention |
| Research pipeline | P1 | Quality |
| Asset provenance | P1 | Rights |
| Multi-format rendering | P1 | Distribution |
| Subtitle engine | P1 | Quality |
| Human approval | P1 | Safety |
| YouTube provider | P1 | Existing destination |
| TikTok provider | P1 | Distribution |
| Instagram provider | P1 | Distribution |
| Facebook provider | P1 | Distribution |
| Publication queue | P1 | Automation |
| Independent retries | P1 | Reliability |
| Scheduling | P1 | Operations |
| Analytics | P2 | Optimization |
| Topic saturation | P2 | Content strategy |
| Cost engine | P2 | Economics |
| A/B experiments | P2 | Growth |
| Controlled auto-publish | P2 | Automation |
| Long-form chunking | P2 | Expansion |
| Forecasting | P3 | Advanced AI |

---

# 123. Final Recommendation

The project should become:

```text
NOT:

RSS → AI → MP4 → YouTube


BUT:

EVENT
 ↓
RESEARCH
 ↓
EVIDENCE
 ↓
VERIFIED STORY
 ↓
MULTI-FORMAT MEDIA
 ↓
QC
 ↓
MULTI-PLATFORM DISTRIBUTION
 ↓
ANALYTICS
 ↓
LEARNING
```

The **localhost PC is the factory**.

SQLite is the source of truth.

The `StoryPackage` is the canonical content artifact.

Remotion is the rendering engine.

YouTube, TikTok, Instagram, and Facebook are independent publishing providers.

This architecture is intentionally local-first today, while preserving a clean path to cloud infrastructure later.

---

# 124. Immediate Implementation Checklist

Start implementation in this exact order:

```text
[ ] 1. Create data/factory.db
[ ] 2. Create SQLite migration runner
[ ] 3. Create repositories
[ ] 4. Migrate db_jobs.json
[ ] 5. Implement durable worker
[ ] 6. Implement retry/DLQ/recovery
[ ] 7. Remove dummy audio fallback
[ ] 8. Remove invalid AI model fallbacks
[ ] 9. Move secrets to .env/secure storage
[ ] 10. Harden scraper + SSRF validation
[ ] 11. Replace shell interpolation with safe spawn
[ ] 12. Split research/verifier/story agents
[ ] 13. Implement claim/evidence provenance
[ ] 14. Implement final fact checker
[ ] 15. Consolidate TTS
[ ] 16. Consolidate subtitles
[ ] 17. Refactor Remotion to StoryPackage
[ ] 18. Add render profiles
[ ] 19. Add render manifests
[ ] 20. Add event clustering
[ ] 21. Add story versioning
[ ] 22. Refactor dashboard around SQLite
[ ] 23. Add approval screen
[ ] 24. Add publishing adapter
[ ] 25. Integrate YouTube
[ ] 26. Integrate TikTok
[ ] 27. Integrate Instagram Reels
[ ] 28. Integrate Facebook Reels
[ ] 29. Add publication idempotency
[ ] 30. Add independent platform retry
[ ] 31. Add scheduling
[ ] 32. Add platform analytics
[ ] 33. Add topic feedback
[ ] 34. Enable controlled auto-publish
```

## Final operating model

```text
LOCALHOST
   │
   ├── Dashboard :4000
   ├── Worker
   ├── SQLite
   ├── Remotion
   ├── TTS
   └── Publisher
          ├── YouTube Shorts
          ├── TikTok
          ├── Instagram Reels
          └── Facebook Reels
```

This is the target architecture for the complete localhost AI Video Factory.
