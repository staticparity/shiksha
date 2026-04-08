-- ============================================================
-- Shiksha Seed Data
-- ============================================================
-- Demo school, teacher, students, class, topics, and sample sessions.
-- Run after applying 001_initial_schema.sql and 002_rls_policies.sql.
-- ============================================================

-- ── Auth Users (must exist before profiles) ─────────────────
-- Password for all demo accounts: password123
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token) VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ananya@greenfield.edu',
   '$2a$10$LCJ7li2LyxD5183juOzgAuB6xj5sbxo8CEBn8xX6YnNYANqvM4KOq',
   NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ananya Sharma"}', NOW(), NOW(), '', '', '', ''),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rohan@greenfield.edu',
   '$2a$10$LCJ7li2LyxD5183juOzgAuB6xj5sbxo8CEBn8xX6YnNYANqvM4KOq',
   NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rohan Mehta"}', NOW(), NOW(), '', '', '', ''),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'priya@greenfield.edu',
   '$2a$10$LCJ7li2LyxD5183juOzgAuB6xj5sbxo8CEBn8xX6YnNYANqvM4KOq',
   NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Priya Gupta"}', NOW(), NOW(), '', '', '', ''),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'arjun@greenfield.edu',
   '$2a$10$LCJ7li2LyxD5183juOzgAuB6xj5sbxo8CEBn8xX6YnNYANqvM4KOq',
   NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Arjun Singh"}', NOW(), NOW(), '', '', '', ''),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'diya@greenfield.edu',
   '$2a$10$LCJ7li2LyxD5183juOzgAuB6xj5sbxo8CEBn8xX6YnNYANqvM4KOq',
   NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Diya Patel"}', NOW(), NOW(), '', '', '', ''),
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kabir@greenfield.edu',
   '$2a$10$LCJ7li2LyxD5183juOzgAuB6xj5sbxo8CEBn8xX6YnNYANqvM4KOq',
   NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Kabir Verma"}', NOW(), NOW(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- Also insert into auth.identities (required for email login to work)
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at) VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"ananya@greenfield.edu"}', 'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"rohan@greenfield.edu"}', 'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333',
   '{"sub":"33333333-3333-3333-3333-333333333333","email":"priya@greenfield.edu"}', 'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444',
   '{"sub":"44444444-4444-4444-4444-444444444444","email":"arjun@greenfield.edu"}', 'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555',
   '{"sub":"55555555-5555-5555-5555-555555555555","email":"diya@greenfield.edu"}', 'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), '66666666-6666-6666-6666-666666666666', '66666666-6666-6666-6666-666666666666',
   '{"sub":"66666666-6666-6666-6666-666666666666","email":"kabir@greenfield.edu"}', 'email', NOW(), NOW(), NOW())
ON CONFLICT (provider_id, provider) DO NOTHING;

-- ── School ──────────────────────────────────────────────────
INSERT INTO schools (id, name, domain, plan, settings) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Greenfield Academy',
   'greenfield.edu',
   'active',
   '{"max_students": 200, "max_classes": 20}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── Profiles ────────────────────────────────────────────────
INSERT INTO profiles (id, full_name, avatar_url) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Ananya Sharma', NULL),
  ('22222222-2222-2222-2222-222222222222', 'Rohan Mehta', NULL),
  ('33333333-3333-3333-3333-333333333333', 'Priya Gupta', NULL),
  ('44444444-4444-4444-4444-444444444444', 'Arjun Singh', NULL),
  ('55555555-5555-5555-5555-555555555555', 'Diya Patel', NULL),
  ('66666666-6666-6666-6666-666666666666', 'Kabir Verma', NULL)
ON CONFLICT (id) DO NOTHING;

-- ── School Members ──────────────────────────────────────────
INSERT INTO school_members (school_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'teacher'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'student'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'student'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'student'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'student'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'student')
ON CONFLICT (school_id, user_id) DO NOTHING;

-- ── Class ───────────────────────────────────────────────────
INSERT INTO classes (id, school_id, teacher_id, name, subject, grade) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111',
   '8-B Biology',
   'Biology',
   '8')
