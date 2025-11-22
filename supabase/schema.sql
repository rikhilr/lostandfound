-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create found items table
CREATE TABLE IF NOT EXISTS items_found (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  auto_title TEXT NOT NULL,
  auto_description TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  proof_question TEXT NOT NULL,
  location TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small produces 1536-dimensional vectors
  claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create claims table
CREATE TABLE IF NOT EXISTS item_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items_found(id) ON DELETE CASCADE,
  proof_answer TEXT NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  contact_info TEXT,
  FOREIGN KEY (item_id) REFERENCES items_found(id)
);

-- Create index on embedding for vector similarity search
CREATE INDEX IF NOT EXISTS items_found_embedding_idx ON items_found 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index on claimed status for faster filtering
CREATE INDEX IF NOT EXISTS items_found_claimed_idx ON items_found(claimed);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS items_found_created_at_idx ON items_found(created_at DESC);

-- Create function for vector similarity search
CREATE OR REPLACE FUNCTION search_similar_items(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  image_url TEXT,
  auto_title TEXT,
  auto_description TEXT,
  tags TEXT[],
  proof_question TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  claimed BOOLEAN,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    items_found.id,
    items_found.image_url,
    items_found.auto_title,
    items_found.auto_description,
    items_found.tags,
    items_found.proof_question,
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

-- Create storage bucket for found items images
-- Note: Run this in Supabase Dashboard > Storage or via Supabase CLI
-- INSERT INTO storage.buckets (id, name, public) VALUES ('found-items', 'found-items', true);

-- Set up storage policies (run these after creating the bucket)
-- Allow public read access
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'found-items');
-- Allow authenticated users to upload
-- CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'found-items' AND auth.role() = 'authenticated');

