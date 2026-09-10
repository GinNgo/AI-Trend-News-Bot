-- 001_initial_schema.sql

-- SOURCES
CREATE TABLE IF NOT EXISTS sources (
  sourceId TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  type TEXT NOT NULL,
  country TEXT,
  language TEXT,
  trustLevel REAL DEFAULT 0.5,
  primarySource BOOLEAN DEFAULT 0,
  rssUrl TEXT,
  articlePattern TEXT,
  enabled BOOLEAN DEFAULT 1,
  rateLimit INTEGER DEFAULT 60,
  robotsPolicy TEXT,
  lastFetchedAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ARTICLES
CREATE TABLE IF NOT EXISTS articles (
  articleId TEXT PRIMARY KEY,
  sourceId TEXT,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL UNIQUE,
  canonicalUrl TEXT,
  author TEXT,
  publishedAt DATETIME,
  updatedAt DATETIME,
  language TEXT,
  content TEXT,
  contentHash TEXT,
  metadata TEXT, -- JSON
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sourceId) REFERENCES sources(sourceId) ON DELETE SET NULL
);

-- EVENTS
CREATE TABLE IF NOT EXISTS events (
  eventId TEXT PRIMARY KEY,
  canonicalTopic TEXT,
  entities TEXT, -- JSON array
  locations TEXT, -- JSON array
  startTime DATETIME,
  lastUpdatedAt DATETIME,
  status TEXT DEFAULT 'DETECTED',
  importance REAL DEFAULT 0.0,
  sourceCount INTEGER DEFAULT 1,
  primarySourceId TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_sources (
  eventId TEXT NOT NULL,
  articleId TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (eventId, articleId),
  FOREIGN KEY (eventId) REFERENCES events(eventId) ON DELETE CASCADE,
  FOREIGN KEY (articleId) REFERENCES articles(articleId) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_timeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eventId TEXT NOT NULL,
  timestamp DATETIME NOT NULL,
  eventDescription TEXT NOT NULL,
  sourceId TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (eventId) REFERENCES events(eventId) ON DELETE CASCADE
);

-- CLAIMS
CREATE TABLE IF NOT EXISTS claims (
  claimId TEXT PRIMARY KEY,
  eventId TEXT NOT NULL,
  statement TEXT NOT NULL,
  status TEXT DEFAULT 'UNVERIFIED',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (eventId) REFERENCES events(eventId) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS claim_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claimId TEXT NOT NULL,
  sourceId TEXT,
  url TEXT,
  quote TEXT,
  context TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (claimId) REFERENCES claims(claimId) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS claim_contradictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claimId TEXT NOT NULL,
  contradictingClaimId TEXT,
  reason TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (claimId) REFERENCES claims(claimId) ON DELETE CASCADE
);

-- RESEARCH PACKAGES
CREATE TABLE IF NOT EXISTS research_packages (
  packageId TEXT PRIMARY KEY,
  eventId TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  data TEXT NOT NULL, -- JSON
  status TEXT DEFAULT 'DRAFT',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (eventId) REFERENCES events(eventId) ON DELETE CASCADE
);

-- STORIES
CREATE TABLE IF NOT EXISTS stories (
  storyId TEXT PRIMARY KEY,
  eventId TEXT NOT NULL,
  status TEXT DEFAULT 'DRAFT',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (eventId) REFERENCES events(eventId) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS story_versions (
  versionId TEXT PRIMARY KEY,
  storyId TEXT NOT NULL,
  version INTEGER NOT NULL,
  language TEXT DEFAULT 'vi',
  targetDurationSec INTEGER DEFAULT 60,
  title TEXT NOT NULL,
  hook TEXT,
  data TEXT NOT NULL, -- JSON with claims, scenes, voice, subtitles
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (storyId) REFERENCES stories(storyId) ON DELETE CASCADE
);

-- ASSETS
CREATE TABLE IF NOT EXISTS assets (
  assetId TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  path TEXT NOT NULL,
  sourceUrl TEXT,
  sourceName TEXT,
  license TEXT,
  attribution TEXT,
  rightsStatus TEXT DEFAULT 'UNKNOWN',
  contentHash TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- RENDERS
CREATE TABLE IF NOT EXISTS renders (
  renderId TEXT PRIMARY KEY,
  storyId TEXT NOT NULL,
  storyVersion INTEGER NOT NULL,
  renderProfile TEXT NOT NULL,
  videoPath TEXT NOT NULL,
  audioPath TEXT,
  subtitlesPath TEXT,
  manifestPath TEXT,
  hash TEXT,
  status TEXT DEFAULT 'COMPLETED',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (storyId) REFERENCES stories(storyId) ON DELETE CASCADE
);

-- QC RUNS
CREATE TABLE IF NOT EXISTS qc_runs (
  qcId TEXT PRIMARY KEY,
  targetType TEXT NOT NULL, -- 'render' or 'story'
  targetId TEXT NOT NULL,
  status TEXT NOT NULL, -- 'PASS', 'FAIL', 'REVIEW'
  summary TEXT,
  details TEXT, -- JSON
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- JOBS
CREATE TABLE IF NOT EXISTS jobs (
  jobId TEXT PRIMARY KEY,
  idempotencyKey TEXT UNIQUE,
  eventId TEXT,
  storyId TEXT,
  stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  maxAttempts INTEGER DEFAULT 3,
  lockedBy TEXT,
  lockedAt DATETIME,
  scheduledAt DATETIME,
  startedAt DATETIME,
  finishedAt DATETIME,
  errorCode TEXT,
  errorMessage TEXT,
  payload TEXT, -- JSON
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_priority ON jobs(status, priority DESC, scheduledAt ASC);

CREATE TABLE IF NOT EXISTS job_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jobId TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (jobId) REFERENCES jobs(jobId) ON DELETE CASCADE
);

-- PUBLICATIONS
CREATE TABLE IF NOT EXISTS publications (
  publicationId TEXT PRIMARY KEY,
  storyId TEXT NOT NULL,
  renderId TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'youtube', 'tiktok', 'instagram', 'facebook'
  accountId TEXT,
  platformVideoId TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'DRY_RUN'
  scheduledAt DATETIME,
  publishedAt DATETIME,
  url TEXT,
  title TEXT,
  caption TEXT,
  metadataVersion INTEGER DEFAULT 1,
  attempt INTEGER DEFAULT 0,
  lastError TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (storyId) REFERENCES stories(storyId) ON DELETE CASCADE,
  FOREIGN KEY (renderId) REFERENCES renders(renderId) ON DELETE CASCADE
);

-- COST EVENTS
CREATE TABLE IF NOT EXISTS cost_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eventId TEXT,
  jobId TEXT,
  provider TEXT NOT NULL,
  service TEXT NOT NULL,
  inputUnits REAL DEFAULT 0,
  outputUnits REAL DEFAULT 0,
  estimatedCost REAL DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