ON CONFLICT (id) DO NOTHING;

-- ── Class Enrollments ───────────────────────────────────────
INSERT INTO class_enrollments (class_id, student_id) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '66666666-6666-6666-6666-666666666666')
ON CONFLICT (class_id, student_id) DO NOTHING;

-- ── Topics ──────────────────────────────────────────────────

-- Topic 1: Photosynthesis
INSERT INTO topics (id, class_id, title, subject, chapter, description, knowledge_base) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccc01',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'Photosynthesis',
   'Biology',
   'Chapter 7: Life Processes',
   'The process by which green plants make food using sunlight, carbon dioxide, and water.',
   '{
     "key_concepts": [
       {"concept": "Light-dependent reactions", "description": "Occur in thylakoid membranes, use light energy to split water (photolysis), produce ATP and NADPH, release O2 as byproduct"},
       {"concept": "Calvin Cycle (Light-independent reactions)", "description": "Occur in stroma, use ATP + NADPH to fix CO2 into G3P (glucose precursor), enzyme RuBisCO catalyzes carbon fixation"},
       {"concept": "Chlorophyll and pigments", "description": "Chlorophyll a and b absorb red and blue wavelengths, reflect green. Accessory pigments (carotenoids) broaden absorption spectrum"},
       {"concept": "Factors affecting rate", "description": "Light intensity, CO2 concentration, temperature, water availability. Law of limiting factors applies"},
       {"concept": "Overall equation", "description": "6CO2 + 6H2O + light energy → C6H12O6 + 6O2. Endothermic reaction, stores chemical energy in glucose"},
       {"concept": "Chloroplast structure", "description": "Double membrane organelle. Thylakoids stacked into grana, connected by lamellae. Stroma is the fluid matrix"}
     ],
     "common_misconceptions": [
       "Plants only photosynthesize during the day (they respire 24/7)",
       "Plants get food from soil (they make it via photosynthesis)",
       "Oxygen is produced in the Calvin Cycle (it is released during light reactions from water splitting)"
     ],
     "difficulty_level": "intermediate"
   }'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Topic 2: Cellular Respiration
INSERT INTO topics (id, class_id, title, subject, chapter, description, knowledge_base) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccc02',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'Cellular Respiration',
   'Biology',
   'Chapter 7: Life Processes',
   'The process by which cells break down glucose to release energy (ATP).',
   '{
     "key_concepts": [
       {"concept": "Glycolysis", "description": "Occurs in cytoplasm, splits glucose (6C) into 2 pyruvate (3C), net gain of 2 ATP and 2 NADH, anaerobic (no oxygen needed)"},
       {"concept": "Krebs Cycle", "description": "Occurs in mitochondrial matrix, acetyl-CoA enters, produces CO2 + NADH + FADH2 + GTP. Complete oxidation of carbon atoms"},
       {"concept": "Electron Transport Chain", "description": "Inner mitochondrial membrane, NADH/FADH2 donate electrons, creates proton gradient (chemiosmosis), ATP synthase produces ~34 ATP. Oxygen is final electron acceptor → water"},
       {"concept": "Aerobic vs Anaerobic", "description": "Aerobic: full pathway (36-38 ATP/glucose). Anaerobic: glycolysis only (2 ATP), produces ethanol (yeast) or lactic acid (muscles)"},
       {"concept": "Overall equation", "description": "C6H12O6 + 6O2 → 6CO2 + 6H2O + energy (ATP). Exothermic reaction, reverse of photosynthesis equation"},
       {"concept": "ATP as energy currency", "description": "Adenosine triphosphate stores energy in phosphate bonds. Hydrolysis releases ~30.5 kJ/mol. Constantly recycled (200+ kg/day)"}
     ],
     "common_misconceptions": [
       "Respiration only happens in animals (all living cells respire)",
       "Respiration is just breathing (breathing is gas exchange, respiration is cellular energy production)",
       "ATP is produced only in mitochondria (glycolysis in cytoplasm also produces ATP)"
     ],
     "difficulty_level": "advanced"
   }'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Topic 3: Newton's Laws of Motion
