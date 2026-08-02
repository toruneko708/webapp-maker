CREATE TABLE IF NOT EXISTS scheduled_posts (
  id TEXT PRIMARY KEY,
  run_at TEXT NOT NULL,
  bluesky_text TEXT NOT NULL,
  x_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  bluesky_uri TEXT,
  discord_message_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS scheduled_posts_due
  ON scheduled_posts (status, run_at);
