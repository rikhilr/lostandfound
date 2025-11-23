-- Update search_similar_items function to include latitude and longitude
-- Run this after running add_coordinates.sql

CREATE OR REPLACE FUNCTION search_similar_items(
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
  similarity float,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION
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
    1 - (items_found.embedding <=> query_embedding) AS similarity,
    items_found.latitude,
    items_found.longitude
  FROM items_found
  WHERE items_found.claimed = FALSE
    AND 1 - (items_found.embedding <=> query_embedding) > match_threshold
  ORDER BY items_found.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