INSERT INTO topics (id, class_id, title, subject, chapter, description, knowledge_base) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccc03',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'Newton''s Laws of Motion',
   'Physics',
   'Chapter 9: Force and Laws of Motion',
   'Three fundamental laws describing how objects move and respond to forces.',
   '{
     "key_concepts": [
       {"concept": "First Law (Inertia)", "description": "An object at rest stays at rest, an object in motion stays in motion with same velocity, unless acted upon by an unbalanced external force. Inertia is resistance to change in motion, proportional to mass"},
       {"concept": "Second Law (F=ma)", "description": "Net force equals mass times acceleration. Force is a vector. 1 Newton = 1 kg·m/s². Acceleration is in the direction of net force. Heavier objects need more force for same acceleration"},
       {"concept": "Third Law (Action-Reaction)", "description": "For every action there is an equal and opposite reaction. Forces come in pairs acting on DIFFERENT objects. Action-reaction pairs never cancel each other (because they act on different bodies)"},
       {"concept": "Momentum", "description": "p = mv, vector quantity. Newton''s second law can be written as F = dp/dt. Conservation of momentum in isolated systems"},
       {"concept": "Friction", "description": "Force opposing relative motion between surfaces. Static friction (prevents starting motion) > Kinetic friction (opposes ongoing motion). Depends on surface nature and normal force, NOT contact area"},
       {"concept": "Free body diagrams", "description": "Visual tool showing all forces acting on an object. Normal force, weight, friction, applied force, tension. Net force determines acceleration"}
     ],
     "common_misconceptions": [
       "Heavier objects fall faster (Galileo disproved: same acceleration in vacuum, ~9.8 m/s²)",
       "A moving object always has a force acting on it (no: constant velocity = zero net force, Newton 1st law)",
       "Action-reaction forces cancel out (no: they act on different objects so they cannot cancel)"
     ],
     "difficulty_level": "intermediate"
   }'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── Sample Sessions (for heatmap testing) ───────────────────

-- Rohan: strong in photosynthesis (85), weak in respiration (35), medium in Newton (62)
INSERT INTO sessions (id, student_id, topic_id, class_id, school_id, status, mastery_score, strengths, gaps, assessment, started_at, ended_at, duration_seconds, transcript) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddd01',
   '22222222-2222-2222-2222-222222222222',
   'cccccccc-cccc-cccc-cccc-cccccccccc01',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'completed', 85,
   '["Correctly explained the overall equation", "Good understanding of chloroplast structure", "Mentioned light-dependent and independent reactions"]'::jsonb,
   '[{"concept": "Calvin Cycle details", "severity": "minor", "explanation": "Did not mention RuBisCO enzyme"}]'::jsonb,
   'Strong overall understanding. Minor gap in Calvin Cycle enzyme specifics.',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '12 minutes',
   720, '[]'::jsonb),

  ('dddddddd-dddd-dddd-dddd-dddddddddd02',
   '22222222-2222-2222-2222-222222222222',
   'cccccccc-cccc-cccc-cccc-cccccccccc02',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'completed', 35,
   '["Mentioned glucose as starting material"]'::jsonb,
   '[{"concept": "Glycolysis", "severity": "critical", "explanation": "Could not explain any steps"}, {"concept": "Electron Transport Chain", "severity": "critical", "explanation": "No mention at all"}, {"concept": "Krebs Cycle", "severity": "moderate", "explanation": "Confused with Calvin Cycle"}]'::jsonb,
   'Significant gaps in understanding. Student appears to confuse respiration with photosynthesis.',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '8 minutes',
   480, '[]'::jsonb),

  ('dddddddd-dddd-dddd-dddd-dddddddddd03',
   '22222222-2222-2222-2222-222222222222',
   'cccccccc-cccc-cccc-cccc-cccccccccc03',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'completed', 62,
   '["Good explanation of First Law", "Correct F=ma formula"]'::jsonb,
   '[{"concept": "Third Law pairs", "severity": "moderate", "explanation": "Thinks action-reaction forces cancel"}, {"concept": "Momentum", "severity": "minor", "explanation": "Did not connect to Newton''s second law"}]'::jsonb,
   'Developing understanding. Core formulas understood but conceptual depth lacking.',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '10 minutes',
   600, '[]'::jsonb);

