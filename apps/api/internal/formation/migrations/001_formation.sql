CREATE TABLE users (
 id text PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL,
 admin boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE profiles (
 user_id text PRIMARY KEY REFERENCES users ON DELETE CASCADE,
 name text NOT NULL, campus text NOT NULL DEFAULT '', skills text NOT NULL DEFAULT '',
 availability text NOT NULL DEFAULT '', about text NOT NULL DEFAULT '',
 contact text NOT NULL DEFAULT '', share_contact boolean NOT NULL DEFAULT false
);
CREATE TABLE sessions (
 token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE competitions (
 id text PRIMARY KEY, title text NOT NULL, organizer text NOT NULL, description text NOT NULL,
 official_url text NOT NULL, deadline timestamptz NOT NULL,
 min_members integer NOT NULL CHECK(min_members >= 2), max_members integer NOT NULL CHECK(max_members >= min_members AND max_members <= 20),
 campus text NOT NULL DEFAULT '', published boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE teams (
 id text PRIMARY KEY, competition_id text NOT NULL REFERENCES competitions,
 leader_id text NOT NULL REFERENCES users, name text NOT NULL, about text NOT NULL,
 capacity integer NOT NULL CHECK(capacity BETWEEN 2 AND 20), recruiting boolean NOT NULL DEFAULT true,
 moderated boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE roles (
 id text PRIMARY KEY, team_id text NOT NULL REFERENCES teams ON DELETE CASCADE,
 name text NOT NULL, skills text NOT NULL DEFAULT '', capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 19),
 UNIQUE(id, team_id)
);
CREATE TABLE applications (
 id text PRIMARY KEY, team_id text NOT NULL REFERENCES teams ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES users ON DELETE CASCADE, role_id text NOT NULL,
 message text NOT NULL, share_contact boolean NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','withdrawn')),
 created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
 FOREIGN KEY(role_id, team_id) REFERENCES roles(id, team_id), UNIQUE(team_id, user_id)
);
CREATE TABLE memberships (
 team_id text NOT NULL REFERENCES teams ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES users ON DELETE CASCADE, role_id text,
 share_contact boolean NOT NULL, connected_at timestamptz, joined_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(team_id,user_id), FOREIGN KEY(role_id,team_id) REFERENCES roles(id,team_id)
);
CREATE TABLE notifications (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES users ON DELETE CASCADE,
 team_id text REFERENCES teams ON DELETE CASCADE, text text NOT NULL,
 read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE reports (
 id text PRIMARY KEY, reporter_id text REFERENCES users ON DELETE SET NULL,
 team_id text REFERENCES teams ON DELETE CASCADE, reason text NOT NULL,
 resolved boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE events (
 id text PRIMARY KEY, user_id text REFERENCES users ON DELETE SET NULL,
 kind text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX applications_user ON applications(user_id);
CREATE INDEX applications_team ON applications(team_id);
CREATE INDEX memberships_user ON memberships(user_id);
CREATE INDEX notifications_user ON notifications(user_id,created_at);
