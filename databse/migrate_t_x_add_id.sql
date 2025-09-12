-- Migration script to add auto-increment ID to t_x table
-- Run this script to update existing t_x table structure

-- Step 1: Add the new auto-increment ID column
ALTER TABLE t_x ADD COLUMN id SERIAL;

-- Step 2: Make x_id unique instead of primary key (if it's currently primary key)
-- First, drop the existing primary key constraint if it exists
ALTER TABLE t_x DROP CONSTRAINT IF EXISTS t_x_pkey;

-- Step 3: Set the new ID column as primary key
ALTER TABLE t_x ADD CONSTRAINT t_x_pkey PRIMARY KEY (id);

-- Step 4: Add unique constraint on x_id
ALTER TABLE t_x ADD CONSTRAINT t_x_x_id_unique UNIQUE (x_id);

-- Step 5: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_t_x_x_id ON t_x(x_id);
CREATE INDEX IF NOT EXISTS idx_t_x_created_at ON t_x(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_t_x_user_id ON t_x(user_id);

-- Step 6: Update statistics
ANALYZE t_x;

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 't_x' 
ORDER BY ordinal_position;
