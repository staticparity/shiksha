-- Browser clients may read their results, but only trusted server code writes them.
BEGIN;
REVOKE UPDATE ON public.sessions FROM authenticated;
REVOKE INSERT ON public.sessions FROM authenticated;
GRANT INSERT (student_id, topic_id, class_id, school_id, status) ON public.sessions TO authenticated;
DROP POLICY students_update_own_sessions ON public.sessions;
DROP POLICY students_create_own_sessions ON public.sessions;
CREATE POLICY students_create_own_sessions ON public.sessions FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid() AND status = 'active' AND EXISTS (
  SELECT 1 FROM public.topics t JOIN public.classes c ON c.id = t.class_id
  JOIN public.class_enrollments e ON e.class_id = c.id
  WHERE t.id = topic_id AND c.id = sessions.class_id AND c.school_id = sessions.school_id
    AND e.student_id = auth.uid()
));
REVOKE INSERT, UPDATE, DELETE ON public.mastery_credits, public.streaks FROM authenticated;
-- Column grants cannot override table-level SELECT: remove it first.
REVOKE SELECT ON public.topics FROM authenticated, anon;
GRANT SELECT (id, class_id, title, subject, chapter, description, due_date, created_at, updated_at)
  ON public.topics TO authenticated;

DROP POLICY teachers_manage_own_classes ON public.classes;
CREATE POLICY teachers_manage_own_classes ON public.classes FOR ALL TO authenticated
USING (teacher_id = auth.uid() AND public.has_school_role(school_id, 'teacher'))
WITH CHECK (teacher_id = auth.uid() AND public.has_school_role(school_id, 'teacher'));
DROP POLICY teachers_manage_enrollments ON public.class_enrollments;
CREATE POLICY teachers_manage_enrollments ON public.class_enrollments FOR ALL TO authenticated
USING (public.is_class_teacher(class_id))
WITH CHECK (public.is_class_teacher(class_id) AND EXISTS (
  SELECT 1 FROM public.classes c JOIN public.school_members sm ON sm.school_id = c.school_id
  WHERE c.id = class_id AND sm.user_id = student_id AND sm.role = 'student'
));
DROP POLICY teachers_view_school_credits ON public.mastery_credits;
CREATE POLICY teachers_view_school_credits ON public.mastery_credits FOR SELECT TO authenticated
USING (public.has_school_role(school_id, 'teacher') OR public.has_school_role(school_id, 'admin'));
DROP POLICY teachers_view_school_streaks ON public.streaks;
CREATE POLICY teachers_view_school_streaks ON public.streaks FOR SELECT TO authenticated
USING (public.has_school_role(school_id, 'teacher') OR public.has_school_role(school_id, 'admin'));

