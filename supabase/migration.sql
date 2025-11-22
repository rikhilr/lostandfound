-- Migration script to update existing database schema
-- Run this in your Supabase SQL editor if you already have tables

-- 1. Add contact_info and image_urls to items_found if they don't exist
ALTER TABLE items_found 
ADD COLUMN IF NOT EXISTS contact_info TEXT;

ALTER TABLE items_found 
ADD COLUMN IF NOT EXISTS image_urls TEXT[];

-- Migrate existing image_url to image_urls array
UPDATE items_found 
SET image_urls = ARRAY[image_url]::TEXT[]
WHERE image_urls IS NULL AND image_url IS NOT NULL;

-- Set a default for existing rows (you may want to update these manually)
UPDATE items_found 
SET contact_info = 'contact@example.com' 
WHERE contact_info IS NULL;

-- 2. Remove proof_question from items_found if it exists
ALTER TABLE items_found 
DROP COLUMN IF EXISTS proof_question;

-- 3. Add image_urls, alert_enabled, and status to items_lost if they don't exist
ALTER TABLE items_lost 
ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

ALTER TABLE items_lost 
ADD COLUMN IF NOT EXISTS alert_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE items_lost 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Set status to 'active' for existing rows that don't have a status
UPDATE items_lost 
SET status = 'active' 
WHERE status IS NULL;

-- 4. Update item_claims table
ALTER TABLE item_claims 
DROP COLUMN IF EXISTS proof_answer;

ALTER TABLE item_claims 
DROP COLUMN IF EXISTS verified;

-- Handle claimant_name if it exists (make it nullable)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'item_claims' AND column_name = 'claimant_name') THEN
    ALTER TABLE item_claims ALTER COLUMN claimant_name DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE item_claims 
ADD COLUMN IF NOT EXISTS claimer_contact TEXT;

-- Set a default for existing rows if needed
UPDATE item_claims 
SET claimer_contact = 'contact@example.com' 
WHERE claimer_contact IS NULL;

-- 5. Recreate the search_similar_items function without proof_question
DROP FUNCTION IF EXISTS search_similar_items(vector, float, int);

CREATE FUNCTION search_similar_items(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  image_urls TEXT[],
  auto_title TEXT,
  auto_description TEXT,
  tags TEXT[],
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  claimed BOOLEAN,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    items_found.id,
    items_found.image_urls,
    items_found.auto_title,
    items_found.auto_description,
    items_found.tags,
    items_found.location,
    items_found.created_at,
    items_found.claimed,
    1 - (items_found.embedding <=> query_embedding) AS similarity
  FROM items_found
  WHERE items_found.claimed = FALSE
    AND 1 - (items_found.embedding <=> query_embedding) > match_threshold
  ORDER BY items_found.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 6. Recreate the search_similar_lost_items function with alert_enabled
DROP FUNCTION IF EXISTS search_similar_lost_items(vector, float, int);

CREATE FUNCTION search_similar_lost_items(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  description TEXT,
  location TEXT,
  contact_info TEXT,
  alert_enabled BOOLEAN,
  similarity float,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    items_lost.id,
    items_lost.description,
    items_lost.location,
    items_lost.contact_info,
    items_lost.alert_enabled,
    1 - (items_lost.embedding <=> query_embedding) AS similarity,
    items_lost.created_at
  FROM items_lost
  WHERE items_lost.status = 'active'
    AND items_lost.alert_enabled = TRUE
    AND 1 - (items_lost.embedding <=> query_embedding) > match_threshold
  ORDER BY items_lost.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 7. Grant execute permissions (needed for PostgREST)
GRANT EXECUTE ON FUNCTION search_similar_items TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_similar_lost_items TO anon, authenticated;

-- 8. Refresh PostgREST schema cache (this may need to be done manually in Supabase dashboard)
-- Go to Settings > API > and click "Reload schema cache" or restart the PostgREST service

