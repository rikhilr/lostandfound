-- Add notification_token to items_lost table
ALTER TABLE items_lost 
ADD COLUMN IF NOT EXISTS notification_token TEXT;

-- Create index on notification_token for faster lookups
CREATE INDEX IF NOT EXISTS items_lost_notification_token_idx ON items_lost(notification_token);

-- Create match_notifications table
CREATE TABLE IF NOT EXISTS match_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lost_item_id UUID NOT NULL REFERENCES items_lost(id) ON DELETE CASCADE,
  found_item_id UUID NOT NULL REFERENCES items_found(id) ON DELETE CASCADE,
  notification_token TEXT NOT NULL,
  viewed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (lost_item_id) REFERENCES items_lost(id),
  FOREIGN KEY (found_item_id) REFERENCES items_found(id)
);

-- Create index on notification_token for faster lookups
CREATE INDEX IF NOT EXISTS match_notifications_token_idx ON match_notifications(notification_token);
CREATE INDEX IF NOT EXISTS match_notifications_viewed_idx ON match_notifications(viewed);

