-- Área de espera da importação dos dados do Supabase antigo (ver src/importer.js).
CREATE TABLE IF NOT EXISTS _import_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tbl TEXT NOT NULL,
  data TEXT NOT NULL
);
