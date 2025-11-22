-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create found items table
CREATE TABLE IF NOT EXISTS items_found (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  auto_title TEXT NOT NULL,
  auto_description TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  location TEXT NOT NULL,
  contact_info TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small produces 1536-dimensional vectors
  claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lost items table (Standard Report, no bounty)
CREATE TABLE IF NOT EXISTS items_lost (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  location TEXT,
  contact_info TEXT NOT NULL,
  image_urls TEXT[] DEFAULT '{}',
  alert_enabled BOOLEAN DEFAULT FALSE,
  embedding vector(1536),
  status TEXT DEFAULT 'active', -- 'active', 'found', 'expired'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create claims table
CREATE TABLE IF NOT EXISTS item_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items_found(id) ON DELETE CASCADE,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  claimer_contact TEXT NOT NULL,
  FOREIGN KEY (item_id) REFERENCES items_found(id)
);

-- Create index on embedding for vector similarity search (Found Items)
CREATE INDEX IF NOT EXISTS items_found_embedding_idx ON items_found 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index on embedding for vector similarity search (Lost Items)
CREATE INDEX IF NOT EXISTS items_lost_embedding_idx ON items_lost 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index on claimed status for faster filtering
CREATE INDEX IF NOT EXISTS items_found_claimed_idx ON items_found(claimed);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS items_found_created_at_idx ON items_found(created_at DESC);

-- Function for vector similarity search (Search Found Items)
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

-- Function to search for lost items similar to a found item (Reverse Match)
CREATE OR REPLACE FUNCTION search_similar_lost_items(
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

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_items_found_updated_at
  BEFORE UPDATE ON items_found
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant execute permissions for PostgREST
GRANT EXECUTE ON FUNCTION search_similar_items TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_similar_lost_items TO anon, authenticated;