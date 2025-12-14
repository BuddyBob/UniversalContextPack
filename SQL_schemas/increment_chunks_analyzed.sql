-- Create RPC function to increment chunks_analyzed counter in user_profiles
-- This function safely increments the chunks_analyzed counter for analytics

CREATE OR REPLACE FUNCTION public.increment_chunks_analyzed(
  user_uuid UUID,
  increment_by INTEGER
) RETURNS VOID AS $$
BEGIN
  UPDATE public.user_profiles
  SET chunks_analyzed = chunks_analyzed + increment_by
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.increment_chunks_analyzed(UUID, INTEGER) TO authenticated;
