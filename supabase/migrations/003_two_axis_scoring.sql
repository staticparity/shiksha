-- ============================================================================
-- SHIKSHA: TWO-AXIS SCORING (V2 T3)
-- Adds Understanding/Explanation as separate bands, plus per-misconception
-- status, alongside the existing single mastery_score. Additive, not a
-- replacement — mastery_score keeps gating credits and dashboard ranking.
-- See design doc: adityajagadeesan-main-design-20260808-130101.md
-- ============================================================================

ALTER TABLE sessions
  ADD COLUMN understanding_band TEXT
    CHECK (understanding_band IN ('secure', 'partial', 'prompt_dependent', 'unresolved')),
  ADD COLUMN explanation_band TEXT
    CHECK (explanation_band IN ('secure', 'partial', 'prompt_dependent', 'unresolved')),
  -- Array, not scalar: a session can touch more than one of a topic's
  -- common_misconceptions. Each entry: { concept: TEXT, status: 'active' | 'corrected' | 'accepted' }.
  -- Matches the existing gaps/strengths columns' style (DEFAULT, no NOT NULL).
  ADD COLUMN misconceptions JSONB DEFAULT '[]'::jsonb;

-- Existing rows (scored before this migration) get NULL bands and an empty
-- misconceptions array — both are valid "not yet re-scored under V2" states,
-- not error states. The results screen must handle NULL understanding_band /
-- explanation_band without crashing (T3f).
