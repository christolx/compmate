-- Who triggered a notification and what it is about, so the UI can name people and link correctly.
ALTER TABLE notifications ADD COLUMN actor_id text REFERENCES users ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN kind text NOT NULL DEFAULT 'team'
 CHECK(kind IN ('team','application','decision','invitation','connection'));