-- Priya: expert across all (92, 88, 95)
INSERT INTO sessions (id, student_id, topic_id, class_id, school_id, status, mastery_score, strengths, gaps, assessment, started_at, ended_at, duration_seconds, transcript) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddd04',
   '33333333-3333-3333-3333-333333333333',
   'cccccccc-cccc-cccc-cccc-cccccccccc01',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'completed', 92,
   '["Excellent coverage", "Mentioned photolysis and NADPH", "Discussed limiting factors"]'::jsonb,
   '[]'::jsonb,
   'Outstanding understanding demonstrated through clear, original explanations.',
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '15 minutes',
   900, '[]'::jsonb),

  ('dddddddd-dddd-dddd-dddd-dddddddddd05',
   '33333333-3333-3333-3333-333333333333',
   'cccccccc-cccc-cccc-cccc-cccccccccc02',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'completed', 88,
   '["Strong grasp of all three stages", "Correctly explained chemiosmosis", "Good analogies used"]'::jsonb,
   '[{"concept": "ATP yield numbers", "severity": "minor", "explanation": "Slightly inaccurate ATP count for ETC"}]'::jsonb,
   'Highly proficient. Minor numerical inaccuracy does not indicate conceptual weakness.',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '14 minutes',
   840, '[]'::jsonb),

  ('dddddddd-dddd-dddd-dddd-dddddddddd06',
   '33333333-3333-3333-3333-333333333333',
   'cccccccc-cccc-cccc-cccc-cccccccccc03',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'completed', 95,
   '["Perfect explanation of all three laws", "Correctly distinguished action-reaction pairs", "Excellent use of examples"]'::jsonb,
   '[]'::jsonb,
   'Expert-level mastery. Used real-world examples to illustrate abstract concepts.',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '18 minutes',
   1080, '[]'::jsonb);

-- Arjun: struggling across the board (28, 42, 31)
INSERT INTO sessions (id, student_id, topic_id, class_id, school_id, status, mastery_score, strengths, gaps, assessment, started_at, ended_at, duration_seconds, transcript) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddd07',
   '44444444-4444-4444-4444-444444444444',
   'cccccccc-cccc-cccc-cccc-cccccccccc01',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'completed', 28,
   '["Knows plants use sunlight"]'::jsonb,
   '[{"concept": "Chemical equation", "severity": "critical", "explanation": "Cannot write or explain the equation"}, {"concept": "Chloroplast structure", "severity": "critical", "explanation": "No understanding of where reactions occur"}, {"concept": "Light reactions vs Calvin Cycle", "severity": "critical", "explanation": "Cannot distinguish between the two stages"}]'::jsonb,
   'Fundamental gaps across all areas. Needs significant remediation.',
   NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days' + INTERVAL '6 minutes',
   360, '[]'::jsonb),

  ('dddddddd-dddd-dddd-dddd-dddddddddd08',
   '44444444-4444-4444-4444-444444444444',
   'cccccccc-cccc-cccc-cccc-cccccccccc02',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'completed', 42,
   '["Knows cells need energy", "Mentioned mitochondria"]'::jsonb,
   '[{"concept": "Glycolysis", "severity": "moderate", "explanation": "Vague description, no specifics"}, {"concept": "ETC", "severity": "critical", "explanation": "No understanding of electron transport"}]'::jsonb,
   'Below developing level. Some awareness of concepts but no depth.',
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '7 minutes',
   420, '[]'::jsonb),

  ('dddddddd-dddd-dddd-dddd-dddddddddd09',
   '44444444-4444-4444-4444-444444444444',
   'cccccccc-cccc-cccc-cccc-cccccccccc03',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'completed', 31,
   '["Knows F=ma"]'::jsonb,
   '[{"concept": "First Law", "severity": "moderate", "explanation": "Confuses inertia with gravity"}, {"concept": "Third Law", "severity": "critical", "explanation": "Cannot explain action-reaction"}, {"concept": "Friction", "severity": "critical", "explanation": "No understanding of types of friction"}]'::jsonb,
   'Significant struggle with abstract physics concepts. Recommend 1-on-1 support.',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '5 minutes',
   300, '[]'::jsonb);

