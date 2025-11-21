-- Migration: add pack-level custom system prompt and keep RPCs in sync
ALTER TABLE public.packs_v2
ADD COLUMN IF NOT EXISTS custom_system_prompt TEXT;

-- Create pack with optional custom system prompt
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

-- Update pack metadata, including custom system prompt
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
