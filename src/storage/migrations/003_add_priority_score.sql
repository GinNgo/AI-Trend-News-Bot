-- Migration: 003_add_priority_score.sql
ALTER TABLE publications ADD COLUMN priorityScore REAL DEFAULT 7.5;
