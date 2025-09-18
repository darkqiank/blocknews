-- Migration script to add more_info JSONB field to t_x table
-- This field will store additional metadata including AI analysis results
-- Run this script to update existing t_x table structure

-- Step 1: Add the new more_info JSONB column
ALTER TABLE t_x ADD COLUMN more_info JSONB DEFAULT '{}';

-- Step 2: Create index on more_info for better performance
CREATE INDEX IF NOT EXISTS idx_t_x_more_info ON t_x USING GIN (more_info);

-- Step 3: Create specific index for AI analysis queries
CREATE INDEX IF NOT EXISTS idx_t_x_ai_analyzed ON t_x USING GIN ((more_info->'ai_result'));

-- Step 4: Migrate existing ai_result data from data field to more_info field
-- This handles cases where ai_result was previously stored in the data field
UPDATE t_x 
SET more_info = jsonb_set(
    COALESCE(more_info, '{}'),
    '{ai_result}',
    (data->'ai_result')
)
WHERE data ? 'ai_result' AND jsonb_typeof(data) = 'object';

-- Step 5: Remove ai_result from data field after migration (optional, uncomment if needed)
-- UPDATE t_x 
-- SET data = data - 'ai_result'
-- WHERE data ? 'ai_result' AND jsonb_typeof(data) = 'object';

-- Step 6: Update statistics
ANALYZE t_x;

-- Step 7: Verify the migration
-- Show sample records with ai_result data
SELECT 
    id, 
    x_id, 
    item_type,
    CASE 
        WHEN more_info ? 'ai_result' THEN 'Has AI Result'
        ELSE 'No AI Result'
    END as ai_status,
    more_info->'ai_result'->>'analyzed_at' as analyzed_at
FROM t_x 
WHERE more_info ? 'ai_result'
LIMIT 5;

-- Show table structure after migration
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 't_x' 
ORDER BY ordinal_position;

-- Show index information
SELECT 
    indexname, 
    indexdef
FROM pg_indexes 
WHERE tablename = 't_x'
ORDER BY indexname;
