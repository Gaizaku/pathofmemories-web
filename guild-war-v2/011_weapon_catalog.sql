-- Keep the production weapon catalog aligned with the registration UI.
-- Existing IDs are preserved so saved loadouts and attendance history remain valid.
INSERT INTO weapons (game_id, id, name) VALUES
  ('where-winds-meet', 'W001', 'Infernal Twinblades'),
  ('where-winds-meet', 'W002', 'Thundercry Blade'),
  ('where-winds-meet', 'W003', 'Inkwell Fan'),
  ('where-winds-meet', 'W004', 'Mortal Rope Dart'),
  ('where-winds-meet', 'W005', 'Strategic Sword'),
  ('where-winds-meet', 'W006', 'Snowparting Blade'),
  ('where-winds-meet', 'W007', 'Phalanxbane Blade'),
  ('where-winds-meet', 'W008', 'Panacea Fan'),
  ('where-winds-meet', 'W009', 'Vernal Umbrella'),
  ('where-winds-meet', 'W010', 'Nameless Sword'),
  ('where-winds-meet', 'W011', 'Nameless Spear'),
  ('where-winds-meet', 'W012', 'Stormbreaker Spear'),
  ('where-winds-meet', 'W013', 'Soulshade Umbrella'),
  ('where-winds-meet', 'W014', 'Heavenquaker Spear'),
  ('where-winds-meet', 'W015', 'Heavenwill Gauntlets'),
  ('where-winds-meet', 'W016', 'Skygrasp Rope Dart'),
  ('where-winds-meet', 'W017', 'Everspring Umbrella'),
  ('where-winds-meet', 'W018', 'Unfettered Rope Dart'),
  ('where-winds-meet', 'W019', 'Skystrike Gauntlets'),
  ('where-winds-meet', 'W020', 'Riven Twinblades')
ON CONFLICT (game_id, id) DO UPDATE SET name = excluded.name;
