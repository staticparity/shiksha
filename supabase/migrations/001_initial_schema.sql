-- ============================================================================
-- SHIKSHA: INITIAL SCHEMA
-- Multi-tenant education SaaS with dual-agent AI mastery assessment
-- ============================================================================

-- ── Schools (Tenants) ───────────────────────────────────────────────────────

CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  plan TEXT NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial', 'active', 'expired')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Profiles (linked to Supabase Auth) ──────────────────────────────────────

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-provision user on signup: profile + school + membership
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role TEXT;
  v_school_id UUID;
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
    -- Students: match by email domain first
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

  -- 4. Create school membership
  INSERT INTO public.school_members (user_id, school_id, role)
  VALUES (new.id, v_school_id, v_role);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── School Membership (Multi-Tenant RBAC) ───────────────────────────────────

CREATE TABLE school_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, school_id)
);

CREATE INDEX idx_school_members_user_school ON school_members(user_id, school_id);
CREATE INDEX idx_school_members_school_role ON school_members(school_id, role);

-- ── Classes ─────────────────────────────────────────────────────────────────

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_classes_school ON classes(school_id);
CREATE INDEX idx_classes_teacher ON classes(teacher_id);

-- ── Class Enrollments ───────────────────────────────────────────────────────

CREATE TABLE class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id)
);

CREATE INDEX idx_enrollments_class ON class_enrollments(class_id);
CREATE INDEX idx_enrollments_student ON class_enrollments(student_id);

-- ── Topics (Teacher-Assigned) ───────────────────────────────────────────────

CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT,
  description TEXT,
  knowledge_base JSONB,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_topics_class ON topics(class_id);

-- ── Sessions (One Explain Attempt) ──────────────────────────────────────────

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id),
  topic_id UUID NOT NULL REFERENCES topics(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  school_id UUID NOT NULL REFERENCES schools(id),

  -- Session metadata
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Full conversation transcript
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Mastery evaluation (filled by Wisdom Agent)
  mastery_score INTEGER CHECK (mastery_score >= 0 AND mastery_score <= 100),
  strengths JSONB DEFAULT '[]'::jsonb,
  gaps JSONB DEFAULT '[]'::jsonb,
  assessment TEXT,
  recitation_detected BOOLEAN DEFAULT false,
  follow_up_quality TEXT CHECK (follow_up_quality IN ('excellent', 'good', 'weak', 'evasive')),

  -- AI cost tracking
  model_used TEXT DEFAULT 'gpt-4o-mini',
  total_tokens INTEGER DEFAULT 0,
  cost_usd DECIMAL(10, 6) DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned', 'scoring')),

  -- Message count for rate limiting
  message_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_sessions_student_topic ON sessions(student_id, topic_id);
CREATE INDEX idx_sessions_class ON sessions(class_id);
CREATE INDEX idx_sessions_school ON sessions(school_id);
CREATE INDEX idx_sessions_status ON sessions(status);

-- ── Mastery Credits (Gamification Ledger) ───────────────────────────────────

CREATE TABLE mastery_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  school_id UUID NOT NULL REFERENCES schools(id),
  credits_earned INTEGER NOT NULL CHECK (credits_earned >= 0),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credits_student ON mastery_credits(student_id, school_id);

-- ── Streaks ─────────────────────────────────────────────────────────────────

CREATE TABLE streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id),
  school_id UUID NOT NULL REFERENCES schools(id),
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  streak_freezes_available INTEGER NOT NULL DEFAULT 2,
  UNIQUE(student_id, school_id)
);

-- ── Transcript Append RPC ───────────────────────────────────────────────────
-- Atomically append messages to a session transcript

CREATE OR REPLACE FUNCTION append_to_transcript(
  p_session_id UUID,
  p_new_messages JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE sessions
  SET
    transcript = transcript || p_new_messages,
    message_count = message_count + jsonb_array_length(p_new_messages)
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Updated-At Triggers ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schools_updated_at BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER classes_updated_at BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER topics_updated_at BEFORE UPDATE ON topics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
