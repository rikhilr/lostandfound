-- Migration: Add latitude and longitude columns to items_found and items_lost tables
-- Run this in your Supabase SQL editor to enable proximity-based search

-- Add coordinates to items_found table
ALTER TABLE items_found 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;

ALTER TABLE items_found 
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Add coordinates to items_lost table
ALTER TABLE items_lost 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;

ALTER TABLE items_lost 
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Create indexes for efficient proximity queries
-- Note: We'll use Haversine formula for distance calculation, but indexes on lat/lng help with bounding box queries
CREATE INDEX IF NOT EXISTS items_found_coordinates_idx ON items_found(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS items_lost_coordinates_idx ON items_lost(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

