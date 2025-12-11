-- RPC Functions for Pack V2 API
-- Run this in Supabase SQL Editor to add the required functions

-- Ensure packs_v2 table has storage for custom pack-level prompts
ALTER TABLE public.packs_v2 ADD COLUMN IF NOT EXISTS custom_system_prompt TEXT;
-- Ensure packs_v2 table tracks the R2 directory for pack assets
ALTER TABLE public.packs_v2 ADD COLUMN IF NOT EXISTS r2_pack_directory TEXT;

-- Backfill missing directories using the user's R2 folder + pack_id
UPDATE public.packs_v2 p
SET r2_pack_directory = concat_ws('/',
  COALESCE(
    (SELECT r2_user_directory FROM public.user_profiles u WHERE u.id = p.user_id),
    'user_' || p.user_id::text
  ),
  p.pack_id
)
WHERE r2_pack_directory IS NULL;

ALTER TABLE public.packs_v2 ALTER COLUMN r2_pack_directory SET NOT NULL;

-- Create a new pack
CREATE OR REPLACE FUNCTION create_pack_v2(
  user_uuid UUID,
  target_pack_id TEXT,
  pack_name_param TEXT,
  pack_description TEXT DEFAULT NULL,
  custom_system_prompt_param TEXT DEFAULT NULL,
  r2_pack_directory_param TEXT DEFAULT NULL
) RETURNS SETOF public.packs_v2 AS $$
DECLARE
  user_r2_dir TEXT;
  pack_dir TEXT;
BEGIN
  -- Build the pack directory (allow override, otherwise derive from user profile)
  user_r2_dir := COALESCE(
    NULLIF(r2_pack_directory_param, ''),
    (SELECT r2_user_directory FROM public.user_profiles WHERE id = user_uuid),
    'user_' || user_uuid::text
  );
  pack_dir := concat_ws('/', user_r2_dir, target_pack_id);

  RETURN QUERY
  INSERT INTO public.packs_v2 (pack_id, user_id, pack_name, description, custom_system_prompt, r2_pack_directory)
  VALUES (target_pack_id, user_uuid, pack_name_param, pack_description, custom_system_prompt_param, pack_dir)
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- List all v2 packs for user with aggregated statistics
CREATE OR REPLACE FUNCTION get_user_packs_v2_with_stats(
  user_uuid UUID
) RETURNS TABLE(
  pack_id TEXT,
  user_id UUID,
  pack_name TEXT,
  description TEXT,
  custom_system_prompt TEXT,
  r2_pack_directory TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_sources BIGINT,
  total_chunks BIGINT,
  processed_chunks BIGINT,
  total_input_tokens BIGINT,
  total_output_tokens BIGINT,
  total_cost NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.pack_id,
    p.user_id,
    p.pack_name,
    p.description,
    p.custom_system_prompt,
    p.r2_pack_directory,
    p.created_at,
    p.updated_at,
    COALESCE(COUNT(s.source_id), 0)::BIGINT as total_sources,
    COALESCE(SUM(s.total_chunks), 0)::BIGINT as total_chunks,
    COALESCE(SUM(s.processed_chunks), 0)::BIGINT as processed_chunks,
    COALESCE(SUM(s.total_input_tokens), 0)::BIGINT as total_input_tokens,
    COALESCE(SUM(s.total_output_tokens), 0)::BIGINT as total_output_tokens,
    COALESCE(SUM(s.total_cost), 0)::NUMERIC as total_cost
  FROM public.packs_v2 p
  LEFT JOIN public.pack_sources s ON s.pack_id = p.pack_id AND s.user_id = p.user_id
  WHERE p.user_id = user_uuid
  GROUP BY p.pack_id, p.user_id, p.pack_name, p.description, p.custom_system_prompt, p.r2_pack_directory, p.created_at, p.updated_at
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- List all v2 packs for user (simple version without stats)
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
  total_chunks_analyzed INTEGER;
  total_chunks_available INTEGER;
BEGIN
  -- Calculate total chunks analyzed and available across all sources
  SELECT 
    COALESCE(SUM(s.processed_chunks), 0),
    COALESCE(SUM(s.total_chunks), 0)
  INTO total_chunks_analyzed, total_chunks_available
  FROM public.pack_sources s
  WHERE s.pack_id = target_pack_id AND s.user_id = user_uuid;

  SELECT json_build_object(
    'pack', row_to_json(p.*),
    'pack_version', 'v2',
    'total_chunks_analyzed', total_chunks_analyzed,
    'total_chunks_available', total_chunks_available,
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

-- Update pack metadata (if not already created)
CREATE OR REPLACE FUNCTION update_pack_v2(
  user_uuid UUID,
  target_pack_id TEXT,
  pack_name_param TEXT DEFAULT NULL,
  pack_description TEXT DEFAULT NULL,
  custom_system_prompt_param TEXT DEFAULT NULL
) RETURNS SETOF public.packs_v2 AS $$
BEGIN
  RETURN QUERY
  UPDATE public.packs_v2
  SET pack_name = COALESCE(pack_name_param, pack_name),
      description = COALESCE(pack_description, description),
      custom_system_prompt = COALESCE(custom_system_prompt_param, custom_system_prompt),
      updated_at = NOW()
  WHERE pack_id = target_pack_id
    AND user_id = user_uuid
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get source status
CREATE OR REPLACE FUNCTION get_source_status_v2(
  user_uuid UUID,
  target_source_id TEXT
) RETURNS JSON AS $$
DECLARE
  source_data JSON;
BEGIN
  SELECT row_to_json(s.*)
  INTO source_data
  FROM public.pack_sources s
  WHERE s.source_id = target_source_id AND s.user_id = user_uuid;
  
  RETURN source_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
