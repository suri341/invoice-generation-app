-- Migration: Add customer_type, missionary_type to customers and tax_type to invoices
-- Run this migration to add new fields for customer types and tax selection

-- Add customer_type column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type VARCHAR(50);

-- Add missionary_type column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS missionary_type VARCHAR(100);

-- Add tax_type column to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_type VARCHAR(20) DEFAULT 'cgst_sgst';

-- Update existing invoices to have cgst_sgst as default
UPDATE invoices SET tax_type = 'cgst_sgst' WHERE tax_type IS NULL;
