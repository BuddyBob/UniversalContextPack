-- RPC Functions for Pack V2 API
-- Run this in Supabase SQL Editor to add the required functions

-- Ensure packs_v2 table has storage for custom pack-level prompts
ALTER TABLE public.packs_v2 ADD COLUMN IF NOT EXISTS custom_system_prompt TEXT;

-- Create a new pack
CREATE OR REPLACE FUNCTION create_pack_v2(
  user_uuid UUID,
  target_pack_id TEXT,
  pack_name_param TEXT,
  pack_description TEXT DEFAULT NULL,
  custom_system_prompt_param TEXT DEFAULT NULL
) RETURNS SETOF public.packs_v2 AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.packs_v2 (pack_id, user_id, pack_name, description, custom_system_prompt)
  VALUES (target_pack_id, user_uuid, pack_name_param, pack_description, custom_system_prompt_param)
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
