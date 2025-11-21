-- Migration: add pack-level custom system prompt and keep RPCs in sync
ALTER TABLE public.packs_v2
ADD COLUMN IF NOT EXISTS custom_system_prompt TEXT;
-- Store the R2 directory for each pack (required by NOT NULL constraint)
ALTER TABLE public.packs_v2 ADD COLUMN IF NOT EXISTS r2_pack_directory TEXT;

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

-- Create pack with optional custom system prompt
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