-- Diya: strong but uneven (78, 91, 55)
INSERT INTO sessions (id, student_id, topic_id, class_id, school_id, status, mastery_score, strengths, gaps, assessment, started_at, ended_at, duration_seconds, transcript) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddd10',
   '55555555-5555-5555-5555-555555555555',
   'cccccccc-cccc-cccc-cccc-cccccccccc01',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'completed', 78,
   '["Good equation knowledge", "Understands role of chlorophyll"]'::jsonb,
   '[{"concept": "Calvin Cycle", "severity": "moderate", "explanation": "Incomplete understanding of carbon fixation"}]'::jsonb,
   'Proficient overall with room for growth in Calvin Cycle specifics.',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '11 minutes',
   660, '[]'::jsonb),

  ('dddddddd-dddd-dddd-dddd-dddddddddd11',
   '55555555-5555-5555-5555-555555555555',
   'cccccccc-cccc-cccc-cccc-cccccccccc02',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'completed', 91,
   '["Excellent grasp of glycolysis", "Clear explanation of aerobic vs anaerobic", "Strong understanding of ATP"]'::jsonb,
   '[]'::jsonb,
   'Expert-level understanding of cellular respiration.',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '16 minutes',
   960, '[]'::jsonb),

  ('dddddddd-dddd-dddd-dddd-dddddddddd12',
   '55555555-5555-5555-5555-555555555555',
   'cccccccc-cccc-cccc-cccc-cccccccccc03',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'completed', 55,
   '["Knows F=ma", "Basic understanding of First Law"]'::jsonb,
   '[{"concept": "Third Law", "severity": "moderate", "explanation": "Gave incorrect examples"}, {"concept": "Free body diagrams", "severity": "moderate", "explanation": "Cannot draw or interpret FBDs"}]'::jsonb,
   'Biology strength does not transfer to physics. Needs more practice with force analysis.',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '9 minutes',
   540, '[]'::jsonb);

-- Kabir: no sessions yet (new student)

-- ── Streaks ─────────────────────────────────────────────────
INSERT INTO streaks (student_id, school_id, current_streak, longest_streak, last_activity_date, streak_freezes_available) VALUES
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, 5, CURRENT_DATE - 1, 1),
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3, 3, CURRENT_DATE, 2),
  ('44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 0, 1, CURRENT_DATE - 4, 0),
  ('55555555-5555-5555-5555-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, 2, CURRENT_DATE, 1)
ON CONFLICT (student_id, school_id) DO NOTHING;

-- ── Mastery Credits ─────────────────────────────────────────
INSERT INTO mastery_credits (student_id, session_id, school_id, credits_earned) VALUES
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddd02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 0),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddd03', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1),
  ('33333333-3333-3333-3333-333333333333', 'dddddddd-dddd-dddd-dddd-dddddddddd04', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3),
  ('33333333-3333-3333-3333-333333333333', 'dddddddd-dddd-dddd-dddd-dddddddddd05', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2),
  ('33333333-3333-3333-3333-333333333333', 'dddddddd-dddd-dddd-dddd-dddddddddd06', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3),
  ('44444444-4444-4444-4444-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddd07', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 0),
  ('44444444-4444-4444-4444-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddd08', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1),
  ('44444444-4444-4444-4444-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddd09', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 0),
  ('55555555-5555-5555-5555-555555555555', 'dddddddd-dddd-dddd-dddd-dddddddddd10', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2),
  ('55555555-5555-5555-5555-555555555555', 'dddddddd-dddd-dddd-dddd-dddddddddd11', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3),
  ('55555555-5555-5555-5555-555555555555', 'dddddddd-dddd-dddd-dddd-dddddddddd12', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1);
