CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('USER', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE receipt_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100),
  email VARCHAR(254),
  phone VARCHAR(30),
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'USER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_contact_required CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON users (LOWER(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique
  ON users (phone) WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id VARCHAR(100) NOT NULL,
  purchase_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  original_file_name VARCHAR(255) NOT NULL,
  stored_file_name VARCHAR(255) NOT NULL UNIQUE,
  mime_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  status receipt_status NOT NULL DEFAULT 'PENDING',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason VARCHAR(500),
  CONSTRAINT receipts_user_order_unique UNIQUE (user_id, order_id),
  CONSTRAINT receipts_processing_consistent CHECK (
    (status = 'PENDING' AND processed_at IS NULL AND processed_by IS NULL AND rejection_reason IS NULL)
    OR (status = 'APPROVED' AND processed_at IS NOT NULL AND processed_by IS NOT NULL AND rejection_reason IS NULL)
    OR (status = 'REJECTED' AND processed_at IS NOT NULL AND processed_by IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS receipts_user_submitted_idx
  ON receipts (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS receipts_status_submitted_idx
  ON receipts (status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receipt_id UUID NOT NULL UNIQUE REFERENCES receipts(id) ON DELETE CASCADE,
  code VARCHAR(40) NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vouchers_user_issued_idx
  ON vouchers (user_id, issued_at DESC);
