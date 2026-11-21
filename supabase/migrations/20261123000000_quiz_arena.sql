-- ============================================================================
-- Quiz Arena (Multiplayer Synchronized Study Showdown)
-- Tables and policies for real-time multiplayer quizzes.
-- Zero destructive changes.
-- ============================================================================

-- 1. Main Rooms Table
CREATE TABLE IF NOT EXISTS quiz_rooms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              VARCHAR(8) NOT NULL UNIQUE,
  host_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id         UUID REFERENCES courses(id) ON DELETE SET NULL,
  material_id       UUID REFERENCES uploaded_materials(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  question_count    INTEGER NOT NULL DEFAULT 5 CHECK (question_count BETWEEN 3 AND 25),
  duration_seconds  INTEGER NOT NULL DEFAULT 300 CHECK (duration_seconds BETWEEN 30 AND 3600),
  status            TEXT NOT NULL DEFAULT 'lobby' 
                    CHECK (status IN ('lobby', 'in_progress', 'completed', 'abandoned')),
  started_at        TIMESTAMPTZ,
  ends_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_rooms_code ON quiz_rooms(code);
CREATE INDEX IF NOT EXISTS idx_quiz_rooms_status ON quiz_rooms(status);
CREATE INDEX IF NOT EXISTS idx_quiz_rooms_host ON quiz_rooms(host_id);

-- 2. Room Questions Table (Server-side ground truth)
CREATE TABLE IF NOT EXISTS quiz_room_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES quiz_rooms(id) ON DELETE CASCADE,
  question_order  INTEGER NOT NULL,
  question_text   TEXT NOT NULL,
  options         JSONB NOT NULL,
  correct_answer  TEXT NOT NULL,
  explanation     TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, question_order)
);

CREATE INDEX IF NOT EXISTS idx_quiz_room_questions_room ON quiz_room_questions(room_id);

-- 3. Room Participants Table
CREATE TABLE IF NOT EXISTS quiz_room_participants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             UUID NOT NULL REFERENCES quiz_rooms(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name        TEXT NOT NULL,
  avatar_url          TEXT,
  is_ready            BOOLEAN NOT NULL DEFAULT false,
  status              TEXT NOT NULL DEFAULT 'joined' 
                      CHECK (status IN ('joined', 'ready', 'active', 'submitted', 'disconnected')),
  score               INTEGER NOT NULL DEFAULT 0,
  total_answered      INTEGER NOT NULL DEFAULT 0,
  answers             JSONB NOT NULL DEFAULT '{}'::jsonb,
  time_taken_seconds  NUMERIC(8, 2),
  joined_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at        TIMESTAMPTZ,
  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_room_participants_room ON quiz_room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_quiz_room_participants_user ON quiz_room_participants(user_id);

-- Row Level Security
ALTER TABLE quiz_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_room_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_room_participants ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read rooms they are part of or created
CREATE POLICY "Users can view quiz rooms they are in"
  ON quiz_rooms FOR SELECT
  TO authenticated
  USING (
    host_id = auth.uid() OR
    id IN (SELECT room_id FROM quiz_room_participants WHERE user_id = auth.uid())
  );

-- Service role bypasses RLS for server-side management
