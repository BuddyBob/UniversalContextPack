-- Add 'building_tree' status to pack_sources status check constraint

-- First, drop the existing constraint
ALTER TABLE pack_sources DROP CONSTRAINT IF EXISTS pack_sources_status_check;

-- Add new constraint with 'building_tree' status
ALTER TABLE pack_sources ADD CONSTRAINT pack_sources_status_check 
  CHECK (status IN (
    'pending',
    'extracting', 
    'ready_for_analysis',
    'analyzing',
    'processing',
    'analyzing_chunks',
    'building_tree',
    'completed',
    'failed'
  ));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'pack_sources'::regclass 
AND conname = 'pack_sources_status_check';
