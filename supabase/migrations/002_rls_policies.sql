-- ============================================================================
-- SHIKSHA: ROW LEVEL SECURITY POLICIES
-- Every table gets RLS. No exceptions. This is the multi-tenant firewall.
-- ============================================================================

-- ── Helper Functions ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_user_school_ids()
RETURNS SETOF UUID AS $$
  SELECT school_id FROM school_members WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION has_school_role(target_school_id UUID, target_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM school_members
    WHERE user_id = auth.uid()
    AND school_id = target_school_id
    AND role = target_role
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_class_teacher(target_class_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM classes
    WHERE id = target_class_id
    AND teacher_id = auth.uid()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_enrolled_in_class(target_class_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM class_enrollments
    WHERE class_id = target_class_id
    AND student_id = auth.uid()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Enable RLS on ALL tables ────────────────────────────────────────────────

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mastery_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;

-- ── Schools ─────────────────────────────────────────────────────────────────

CREATE POLICY "members_view_own_school" ON schools FOR SELECT
  USING (id IN (SELECT get_user_school_ids()));

-- ── Profiles ────────────────────────────────────────────────────────────────

-- Users can view their own profile
CREATE POLICY "users_view_own_profile" ON profiles FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "users_update_own_profile" ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Users can view profiles of people in their school (for teacher dashboards)
CREATE POLICY "school_members_view_profiles" ON profiles FOR SELECT
  USING (
    id IN (
      SELECT user_id FROM school_members
      WHERE school_id IN (SELECT get_user_school_ids())
    )
  );

-- ── School Members ──────────────────────────────────────────────────────────

-- Members can see other members in their school
CREATE POLICY "view_school_members" ON school_members FOR SELECT
  USING (school_id IN (SELECT get_user_school_ids()));

-- Admins can manage school members
CREATE POLICY "admins_manage_members" ON school_members FOR ALL
  USING (has_school_role(school_id, 'admin'));

-- ── Classes ─────────────────────────────────────────────────────────────────

-- Teachers can see/manage their own classes
CREATE POLICY "teachers_manage_own_classes" ON classes FOR ALL
  USING (teacher_id = auth.uid());

-- Students can see classes they're enrolled in
CREATE POLICY "students_view_enrolled_classes" ON classes FOR SELECT
  USING (
    id IN (
      SELECT class_id FROM class_enrollments
      WHERE student_id = auth.uid()
    )
  );

-- Admins can see all classes in their school
CREATE POLICY "admins_view_school_classes" ON classes FOR SELECT
  USING (has_school_role(school_id, 'admin'));

-- ── Class Enrollments ───────────────────────────────────────────────────────

-- Students can see their own enrollments
CREATE POLICY "students_view_own_enrollments" ON class_enrollments FOR SELECT
  USING (student_id = auth.uid());

-- Teachers can manage enrollments for their classes
CREATE POLICY "teachers_manage_enrollments" ON class_enrollments FOR ALL
  USING (is_class_teacher(class_id));

-- ── Topics ──────────────────────────────────────────────────────────────────

-- Teachers can fully manage topics for their classes
CREATE POLICY "teachers_manage_topics" ON topics FOR ALL
  USING (is_class_teacher(class_id));

-- Students can view topics for classes they're enrolled in
CREATE POLICY "students_view_class_topics" ON topics FOR SELECT
  USING (is_enrolled_in_class(class_id));

-- ── Sessions ────────────────────────────────────────────────────────────────

-- Students can view their own sessions
CREATE POLICY "students_view_own_sessions" ON sessions FOR SELECT
  USING (student_id = auth.uid());

-- Students can create sessions for themselves only
CREATE POLICY "students_create_own_sessions" ON sessions FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- Students can update their own active sessions (for transcript appending)
CREATE POLICY "students_update_own_sessions" ON sessions FOR UPDATE
  USING (student_id = auth.uid());

-- Teachers can view sessions in their classes (for dashboard)
CREATE POLICY "teachers_view_class_sessions" ON sessions FOR SELECT
  USING (is_class_teacher(class_id));

-- ── Mastery Credits ─────────────────────────────────────────────────────────

-- Students see their own credits
CREATE POLICY "students_view_own_credits" ON mastery_credits FOR SELECT
  USING (student_id = auth.uid());

-- System inserts credits (via service role in API)
CREATE POLICY "students_insert_own_credits" ON mastery_credits FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- Teachers can view credits in their school
CREATE POLICY "teachers_view_school_credits" ON mastery_credits FOR SELECT
  USING (school_id IN (SELECT get_user_school_ids()));

-- ── Streaks ─────────────────────────────────────────────────────────────────

-- Students see their own streaks
CREATE POLICY "students_view_own_streaks" ON streaks FOR SELECT
  USING (student_id = auth.uid());

-- Students can create/update their own streaks
CREATE POLICY "students_manage_own_streaks" ON streaks FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "students_update_own_streaks" ON streaks FOR UPDATE
  USING (student_id = auth.uid());

-- Teachers can view streaks in their school
CREATE POLICY "teachers_view_school_streaks" ON streaks FOR SELECT
  USING (school_id IN (SELECT get_user_school_ids()));
