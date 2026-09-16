-- Migration: 002_add_layout_tracking.sql
ALTER TABLE renders ADD COLUMN layoutVersion TEXT DEFAULT 'v1.0-short-3s';
ALTER TABLE renders ADD COLUMN layoutTypes TEXT DEFAULT '["list"]';
ALTER TABLE renders ADD COLUMN sceneCount INTEGER DEFAULT 3;
ALTER TABLE renders ADD COLUMN durationSeconds REAL;

ALTER TABLE publications ADD COLUMN layoutVersion TEXT DEFAULT 'v1.0-short-3s';
ALTER TABLE publications ADD COLUMN layoutTypes TEXT DEFAULT '["list"]';
ALTER TABLE publications ADD COLUMN sceneCount INTEGER DEFAULT 3;
ALTER TABLE publications ADD COLUMN durationSeconds REAL;

ALTER TABLE video_snapshots ADD COLUMN layoutVersion TEXT;
ALTER TABLE video_snapshots ADD COLUMN sceneCount INTEGER;
ALTER TABLE video_snapshots ADD COLUMN durationSeconds REAL;
