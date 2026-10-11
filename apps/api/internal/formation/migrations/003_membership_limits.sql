-- Defense in depth: seat invariants hold even for another DB writer.
CREATE FUNCTION check_membership_limits() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t teams; role_limit integer;
BEGIN
 SELECT * INTO t FROM teams WHERE id=NEW.team_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'team missing' USING ERRCODE='23503'; END IF;
 IF TG_OP='UPDATE' AND (OLD.team_id<>NEW.team_id OR OLD.user_id<>NEW.user_id) THEN
  RAISE EXCEPTION 'membership identity immutable' USING ERRCODE='23514';
 END IF;
 IF (SELECT count(*) FROM memberships WHERE team_id=NEW.team_id AND user_id<>NEW.user_id)>=t.capacity THEN
  RAISE EXCEPTION 'team full' USING ERRCODE='23514';
 END IF;
 IF NEW.role_id IS NULL AND NEW.user_id<>t.leader_id THEN
  RAISE EXCEPTION 'member role required' USING ERRCODE='23514';
 END IF;
 IF NEW.role_id IS NOT NULL THEN
  SELECT capacity INTO role_limit FROM roles WHERE id=NEW.role_id AND team_id=NEW.team_id;
  IF role_limit IS NULL THEN RAISE EXCEPTION 'role missing' USING ERRCODE='23503'; END IF;
  IF (SELECT count(*) FROM memberships WHERE role_id=NEW.role_id AND user_id<>NEW.user_id)>=role_limit THEN
   RAISE EXCEPTION 'role full' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER membership_limits BEFORE INSERT OR UPDATE OF role_id,team_id,user_id ON memberships
 FOR EACH ROW EXECUTE FUNCTION check_membership_limits();
