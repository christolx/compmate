-- One rule shared by public recommendations, apply and accept. Application
-- status/permissions are checked separately to allow accepting pending requests.
CREATE FUNCTION recruitment_eligible(tid text, applicant text, requested_role text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT coalesce((SELECT t.recruiting AND NOT t.moderated AND c.published
  AND c.deadline > statement_timestamp()
  AND (SELECT count(*) FROM memberships WHERE team_id=t.id)<t.capacity
  AND (c.campus='' OR c.campus=(SELECT campus FROM profiles WHERE user_id=applicant))
  AND NOT EXISTS(SELECT 1 FROM memberships WHERE team_id=t.id AND user_id=applicant)
  AND EXISTS(SELECT 1 FROM roles x WHERE x.team_id=t.id
   AND (requested_role IS NULL OR x.id=requested_role)
   AND (SELECT count(*) FROM memberships WHERE role_id=x.id)<x.capacity)
 FROM teams t JOIN competitions c ON c.id=t.competition_id WHERE t.id=tid),false)
$$;
