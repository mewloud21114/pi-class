-- Likes, comments and viewing sessions on courses.
BEGIN;

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
