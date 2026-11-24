-- Campus restrictions compare case- and whitespace-insensitively ("BINUS" = " binus ").
CREATE FUNCTION same_campus(required text, actual text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT btrim(required)='' OR lower(btrim(required))=lower(btrim(coalesce(actual,'')))
$$;
CREATE OR REPLACE FUNCTION recruitment_eligible(tid text, applicant text, requested_role text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT coalesce((SELECT t.recruiting AND NOT t.moderated AND c.published
  AND c.deadline > statement_timestamp()
  AND (SELECT count(*) FROM memberships WHERE team_id=t.id)<t.capacity
  AND same_campus(c.campus,(SELECT campus FROM profiles WHERE user_id=applicant))
  AND NOT EXISTS(SELECT 1 FROM memberships m JOIN teams joined ON joined.id=m.team_id WHERE joined.competition_id=t.competition_id AND m.user_id=applicant)
  AND EXISTS(SELECT 1 FROM roles x WHERE x.team_id=t.id
   AND (requested_role IS NULL OR x.id=requested_role)
   AND (SELECT count(*) FROM memberships WHERE role_id=x.id)<x.capacity)
 FROM teams t JOIN competitions c ON c.id=t.competition_id WHERE t.id=tid),false)
$$;
