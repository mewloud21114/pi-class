-- =============================================================================
-- π-class — PostgreSQL schema (PostgreSQL 14+)
-- =============================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
CREATE TYPE user_role       AS ENUM ('STUDENT', 'ADMIN');
CREATE TYPE account_status  AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');
CREATE TYPE solution_type   AS ENUM ('TEXT', 'VIDEO');
CREATE TYPE exam_type       AS ENUM ('BAC', 'BEPC', 'CONCOURS', 'MOCK');
CREATE TYPE exam_session    AS ENUM ('NORMALE', 'COMPLEMENTAIRE');
CREATE TYPE video_provider  AS ENUM ('BUNNY', 'VIMEO', 'CLOUDFLARE', 'S3');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- education_levels  (4AS, 5C, 5D, 6C, 6D, 7C, 7D)
-- ---------------------------------------------------------------------------
CREATE TABLE education_levels (
  id          SMALLSERIAL PRIMARY KEY,
  code        VARCHAR(8)   NOT NULL UNIQUE,
  name_fr     VARCHAR(100) NOT NULL,
  name_ar     VARCHAR(100) NOT NULL,
  sort_order  SMALLINT     NOT NULL DEFAULT 0,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT education_levels_code_format CHECK (code ~ '^[0-9][A-Z]{1,2}$')
);

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           VARCHAR(16)    NOT NULL UNIQUE,          -- E.164, e.g. +22236123456
  password_hash   VARCHAR(100)   NOT NULL,                 -- bcrypt
  full_name       VARCHAR(120),
  role            user_role      NOT NULL DEFAULT 'STUDENT',
  status          account_status NOT NULL DEFAULT 'PENDING',
  is_active       BOOLEAN        GENERATED ALWAYS AS (status = 'ACTIVE') STORED,
  level_id        SMALLINT       REFERENCES education_levels(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  token_version   INTEGER        NOT NULL DEFAULT 0,       -- bump to revoke all JWTs of a user
  activated_at    TIMESTAMPTZ,
  activated_by    UUID           REFERENCES users(id) ON DELETE SET NULL,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
  CONSTRAINT users_phone_e164        CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
  CONSTRAINT users_student_has_level CHECK (role <> 'STUDENT' OR level_id IS NOT NULL)
);

