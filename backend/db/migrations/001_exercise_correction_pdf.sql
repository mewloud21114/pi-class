-- Optional corrected version of an exercise sheet (like exams.correction_pdf_key).
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS correction_pdf_key VARCHAR(500);  -- secret, optional
