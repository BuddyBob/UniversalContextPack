-- Function to increment chunks_analyzed counter in user_profiles
-- This function updates the user's total chunks analyzed count

CREATE OR REPLACE FUNCTION public.increment_chunks_analyzed(
  user_uuid UUID,
  increment_by INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update the chunks_analyzed counter for the user
  UPDATE public.user_profiles 
  SET chunks_analyzed = COALESCE(chunks_analyzed, 0) + increment_by,
      updated_at = NOW()
  WHERE id = user_uuid;
  
  -- Return true if the update was successful
  RETURN FOUND;
  
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error in increment_chunks_analyzed: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.increment_chunks_analyzed(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_chunks_analyzed(UUID, INTEGER) TO service_role;

-- Add helpful comment
COMMENT ON FUNCTION public.increment_chunks_analyzed IS 'Increments the chunks_analyzed counter for a user profile by the specified amount';
