-- Migration: Add hsn_code column to invoice_items table
-- This migration adds support for HSN codes in invoice items

-- Add hsn_code column to invoice_items table
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20);

-- Optional: Update existing invoice items with HSN codes from their associated parts
UPDATE invoice_items ii
SET hsn_code = p.hsn_code
FROM parts p
WHERE ii.part_id = p.id
  AND ii.hsn_code IS NULL
  AND p.hsn_code IS NOT NULL;
