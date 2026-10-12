CREATE TABLE team_invitations (
 id text PRIMARY KEY, team_id text NOT NULL REFERENCES teams ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES users ON DELETE CASCADE, role_id text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(team_id,user_id),
 FOREIGN KEY(role_id,team_id) REFERENCES roles(id,team_id)
);
