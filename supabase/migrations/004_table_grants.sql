-- ============================================================================
-- SHIKSHA: TABLE GRANTS + helper RPCs
-- Local Supabase (and some hosted setups) require explicit GRANTs in addition
-- to RLS policies. Without these, PostgREST returns 42501 permission denied.
-- ============================================================================

-- Helper RPCs used by teacher enrollment and chat token tracking
CREATE OR REPLACE FUNCTION public.find_student_by_email(p_email TEXT, p_school_id UUID)
RETURNS TABLE(user_id UUID, full_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT au.id, p.full_name
  FROM auth.users au
  JOIN profiles p ON p.id = au.id
  JOIN school_members sm ON sm.user_id = au.id
  WHERE au.email = p_email
    AND sm.school_id = p_school_id
    AND sm.role = 'student'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_session_tokens(p_session_id UUID, p_tokens INT)
RETURNS VOID AS $$
BEGIN
  UPDATE sessions
  SET total_tokens = COALESCE(total_tokens, 0) + p_tokens
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO authenticated, service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.find_student_by_email(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_session_tokens(UUID, INT) TO authenticated;
