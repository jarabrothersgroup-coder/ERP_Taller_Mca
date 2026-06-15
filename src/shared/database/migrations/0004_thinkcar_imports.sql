CREATE TABLE IF NOT EXISTS thinkcar_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  file_size INTEGER,
  source_channel TEXT NOT NULL DEFAULT 'usb',
  source_path TEXT,

  vin TEXT,
  brand TEXT,
  model TEXT,
  report_type TEXT,
  scan_date TIMESTAMPTZ,
  dtc_codes TEXT[],
  dtc_descriptions JSONB,

  vehicle_id UUID REFERENCES vehiculos(id) ON DELETE SET NULL,
  orden_trabajo_id UUID REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,

  raw_text TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS thinkcar_imports_file_hash_idx ON thinkcar_imports(file_hash);
CREATE INDEX IF NOT EXISTS thinkcar_imports_vin_idx ON thinkcar_imports(vin);
CREATE INDEX IF NOT EXISTS thinkcar_imports_status_idx ON thinkcar_imports(status);
CREATE INDEX IF NOT EXISTS thinkcar_imports_vehicle_id_idx ON thinkcar_imports(vehicle_id);
CREATE INDEX IF NOT EXISTS thinkcar_imports_created_at_idx ON thinkcar_imports(created_at);

COMMENT ON TABLE thinkcar_imports IS 'Thinkcar ThinkTool Mini diagnostic report imports with deduplication and smart linking';
COMMENT ON COLUMN thinkcar_imports.file_hash IS 'SHA-256 hash of the PDF file for strict duplicate detection';
COMMENT ON COLUMN thinkcar_imports.source_channel IS 'Ingestion channel: usb, bluetooth, email, or api';
COMMENT ON COLUMN thinkcar_imports.status IS 'Processing status: pending, linked, manual_review, error, duplicate';
COMMENT ON COLUMN thinkcar_imports.vin IS 'Extracted VIN/chassis number (17 chars or empty for Nissan/etc)';
COMMENT ON COLUMN thinkcar_imports.dtc_codes IS 'Array of DTC codes extracted from the PDF';
COMMENT ON COLUMN thinkcar_imports.dtc_descriptions IS 'Full DTC details: code, system, description, status';
