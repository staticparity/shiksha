-- ============================================================================
-- Admin-provisioned students carry an explicit school_id, bypassing the
-- email-domain-matching fallback in handle_new_user().
--
-- Why: that fallback (domain match -> LIMIT 1 across ALL schools -> create a
-- "Default School") was written for self-signup, where a student's email
-- domain is a real signal. A tutor-created account's email has nothing to do
-- with the tutor's school, so the LIMIT-1 fallback could silently assign the
-- student to an arbitrary, wrong school in a multi-school deployment. This
-- was flagged during /plan-eng-review's outside-voice pass on the tutor
-- enrollment-friction fix (see docs/designs/tutoring-class-enrollment.md).
--
-- Self-signup behavior (domain match -> LIMIT 1 -> create default) is
-- unchanged for every user that does NOT carry an explicit school_id.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role TEXT;
  v_school_id UUID;
  v_explicit_school_id UUID;
BEGIN
  -- 1. Create profile
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );

  -- 2. Get role from signup metadata (default: student)
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'student');

  -- 3. School assignment
  IF v_role = 'teacher' THEN
    -- Teachers: auto-create their own school
    INSERT INTO public.schools (name, domain, plan)
    VALUES (
      COALESCE(new.raw_user_meta_data->>'full_name', 'My School') || '''s School',
      split_part(new.email, '@', 2),
      'trial'
    )
    RETURNING id INTO v_school_id;
  ELSE
    -- Explicit school_id (tutor-provisioned students) wins outright, no
    -- domain-matching involved. Validate it actually exists before trusting
    -- it -- raw_user_meta_data is client-supplied at signup time (and here,
    -- server-supplied by our own admin.createUser() call), so don't assume
    -- it's well-formed.
    v_explicit_school_id := NULLIF(new.raw_user_meta_data->>'school_id', '')::UUID;

    IF v_explicit_school_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.schools WHERE id = v_explicit_school_id) THEN
      v_school_id := v_explicit_school_id;
    ELSE
      -- Self-signup students: match by email domain first
      SELECT s.id INTO v_school_id
      FROM public.schools s
      WHERE s.domain = split_part(new.email, '@', 2)
      LIMIT 1;

      -- If no domain match, find any school
      IF v_school_id IS NULL THEN
        SELECT s.id INTO v_school_id FROM public.schools s LIMIT 1;
      END IF;

      -- If no school exists at all, create a default
      IF v_school_id IS NULL THEN
        INSERT INTO public.schools (name, domain, plan)
        VALUES ('Default School', split_part(new.email, '@', 2), 'trial')
        RETURNING id INTO v_school_id;
      END IF;
    END IF;
  END IF;

  -- 4. Create school membership
  INSERT INTO public.school_members (user_id, school_id, role)
  VALUES (new.id, v_school_id, v_role);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
