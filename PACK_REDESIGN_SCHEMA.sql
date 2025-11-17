-- ============================================================================
-- PACK SYSTEM REDESIGN - NotebookLM Style
-- ============================================================================
-- This redesign transforms packs from single-use outputs to living containers
-- that can have multiple sources (chat exports, documents) added over time.
-- ============================================================================

-- ============================================================================
-- PACKS TABLE (Redesigned)
-- ============================================================================
-- Packs are now containers/projects that users build incrementally
CREATE TABLE IF NOT EXISTS public.packs_v2 (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Pack identity
  pack_id TEXT NOT NULL UNIQUE, -- External pack ID (like job_id)
  pack_name TEXT NOT NULL,
  description TEXT,
  
  -- Pack metadata
  total_sources INTEGER DEFAULT 0, -- Number of sources added
  total_tokens BIGINT DEFAULT 0, -- Combined token count from all sources
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- R2 storage
  r2_pack_directory TEXT NOT NULL, -- Directory containing all pack files
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast user pack lookups
CREATE INDEX IF NOT EXISTS idx_packs_v2_user_id ON public.packs_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_packs_v2_pack_id ON public.packs_v2(pack_id);

-- ============================================================================
-- PACK SOURCES TABLE (New)
-- ============================================================================
-- Individual sources (chat exports, documents) that make up a pack
CREATE TABLE IF NOT EXISTS public.pack_sources (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pack_id TEXT NOT NULL REFERENCES public.packs_v2(pack_id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Source identity
  source_id TEXT NOT NULL UNIQUE, -- External source ID
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('chat_export', 'document', 'url', 'text')),
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message TEXT,
  
  -- File metadata
  file_name TEXT,
  file_size BIGINT,
  mime_type TEXT,
  
  -- Processing results
  extracted_count INTEGER DEFAULT 0, -- Number of messages/sections extracted
  total_chunks INTEGER DEFAULT 0,
  total_input_tokens BIGINT DEFAULT 0,
  total_output_tokens BIGINT DEFAULT 0,
  total_cost DECIMAL(10,4) DEFAULT 0.0000,
  
  -- R2 storage paths
  r2_raw_path TEXT, -- Original uploaded file
  r2_extracted_path TEXT, -- Extracted text
  r2_chunked_path TEXT, -- Chunked data
  r2_analyzed_path TEXT, -- Analyzed/processed data
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_pack_sources_pack_id ON public.pack_sources(pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_sources_user_id ON public.pack_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_pack_sources_source_id ON public.pack_sources(source_id);
CREATE INDEX IF NOT EXISTS idx_pack_sources_status ON public.pack_sources(status);

-- ============================================================================
-- PACK EXPORTS TABLE (New)
-- ============================================================================
-- Generated export files (compact, standard, complete) for each pack
CREATE TABLE IF NOT EXISTS public.pack_exports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pack_id TEXT NOT NULL REFERENCES public.packs_v2(pack_id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Export metadata
  export_type TEXT NOT NULL CHECK (export_type IN ('compact', 'standard', 'complete')),
  export_version INTEGER NOT NULL DEFAULT 1, -- Increments when pack is updated
  
  -- File info
  file_size BIGINT,
  token_count BIGINT,
  r2_path TEXT NOT NULL,
  
  -- Generation status
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'failed')),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pack_exports_pack_id ON public.pack_exports(pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_exports_user_id ON public.pack_exports(user_id);

-- ============================================================================
-- BACKWARD COMPATIBILITY & MIGRATION STRATEGY
-- ============================================================================
-- This approach allows both old and new systems to coexist during transition

-- 1. RENAME existing packs table to packs_legacy (don't drop it!)
ALTER TABLE IF EXISTS public.packs RENAME TO packs_legacy;

-- 2. Keep existing jobs table unchanged (still used for single-source processing)

-- 3. Create view that combines old and new packs for seamless reading
CREATE OR REPLACE VIEW public.packs_unified AS
SELECT 
  p.id,
  p.user_id,
  p.pack_id,
  p.pack_name,
  p.description,
  p.total_sources,
  p.total_tokens,
  p.r2_pack_directory,
  p.created_at,
  p.last_updated,
  'v2' as pack_version
FROM public.packs_v2 p

UNION ALL

SELECT
  pl.id,
  pl.user_id,
  pl.job_id as pack_id,
  pl.pack_name,
  NULL as description,
  1 as total_sources, -- Legacy packs have 1 source
  COALESCE((pl.chunk_stats->>'total_output_tokens')::BIGINT, 0) as total_tokens,
  pl.r2_pack_path as r2_pack_directory,
  pl.created_at,
  pl.created_at as last_updated,
  'legacy' as pack_version
FROM public.packs_legacy pl;

-- 4. Migration function to convert legacy packs to new format (run on-demand per user)
CREATE OR REPLACE FUNCTION migrate_legacy_pack_to_v2(
  target_job_id TEXT
) RETURNS JSON AS $$
DECLARE
  legacy_pack RECORD;
  legacy_job RECORD;
  new_pack_id TEXT;
  new_source_id TEXT;
  result JSON;
BEGIN
  -- Get legacy pack and job data
  SELECT * INTO legacy_pack FROM public.packs_legacy WHERE job_id = target_job_id;
  SELECT * INTO legacy_job FROM public.jobs WHERE job_id = target_job_id;
  
  IF legacy_pack IS NULL OR legacy_job IS NULL THEN
    RETURN json_build_object('error', 'Pack or job not found');
  END IF;
  
  -- Check if already migrated
  IF EXISTS (SELECT 1 FROM public.packs_v2 WHERE pack_id = target_job_id) THEN
    RETURN json_build_object('error', 'Pack already migrated', 'pack_id', target_job_id);
  END IF;
  
  -- Create new pack_v2 entry (keep same pack_id for compatibility)
  INSERT INTO public.packs_v2 (
    user_id,
    pack_id,
    pack_name,
    description,
    total_sources,
    total_tokens,
    r2_pack_directory,
    created_at,
    last_updated
  ) VALUES (
    legacy_pack.user_id,
    target_job_id, -- Keep same ID
    legacy_pack.pack_name,
    'Migrated from original pack',
    1, -- One source
    COALESCE((legacy_pack.chunk_stats->>'total_output_tokens')::BIGINT, 0),
    legacy_pack.r2_pack_path,
    legacy_pack.created_at,
    NOW()
  );
  
  -- Create pack_sources entry for the original job
  new_source_id := target_job_id || '_source_1';
  INSERT INTO public.pack_sources (
    pack_id,
    user_id,
    source_id,
    source_name,
    source_type,
    status,
    file_name,
    file_size,
    total_chunks,
    total_input_tokens,
    total_output_tokens,
    total_cost,
    r2_raw_path,
    r2_extracted_path,
    r2_chunked_path,
    r2_analyzed_path,
    created_at,
    completed_at
  ) VALUES (
    target_job_id,
    legacy_pack.user_id,
    new_source_id,
    legacy_job.file_name,
    'chat_export', -- Assume chat export (can be updated)
    'completed',
    legacy_job.file_name,
    legacy_job.file_size,
    legacy_job.total_chunks,
    legacy_job.total_input_tokens,
    legacy_job.total_output_tokens,
    legacy_job.total_cost,
    legacy_job.r2_path || '/raw',
    legacy_job.r2_path || '/extracted',
    legacy_job.r2_path || '/chunked',
    legacy_job.r2_path || '/analyzed',
    legacy_job.created_at,
    legacy_job.completed_at
  );
  
  -- Create pack_exports entries for existing files
  INSERT INTO public.pack_exports (
    pack_id,
    user_id,
    export_type,
    export_version,
    status,
    r2_path,
    created_at
  ) VALUES 
  (target_job_id, legacy_pack.user_id, 'compact', 1, 'ready', legacy_pack.r2_pack_path || '/compact', legacy_pack.created_at),
  (target_job_id, legacy_pack.user_id, 'standard', 1, 'ready', legacy_pack.r2_pack_path || '/standard', legacy_pack.created_at),
  (target_job_id, legacy_pack.user_id, 'complete', 1, 'ready', legacy_pack.r2_pack_path || '/complete', legacy_pack.created_at);
  
  result := json_build_object(
    'success', true,
    'pack_id', target_job_id,
    'source_id', new_source_id,
    'message', 'Successfully migrated legacy pack'
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Batch migration function (call this to migrate all legacy packs for a user)
CREATE OR REPLACE FUNCTION migrate_all_user_legacy_packs(
  user_uuid UUID
) RETURNS JSON AS $$
DECLARE
  legacy_pack RECORD;
  migration_results JSON[];
  result JSON;
BEGIN
  -- Migrate each legacy pack
  FOR legacy_pack IN 
    SELECT job_id FROM public.packs_legacy 
    WHERE user_id = user_uuid 
    AND job_id NOT IN (SELECT pack_id FROM public.packs_v2)
  LOOP
    migration_results := array_append(
      migration_results, 
      migrate_legacy_pack_to_v2(legacy_pack.job_id)
    );
  END LOOP;
  
  result := json_build_object(
    'migrated_count', array_length(migration_results, 1),
    'results', migration_results
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Packs V2 policies
ALTER TABLE public.packs_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own packs"
  ON public.packs_v2 FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own packs"
  ON public.packs_v2 FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own packs"
  ON public.packs_v2 FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own packs"
  ON public.packs_v2 FOR DELETE
  USING (auth.uid() = user_id);

-- Pack Sources policies
ALTER TABLE public.pack_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pack sources"
  ON public.pack_sources FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create sources in their own packs"
  ON public.pack_sources FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pack sources"
  ON public.pack_sources FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pack sources"
  ON public.pack_sources FOR DELETE
  USING (auth.uid() = user_id);

-- Pack Exports policies
ALTER TABLE public.pack_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pack exports"
  ON public.pack_exports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create exports for their own packs"
  ON public.pack_exports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pack exports"
  ON public.pack_exports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pack exports"
  ON public.pack_exports FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- BACKEND FUNCTIONS FOR RLS BYPASS
-- ============================================================================

-- Create pack
CREATE OR REPLACE FUNCTION create_pack_v2(
  user_uuid UUID,
  target_pack_id TEXT,
  pack_name_param TEXT,
  pack_description TEXT DEFAULT NULL
) RETURNS SETOF public.packs_v2 AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.packs_v2 (
    user_id, 
    pack_id, 
    pack_name, 
    description,
    r2_pack_directory,
    total_sources,
    total_tokens
  ) VALUES (
    user_uuid,
    target_pack_id,
    pack_name_param,
    pack_description,
    'user_' || user_uuid::TEXT || '/' || target_pack_id,
    0,
    0
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- List all v2 packs for user
CREATE OR REPLACE FUNCTION get_user_packs_v2(
  user_uuid UUID
) RETURNS SETOF public.packs_v2 AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.packs_v2
  WHERE user_id = user_uuid
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get pack details with sources
CREATE OR REPLACE FUNCTION get_pack_details_v2(
  user_uuid UUID,
  target_pack_id TEXT
) RETURNS JSON AS $$
DECLARE
  pack_data JSON;
BEGIN
  SELECT json_build_object(
    'pack', row_to_json(p.*),
    'pack_version', 'v2',
    'sources', (
      SELECT COALESCE(json_agg(row_to_json(s.*) ORDER BY s.created_at DESC), '[]'::json)
      FROM public.pack_sources s
      WHERE s.pack_id = target_pack_id AND s.user_id = user_uuid
    )
  )
  INTO pack_data
  FROM public.packs_v2 p
  WHERE p.pack_id = target_pack_id AND p.user_id = user_uuid;
  
  RETURN pack_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete pack and all sources
CREATE OR REPLACE FUNCTION delete_pack_v2(
  user_uuid UUID,
  target_pack_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete pack (cascade will delete sources)
  DELETE FROM public.packs_v2
  WHERE pack_id = target_pack_id AND user_id = user_uuid;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update pack metadata
CREATE OR REPLACE FUNCTION update_pack_v2(
  user_uuid UUID,
  target_pack_id TEXT,
  pack_name_param TEXT DEFAULT NULL,
  pack_description TEXT DEFAULT NULL
) RETURNS SETOF public.packs_v2 AS $$
BEGIN
  RETURN QUERY
  UPDATE public.packs_v2
  SET pack_name = COALESCE(pack_name_param, pack_name),
      description = COALESCE(pack_description, description),
      updated_at = NOW()
  WHERE pack_id = target_pack_id
    AND user_id = user_uuid
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add source to pack
CREATE OR REPLACE FUNCTION add_pack_source(
  user_uuid UUID,
  target_pack_id TEXT,
  target_source_id TEXT,
  source_name_param TEXT,
  source_type_param TEXT,
  file_name_param TEXT DEFAULT NULL,
  file_size_param BIGINT DEFAULT NULL
) RETURNS SETOF public.pack_sources AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.pack_sources (
    pack_id,
    user_id,
    source_id,
    source_name,
    source_type,
    file_name,
    file_size,
    r2_raw_path,
    status
  ) VALUES (
    target_pack_id,
    user_uuid,
    target_source_id,
    source_name_param,
    source_type_param,
    file_name_param,
    file_size_param,
    'user_' || user_uuid::TEXT || '/' || target_pack_id || '/' || target_source_id || '/raw',
    'pending'
  )
  RETURNING *;
  
  -- Update pack's total_sources count
  UPDATE public.packs_v2
  SET total_sources = total_sources + 1,
      updated_at = NOW()
  WHERE pack_id = target_pack_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update source processing status
CREATE OR REPLACE FUNCTION update_source_status(
  user_uuid UUID,
  target_source_id TEXT,
  status_param TEXT,
  progress_param INTEGER DEFAULT NULL,
  error_message_param TEXT DEFAULT NULL,
  total_chunks_param INTEGER DEFAULT NULL,
  total_input_tokens_param BIGINT DEFAULT NULL,
  total_output_tokens_param BIGINT DEFAULT NULL,
  total_cost_param DECIMAL DEFAULT NULL
) RETURNS SETOF public.pack_sources AS $$
DECLARE
  target_pack_id TEXT;
  token_delta BIGINT := 0;
BEGIN
  -- Get the pack_id and calculate token delta
  SELECT ps.pack_id, COALESCE(total_output_tokens_param, 0) - COALESCE(ps.total_output_tokens, 0)
  INTO target_pack_id, token_delta
  FROM public.pack_sources ps
  WHERE ps.source_id = target_source_id;
  
  -- Update the source
  RETURN QUERY
  UPDATE public.pack_sources
  SET status = status_param,
      progress = COALESCE(progress_param, progress),
      error_message = error_message_param,
      total_chunks = COALESCE(total_chunks_param, total_chunks),
      total_input_tokens = COALESCE(total_input_tokens_param, total_input_tokens),
      total_output_tokens = COALESCE(total_output_tokens_param, total_output_tokens),
      total_cost = COALESCE(total_cost_param, total_cost),
      completed_at = CASE WHEN status_param = 'completed' THEN NOW() ELSE completed_at END,
      updated_at = NOW()
  WHERE source_id = target_source_id AND user_id = user_uuid
  RETURNING *;
  
  -- Update pack's total token count
  IF token_delta != 0 THEN
    UPDATE public.packs_v2
    SET total_tokens = total_tokens + token_delta,
        last_updated = NOW(),
        updated_at = NOW()
    WHERE pack_id = target_pack_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get pack with all sources
CREATE OR REPLACE FUNCTION get_pack_with_sources(
  user_uuid UUID,
  target_pack_id TEXT
) RETURNS JSON AS $$
DECLARE
  pack_data JSON;
BEGIN
  SELECT json_build_object(
    'pack', row_to_json(p.*),
    'sources', (
      SELECT json_agg(row_to_json(s.*))
      FROM public.pack_sources s
      WHERE s.pack_id = target_pack_id
      ORDER BY s.created_at DESC
    )
  )
  INTO pack_data
  FROM public.packs_v2 p
  WHERE p.pack_id = target_pack_id AND p.user_id = user_uuid;
  
  RETURN pack_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- List user's packs (unified - returns both legacy and v2)
CREATE OR REPLACE FUNCTION get_user_packs(
  user_uuid UUID
) RETURNS TABLE (
  id UUID,
  user_id UUID,
  pack_id TEXT,
  pack_name TEXT,
  description TEXT,
  total_sources INTEGER,
  total_tokens BIGINT,
  r2_pack_directory TEXT,
  created_at TIMESTAMPTZ,
  last_updated TIMESTAMPTZ,
  pack_version TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.packs_unified
  WHERE packs_unified.user_id = user_uuid
  ORDER BY last_updated DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get single pack (works with both legacy and v2)
CREATE OR REPLACE FUNCTION get_pack_details(
  user_uuid UUID,
  target_pack_id TEXT
) RETURNS JSON AS $$
DECLARE
  pack_data JSON;
  is_legacy BOOLEAN;
BEGIN
  -- Check if it's a v2 pack
  IF EXISTS (SELECT 1 FROM public.packs_v2 WHERE pack_id = target_pack_id AND user_id = user_uuid) THEN
    -- Return v2 pack with sources
    SELECT json_build_object(
      'pack', row_to_json(p.*),
      'pack_version', 'v2',
      'sources', (
        SELECT COALESCE(json_agg(row_to_json(s.*) ORDER BY s.created_at DESC), '[]'::json)
        FROM public.pack_sources s
        WHERE s.pack_id = target_pack_id
      )
    )
    INTO pack_data
    FROM public.packs_v2 p
    WHERE p.pack_id = target_pack_id AND p.user_id = user_uuid;
  ELSE
    -- Return legacy pack (auto-migrate on first access)
    PERFORM migrate_legacy_pack_to_v2(target_pack_id);
    
    -- Now fetch as v2
    SELECT json_build_object(
      'pack', row_to_json(p.*),
      'pack_version', 'v2',
      'migrated_from_legacy', true,
      'sources', (
        SELECT COALESCE(json_agg(row_to_json(s.*) ORDER BY s.created_at DESC), '[]'::json)
        FROM public.pack_sources s
        WHERE s.pack_id = target_pack_id
      )
    )
    INTO pack_data
    FROM public.packs_v2 p
    WHERE p.pack_id = target_pack_id AND p.user_id = user_uuid;
  END IF;
  
  RETURN pack_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DEPLOYMENT INSTRUCTIONS
-- ============================================================================
-- 
-- STEP 1: Run this schema on your Supabase database
--         This will:
--         - Rename packs → packs_legacy (preserves all data)
--         - Create new packs_v2, pack_sources, pack_exports tables
--         - Create unified view that shows both old and new packs
--         - Create migration functions
--
-- STEP 2: No immediate frontend changes needed
--         - Old packs still show up via packs_unified view
--         - When user opens an old pack, it auto-migrates on first access
--         - Downloads continue to work from legacy R2 paths
--
-- STEP 3: Deploy updated backend (simple_backend.py)
--         - Add new endpoints for pack management
--         - Add endpoints for adding sources to packs
--         - Keep old /api/analyze endpoint working (creates legacy job)
--
-- STEP 4: Deploy updated frontend
--         - New pack detail page with "Add Source" functionality
--         - List page shows all packs (unified view handles both)
--         - Clicking old packs triggers migration automatically
--
-- STEP 5: Optional bulk migration (run per user or all at once)
--         SELECT migrate_all_user_legacy_packs('<user_id>');
--
-- ROLLBACK PLAN: If needed, just rename packs_legacy back to packs
--                All old functionality remains intact
--
-- ============================================================================
