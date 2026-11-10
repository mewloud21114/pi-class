-- Reference data: Mauritanian secondary-school levels
INSERT INTO education_levels (code, name_fr, name_ar, sort_order) VALUES
  ('4AS', '4ème année secondaire',                 'السنة الرابعة إعدادية',          1),
  ('5C',  '5ème année — Sciences mathématiques',   'السنة الخامسة — رياضيات (C)',     2),
  ('5D',  '5ème année — Sciences naturelles',      'السنة الخامسة — علوم طبيعية (D)', 3),
  ('6C',  '6ème année — Sciences mathématiques',   'السنة السادسة — رياضيات (C)',     4),
  ('6D',  '6ème année — Sciences naturelles',      'السنة السادسة — علوم طبيعية (D)', 5),
  ('7C',  '7ème année (Bac) — Sciences mathématiques', 'السنة السابعة — رياضيات (C)', 6),
  ('7D',  '7ème année (Bac) — Sciences naturelles',    'السنة السابعة — علوم طبيعية (D)', 7)
ON CONFLICT (code) DO NOTHING;
