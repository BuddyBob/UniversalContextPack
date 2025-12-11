-- ============================================================================
-- MEMORY TREE SCHEMA - Context Pack V2 Enhancement
-- ============================================================================
-- This migration adds the Memory Tree system for structured knowledge storage.
-- Run this in Supabase SQL Editor after the main schema is deployed.
--
-- FEATURES:
-- - Structured node-based knowledge graph (vs concatenated text)
-- - Scope-based organization (user_profile, knowledge:topic)
-- - Evidence linking to source chunks
-- - Supports merging facts from multiple sources
-- ============================================================================

-- Enable UUID extension (should already be enabled, but ensures it)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE 1: memory_nodes
-- ============================================================================
-- Stores individual knowledge facts as nodes in the tree
-- Each node has a type (Identity, Preference, Project, etc.) and flexible JSON data

CREATE TABLE IF NOT EXISTS public.memory_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id text NULL,  -- Nullable to allow cross-pack nodes in future
  scope text NOT NULL,  -- 'user_profile', 'knowledge:topic_name', etc.
  node_type text NOT NULL,  -- 'Identity', 'Preference', 'Project', 'Section', 'Event', 'Entity', 'Concept'
  label text,  -- Human-readable label for this node
  data jsonb NOT NULL DEFAULT '{}'::jsonb,  -- Flexible storage for node-specific data
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Comments for documentation
COMMENT ON TABLE public.memory_nodes IS 'Knowledge graph nodes storing structured facts from context packs';
COMMENT ON COLUMN public.memory_nodes.scope IS 'Namespace for the node: user_profile for personal info, knowledge:topic for domain knowledge';
COMMENT ON COLUMN public.memory_nodes.node_type IS 'Type of fact: Identity, Preference, Project, Skill, Goal, Constraint, Section, Event, Entity, Concept';
COMMENT ON COLUMN public.memory_nodes.data IS 'Node-specific data stored as JSON (flexible schema per node_type)';

-- ============================================================================
-- TABLE 2: memory_edges
-- ============================================================================
-- Stores relationships between nodes (parent_of, about, evidence_for, etc.)

CREATE TABLE IF NOT EXISTS public.memory_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_node uuid NOT NULL REFERENCES public.memory_nodes(id) ON DELETE CASCADE,
  to_node uuid NOT NULL REFERENCES public.memory_nodes(id) ON DELETE CASCADE,
  relation text NOT NULL,  -- 'parent_of', 'about', 'evidence_for', 'same_as', 'related_to'
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.memory_edges IS 'Relationships between memory nodes in the knowledge graph';
COMMENT ON COLUMN public.memory_edges.relation IS 'Type of relationship: parent_of, about, evidence_for, same_as, related_to';

-- ============================================================================
-- TABLE 3: memory_evidence
-- ============================================================================
-- Links nodes to the source chunks they came from (provenance tracking)

CREATE TABLE IF NOT EXISTS public.memory_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES public.memory_nodes(id) ON DELETE CASCADE,
  pack_id text NULL,
  source_id text NULL,
  chunk_index int NULL,
  snippet text,  -- Short excerpt showing where this fact came from
  timestamp timestamptz NULL,  -- For time-stamped facts (e.g., from conversations)
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.memory_evidence IS 'Evidence linking memory nodes to source chunks for provenance';
COMMENT ON COLUMN public.memory_evidence.snippet IS 'Short text excerpt showing where the fact was extracted from';
COMMENT ON COLUMN public.memory_evidence.timestamp IS 'Original timestamp of the fact (if available, e.g., from chat messages)';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- memory_nodes indexes
CREATE INDEX IF NOT EXISTS idx_memory_nodes_user_scope 
  ON public.memory_nodes(user_id, scope, node_type);
  
CREATE INDEX IF NOT EXISTS idx_memory_nodes_pack 
  ON public.memory_nodes(user_id, pack_id);

CREATE INDEX IF NOT EXISTS idx_memory_nodes_label 
  ON public.memory_nodes(user_id, label) 
  WHERE label IS NOT NULL;

-- memory_edges indexes
CREATE INDEX IF NOT EXISTS idx_memory_edges_from 
  ON public.memory_edges(user_id, from_node);
  
CREATE INDEX IF NOT EXISTS idx_memory_edges_to 
  ON public.memory_edges(user_id, to_node);

