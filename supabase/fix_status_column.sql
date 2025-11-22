-- Quick fix: Add status column to items_lost if missing
-- Run this in your Supabase SQL editor to fix the PGRST204 error

ALTER TABLE items_lost 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Set status to 'active' for existing rows that don't have a status
UPDATE items_lost 
SET status = 'active' 
WHERE status IS NULL;

-- Refresh PostgREST schema cache
-- Note: You may need to do this manually in Supabase Dashboard:
-- Go to Settings > API > and click "Reload schema cache" or restart the PostgREST service