-- Public signup can create a new teacher workspace, never join a privileged role.
-- Existing-school assignments come only from Auth admin app_metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_school uuid; v_role text;
BEGIN
  INSERT INTO public.profiles(id, full_name, avatar_url) VALUES
    (new.id, COALESCE(new.raw_user_meta_data->>'full_name', new.email), new.raw_user_meta_data->>'avatar_url');
  IF new.raw_app_meta_data->>'school_id' IS NOT NULL THEN
    v_school := (new.raw_app_meta_data->>'school_id')::uuid;
    v_role := 'student';
    IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = v_school) THEN
      RAISE EXCEPTION 'Invalid provisioned school';
    END IF;
  ELSIF new.raw_user_meta_data->>'role' = 'teacher' THEN
    v_role := 'teacher';
    INSERT INTO public.schools(name, plan) VALUES
      (COALESCE(new.raw_user_meta_data->>'full_name', 'My School') || '''s School', 'trial') RETURNING id INTO v_school;
  ELSE
    -- Unassigned students are enrolled by a teacher after verifying their email.
    RETURN new;
  END IF;
  INSERT INTO public.school_members(user_id, school_id, role) VALUES (new.id, v_school, v_role);
  RETURN new;
END $$;

CREATE OR REPLACE FUNCTION public.find_student_by_email(p_email text, p_school_id uuid)
RETURNS TABLE(user_id uuid, full_name text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.has_school_role(p_school_id, 'teacher') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY SELECT au.id, p.full_name FROM auth.users au
    JOIN public.profiles p ON p.id = au.id
    LEFT JOIN public.school_members sm ON sm.user_id = au.id
    WHERE lower(au.email) = lower(p_email) AND ((sm.school_id = p_school_id AND sm.role = 'student')
      OR (sm.id IS NULL AND au.email_confirmed_at IS NOT NULL)) LIMIT 1;
END $$;
REVOKE EXECUTE ON FUNCTION public.find_student_by_email(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.append_to_transcript(uuid, jsonb), public.increment_session_tokens(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_to_transcript(uuid, jsonb), public.increment_session_tokens(uuid, int) TO service_role;
ALTER FUNCTION public.append_to_transcript(uuid, jsonb) SET search_path = public;
ALTER FUNCTION public.increment_session_tokens(uuid, int) SET search_path = public;
ALTER FUNCTION public.get_user_school_ids() SET search_path = public;
ALTER FUNCTION public.has_school_role(uuid, text) SET search_path = public;
ALTER FUNCTION public.is_class_teacher(uuid) SET search_path = public;
ALTER FUNCTION public.is_enrolled_in_class(uuid) SET search_path = public;

ALTER TABLE public.sessions ADD COLUMN request_id uuid, ADD COLUMN lease_until timestamptz;
-- Recover sessions stranded by older scoring handlers.
UPDATE public.sessions SET status = 'active' WHERE status = 'scoring';
CREATE TABLE public.ai_quotas(user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  window_started timestamptz NOT NULL DEFAULT now(), requests int NOT NULL DEFAULT 0);
ALTER TABLE public.ai_quotas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_quotas FROM anon, authenticated;
GRANT ALL ON public.ai_quotas TO service_role;
CREATE FUNCTION public.consume_ai_quota(p_user_id uuid) RETURNS boolean
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE n int;
BEGIN
  INSERT INTO public.ai_quotas AS q(user_id, requests) VALUES (p_user_id, 1)
  ON CONFLICT (user_id) DO UPDATE SET
    requests = CASE WHEN q.window_started < now() - interval '1 hour' THEN 1 ELSE q.requests + 1 END,
    window_started = CASE WHEN q.window_started < now() - interval '1 hour' THEN now() ELSE q.window_started END
  RETURNING requests INTO n;
  RETURN n <= 120;
END $$;
CREATE FUNCTION public.claim_session(p_session_id uuid, p_user_id uuid, p_request_id uuid, p_scoring boolean)
RETURNS SETOF public.sessions LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RETURN QUERY UPDATE public.sessions SET request_id = p_request_id, lease_until = now() + interval '2 minutes',
    status = CASE WHEN p_scoring THEN 'scoring' ELSE 'active' END
  WHERE id = p_session_id AND student_id = p_user_id
    AND (status = 'active' OR (status = 'scoring' AND lease_until < now()))
    AND (lease_until IS NULL OR lease_until < now())
    AND (p_scoring OR message_count < 50)
  RETURNING *;
END $$;
CREATE FUNCTION public.release_session(p_session_id uuid, p_request_id uuid) RETURNS void
LANGUAGE sql SET search_path = '' AS $$
  UPDATE public.sessions SET status = 'active', request_id = NULL, lease_until = NULL
  WHERE id = p_session_id AND request_id = p_request_id AND status IN ('active', 'scoring');
$$;
CREATE FUNCTION public.complete_chat(p_session_id uuid, p_request_id uuid, p_messages jsonb, p_tokens int) RETURNS boolean
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF jsonb_typeof(p_messages) <> 'array' OR jsonb_array_length(p_messages) <> 2 THEN RAISE EXCEPTION 'Invalid transcript'; END IF;
  UPDATE public.sessions SET transcript = transcript || p_messages, message_count = message_count + 2,
    total_tokens = total_tokens + greatest(p_tokens, 0), request_id = NULL, lease_until = NULL
  WHERE id = p_session_id AND request_id = p_request_id AND status = 'active';
  RETURN FOUND;
END $$;
-- Complete scoring, credits and streaks in one transaction. A lease can finish only once.
CREATE FUNCTION public.complete_mastery(p_session_id uuid, p_request_id uuid, p_result jsonb, p_tokens int)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE s public.sessions; st public.streaks; credits int; frozen boolean := false; today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  SELECT * INTO s FROM public.sessions WHERE id = p_session_id AND request_id = p_request_id AND status = 'scoring' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session lease expired'; END IF;
  credits := CASE WHEN (p_result->>'masteryScore')::int >= 90 THEN 3 WHEN (p_result->>'masteryScore')::int >= 70 THEN 2 WHEN (p_result->>'masteryScore')::int >= 40 THEN 1 ELSE 0 END;
  UPDATE public.sessions SET mastery_score = (p_result->>'masteryScore')::int,
    understanding_band = p_result->>'understandingBand', explanation_band = p_result->>'explanationBand',
    misconceptions = p_result->'misconceptions', strengths = p_result->'strengths', gaps = p_result->'gaps',
    assessment = p_result->>'overallAssessment', recitation_detected = (p_result->>'recitationDetected')::boolean,
    follow_up_quality = p_result->>'followUpQuality', status = 'completed', ended_at = now(),
    duration_seconds = greatest(0, extract(epoch FROM now() - started_at)::int),
    total_tokens = total_tokens + greatest(p_tokens, 0), request_id = NULL, lease_until = NULL
  WHERE id = s.id;
  IF credits > 0 THEN INSERT INTO public.mastery_credits(student_id, session_id, school_id, credits_earned) VALUES(s.student_id, s.id, s.school_id, credits); END IF;
  INSERT INTO public.streaks(student_id, school_id) VALUES(s.student_id, s.school_id) ON CONFLICT (student_id, school_id) DO NOTHING;
  SELECT * INTO st FROM public.streaks WHERE student_id = s.student_id AND school_id = s.school_id FOR UPDATE;
  IF st.last_activity_date IS DISTINCT FROM today THEN
    frozen := st.last_activity_date = today - 2 AND st.streak_freezes_available > 0;
    st.current_streak := CASE WHEN st.last_activity_date = today - 1 OR frozen THEN st.current_streak + 1 ELSE 1 END;
    UPDATE public.streaks SET current_streak = st.current_streak, longest_streak = greatest(longest_streak, st.current_streak),
      last_activity_date = today, streak_freezes_available = streak_freezes_available - CASE WHEN frozen THEN 1 ELSE 0 END WHERE id = st.id;
  END IF;
  RETURN jsonb_build_object('creditsEarned', credits, 'currentStreak', st.current_streak, 'freezeUsed', COALESCE(frozen, false));
END $$;
REVOKE EXECUTE ON FUNCTION public.consume_ai_quota(uuid), public.claim_session(uuid, uuid, uuid, boolean),
  public.release_session(uuid, uuid), public.complete_chat(uuid, uuid, jsonb, int), public.complete_mastery(uuid, uuid, jsonb, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(uuid), public.claim_session(uuid, uuid, uuid, boolean),
  public.release_session(uuid, uuid), public.complete_chat(uuid, uuid, jsonb, int), public.complete_mastery(uuid, uuid, jsonb, int) TO service_role;
-- Serialize first enrollment against the Auth user to prevent two teachers
-- assigning the same unassigned account to different schools concurrently.
CREATE FUNCTION public.enroll_verified_student(p_class_id uuid, p_student_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE school uuid;
BEGIN
  SELECT school_id INTO school FROM public.classes WHERE id = p_class_id AND teacher_id = auth.uid();
  IF school IS NULL OR NOT public.has_school_role(school, 'teacher') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  PERFORM 1 FROM auth.users WHERE id = p_student_id AND email_confirmed_at IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student must verify their email before enrollment'; END IF;
  IF EXISTS (SELECT 1 FROM public.school_members WHERE user_id = p_student_id AND (school_id <> school OR role <> 'student')) THEN
    RAISE EXCEPTION 'Student belongs to another school or role';
  END IF;
  INSERT INTO public.school_members(user_id, school_id, role) VALUES(p_student_id, school, 'student') ON CONFLICT (user_id, school_id) DO NOTHING;
  INSERT INTO public.class_enrollments(class_id, student_id) VALUES(p_class_id, p_student_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.enroll_verified_student(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enroll_verified_student(uuid, uuid) TO authenticated;
COMMIT;