-- memory_evidence indexes
CREATE INDEX IF NOT EXISTS idx_memory_evidence_node 
  ON public.memory_evidence(user_id, node_id);
  
CREATE INDEX IF NOT EXISTS idx_memory_evidence_source 
  ON public.memory_evidence(user_id, source_id) 
  WHERE source_id IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.memory_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_evidence ENABLE ROW LEVEL SECURITY;

-- memory_nodes policies
DROP POLICY IF EXISTS "Users can manage own memory nodes" ON public.memory_nodes;
CREATE POLICY "Users can manage own memory nodes" ON public.memory_nodes
  FOR ALL USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- memory_edges policies
DROP POLICY IF EXISTS "Users can manage own memory edges" ON public.memory_edges;
CREATE POLICY "Users can manage own memory edges" ON public.memory_edges
  FOR ALL USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- memory_evidence policies
DROP POLICY IF EXISTS "Users can manage own memory evidence" ON public.memory_evidence;
CREATE POLICY "Users can manage own memory evidence" ON public.memory_evidence
  FOR ALL USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- ALTER pack_sources TO ADD scope COLUMN
-- ============================================================================

-- Add scope column to pack_sources (manages routing to memory tree scopes)
ALTER TABLE public.pack_sources 
ADD COLUMN IF NOT EXISTS scope text;

COMMENT ON COLUMN public.pack_sources.scope IS 'Memory tree scope: user_profile for chats, knowledge:topic for documents';

-- Optional: Create index on scope for filtering
CREATE INDEX IF NOT EXISTS idx_pack_sources_scope 
  ON public.pack_sources(user_id, scope) 
  WHERE scope IS NOT NULL;

-- ============================================================================
-- TRIGGERS FOR TIMESTAMPS
-- ============================================================================

-- Trigger to update updated_at on memory_nodes
DROP TRIGGER IF EXISTS set_memory_nodes_updated_at ON public.memory_nodes;
CREATE TRIGGER set_memory_nodes_updated_at
  BEFORE UPDATE ON public.memory_nodes
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- GRANTS AND PERMISSIONS
-- ============================================================================

-- Grant access to authenticated users
GRANT ALL ON public.memory_nodes TO authenticated;
GRANT ALL ON public.memory_edges TO authenticated;
GRANT ALL ON public.memory_evidence TO authenticated;

-- Grant access to service role (for backend operations)
GRANT ALL ON public.memory_nodes TO service_role;
GRANT ALL ON public.memory_edges TO service_role;
GRANT ALL ON public.memory_evidence TO service_role;

-- ============================================================================
-- HELPER FUNCTIONS (Optional - for backend use)
-- ============================================================================

-- Function to get all nodes for a pack (bypasses RLS for backend)
CREATE OR REPLACE FUNCTION public.get_pack_memory_nodes(
  user_uuid uuid,
  target_pack_id text
)
RETURNS SETOF public.memory_nodes
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.memory_nodes
  WHERE user_id = user_uuid AND pack_id = target_pack_id
  ORDER BY scope, node_type, created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pack_memory_nodes(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pack_memory_nodes(uuid, text) TO service_role;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'MEMORY TREE SCHEMA MIGRATION COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Tables Created:';
  RAISE NOTICE '  ✓ memory_nodes (structured knowledge facts)';
  RAISE NOTICE '  ✓ memory_edges (relationships between nodes)';
  RAISE NOTICE '  ✓ memory_evidence (provenance tracking)';
  RAISE NOTICE '';
  RAISE NOTICE 'Columns Added:';
  RAISE NOTICE '  ✓ pack_sources.scope (routing to memory tree)';
  RAISE NOTICE '';
  RAISE NOTICE 'Features Enabled:';
  RAISE NOTICE '  ✓ Row Level Security (RLS) on all memory tables';
  RAISE NOTICE '  ✓ Indexes for efficient querying';
  RAISE NOTICE '  ✓ Foreign key constraints for data integrity';
  RAISE NOTICE '  ✓ Helper functions for backend access';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Deploy memory_tree.py module to backend';
  RAISE NOTICE '  2. Update analyze_source_chunks to populate tree';
  RAISE NOTICE '  3. Test with MEMORY_TREE_ENABLED=true in staging';
  RAISE NOTICE '';
  RAISE NOTICE 'Memory Tree is ready for use! 🌳';
  RAISE NOTICE '============================================================================';
END $$;