CREATE INDEX users_pending_by_level_idx ON users (level_id, created_at) WHERE status = 'PENDING';
CREATE INDEX users_status_idx           ON users (status);

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- courses (الدروس) — video lessons. The raw video reference is never sent to
-- clients; they receive short-lived signed playback URLs instead.
-- ---------------------------------------------------------------------------
CREATE TABLE courses (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id          SMALLINT       NOT NULL REFERENCES education_levels(id) ON DELETE RESTRICT,
  subject           VARCHAR(40)    NOT NULL DEFAULT 'MATH',
  chapter           VARCHAR(150),
  title             VARCHAR(200)   NOT NULL,
  description       TEXT,
  video_provider    video_provider NOT NULL,
  video_ref         VARCHAR(500)   NOT NULL,     -- provider-side object key / video id (secret)
  duration_seconds  INTEGER        CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  thumbnail_url     VARCHAR(500),
  sort_order        INTEGER        NOT NULL DEFAULT 0,
  is_published      BOOLEAN        NOT NULL DEFAULT FALSE,
  created_by        UUID           REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX courses_level_idx ON courses (level_id, subject, sort_order) WHERE is_published;

CREATE TRIGGER courses_set_updated_at BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- exercises (التمارين) — PDF problem sheet + step-by-step solutions
-- ---------------------------------------------------------------------------
CREATE TABLE exercises (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id      SMALLINT      NOT NULL REFERENCES education_levels(id) ON DELETE RESTRICT,
  course_id     UUID          REFERENCES courses(id) ON DELETE SET NULL,  -- optional link to a lesson
  subject       VARCHAR(40)   NOT NULL DEFAULT 'MATH',
  chapter       VARCHAR(150),
  title         VARCHAR(200)  NOT NULL,
  difficulty    SMALLINT      CHECK (difficulty BETWEEN 1 AND 5),
  pdf_key       VARCHAR(500)  NOT NULL,      -- storage object key (secret)
  correction_pdf_key VARCHAR(500),          -- corrected sheet (secret, optional)
  sort_order    INTEGER       NOT NULL DEFAULT 0,
  is_published  BOOLEAN       NOT NULL DEFAULT FALSE,
  created_by    UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX exercises_level_idx ON exercises (level_id, subject, sort_order) WHERE is_published;

CREATE TRIGGER exercises_set_updated_at BEFORE UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE exercise_solutions (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id    UUID          NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  step_number    SMALLINT      NOT NULL CHECK (step_number > 0),
  solution_type  solution_type NOT NULL,
  body           TEXT,                       -- TEXT steps (Markdown + LaTeX)
  video_provider video_provider,
  video_ref      VARCHAR(500),               -- VIDEO steps (secret)
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (exercise_id, step_number),
  CONSTRAINT exercise_solutions_payload CHECK (
    (solution_type = 'TEXT'  AND body IS NOT NULL) OR
    (solution_type = 'VIDEO' AND video_ref IS NOT NULL AND video_provider IS NOT NULL)
  )
);

-- ---------------------------------------------------------------------------
-- exams (الامتحانات) — national exam archives (e.g. Bac Maths) by year & level
-- ---------------------------------------------------------------------------
CREATE TABLE exams (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id            SMALLINT      NOT NULL REFERENCES education_levels(id) ON DELETE RESTRICT,
  exam_type           exam_type     NOT NULL DEFAULT 'BAC',
  session             exam_session  NOT NULL DEFAULT 'NORMALE',
  year                SMALLINT      NOT NULL CHECK (year BETWEEN 1960 AND 2100),
  subject             VARCHAR(40)   NOT NULL DEFAULT 'MATH',
  title               VARCHAR(200)  NOT NULL,
  paper_pdf_key       VARCHAR(500)  NOT NULL,   -- secret
  correction_pdf_key  VARCHAR(500),             -- secret, optional
  is_published        BOOLEAN       NOT NULL DEFAULT FALSE,
  created_by          UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (level_id, exam_type, session, year, subject)
);

CREATE INDEX exams_level_year_idx ON exams (level_id, year DESC) WHERE is_published;

CREATE TRIGGER exams_set_updated_at BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit trail for admin decisions on accounts
-- ---------------------------------------------------------------------------
CREATE TABLE account_status_history (
  id           BIGSERIAL      PRIMARY KEY,
  user_id      UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_status   account_status NOT NULL,
  new_status   account_status NOT NULL,
  changed_by   UUID           REFERENCES users(id) ON DELETE SET NULL,
  reason       VARCHAR(300),
  changed_at   TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX account_status_history_user_idx ON account_status_history (user_id, changed_at DESC);

-- ---------------------------------------------------------------------------
-- Engagement on courses: likes, comments, viewing sessions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS course_likes (
  course_id   UUID        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, user_id)
);

CREATE TABLE IF NOT EXISTS course_comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  body        VARCHAR(1000) NOT NULL CHECK (length(btrim(body)) > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,                                  -- soft delete keeps a moderation trail
  deleted_by  UUID        REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS course_comments_course_idx ON course_comments (course_id, created_at DESC) WHERE deleted_at IS NULL;

-- One row per playback session (each time a student opens the video).
CREATE TABLE IF NOT EXISTS course_views (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id             UUID        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id               UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  max_position_seconds  INTEGER     NOT NULL DEFAULT 0 CHECK (max_position_seconds >= 0),
  duration_seconds      INTEGER     CHECK (duration_seconds IS NULL OR duration_seconds > 0)  -- as reported by the player
);
CREATE INDEX IF NOT EXISTS course_views_course_idx ON course_views (course_id, started_at DESC);
CREATE INDEX IF NOT EXISTS course_views_user_idx   ON course_views (user_id);

COMMIT;
