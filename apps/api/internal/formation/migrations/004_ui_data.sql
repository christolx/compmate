ALTER TABLE profiles ADD COLUMN presentation jsonb NOT NULL DEFAULT '{}';
ALTER TABLE competitions ADD COLUMN presentation jsonb NOT NULL DEFAULT '{}';
ALTER TABLE teams ADD COLUMN presentation jsonb NOT NULL DEFAULT '{}';
ALTER TABLE roles ADD COLUMN presentation jsonb NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN seeded boolean NOT NULL DEFAULT false;
CREATE TABLE saved_competitions (
 user_id text NOT NULL REFERENCES users ON DELETE CASCADE,
 competition_id text NOT NULL REFERENCES competitions ON DELETE CASCADE,
 PRIMARY KEY(user_id,competition_id)
);
CREATE TABLE connections (
 sender_id text NOT NULL REFERENCES users ON DELETE CASCADE,
 recipient_id text NOT NULL REFERENCES users ON DELETE CASCADE,
 status text NOT NULL CHECK(status IN ('pending','connected')),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(sender_id,recipient_id),
 CHECK(sender_id<>recipient_id)
);
CREATE UNIQUE INDEX connections_pair ON connections(least(sender_id,recipient_id),greatest(sender_id,recipient_id));
CREATE TABLE seed_versions(version text PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now());
