-- Draft languages for reedance.ir catalog. Does not publish; owner still clicks Publish.
INSERT INTO languages (code, name_fa, name_en, sort_order, active, updated_at) VALUES
  ('en', 'انگلیسی', 'English', 1, 1, datetime('now')),
  ('es', 'اسپانیایی', 'Spanish', 2, 1, datetime('now')),
  ('tr', 'ترکی', 'Turkish', 3, 1, datetime('now')),
  ('ru', 'روسی', 'Russian', 4, 1, datetime('now')),
  ('ko', 'کره‌ای', 'Korean', 5, 1, datetime('now')),
  ('de', 'آلمانی', 'German', 6, 1, datetime('now'))
ON CONFLICT(code) DO UPDATE SET
  name_fa = excluded.name_fa,
  name_en = excluded.name_en,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = excluded.updated_at;

UPDATE catalog_state SET draft_revision = draft_revision + 1 WHERE singleton = 1;
