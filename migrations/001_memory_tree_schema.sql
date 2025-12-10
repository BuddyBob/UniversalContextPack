-- Memory Tree Schema Migration
-- Phase 1: Add scope and create memory tree tables

-- 1. Add scope column to pack_sources
ALTER TABLE pack_sources
ADD COLUMN IF NOT EXISTS scope text;

CREATE INDEX IF NOT EXISTS idx_pack_sources_scope ON pack_sources(scope);

-- 2. Alter existing memory_nodes table to add source_id if missing
ALTER TABLE memory_nodes 
ADD COLUMN IF NOT EXISTS source_id uuid NULL;

-- Indexes for memory_nodes (only create if they don't exist)
CREATE INDEX IF NOT EXISTS idx_memory_nodes_user_scope ON memory_nodes(user_id, scope);
CREATE INDEX IF NOT EXISTS idx_memory_nodes_pack ON memory_nodes(pack_id);
CREATE INDEX IF NOT EXISTS idx_memory_nodes_source ON memory_nodes(source_id);
CREATE INDEX IF NOT EXISTS idx_memory_nodes_type ON memory_nodes(node_type);
-- Skip gin index if pg_trgm extension not available
-- CREATE INDEX IF NOT EXISTS idx_memory_nodes_label ON memory_nodes USING gin(label gin_trgm_ops);

-- 3. Create memory_edges table
CREATE TABLE IF NOT EXISTS memory_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_node uuid NOT NULL REFERENCES memory_nodes(id) ON DELETE CASCADE,
  to_node uuid NOT NULL REFERENCES memory_nodes(id) ON DELETE CASCADE,
  relation text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes for memory_edges
CREATE INDEX IF NOT EXISTS idx_memory_edges_from ON memory_edges(from_node);
CREATE INDEX IF NOT EXISTS idx_memory_edges_to ON memory_edges(to_node);
CREATE INDEX IF NOT EXISTS idx_memory_edges_relation ON memory_edges(relation);

-- 4. Create memory_evidence table
CREATE TABLE IF NOT EXISTS memory_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES memory_nodes(id) ON DELETE CASCADE,
  pack_id uuid NULL,
  source_id uuid NULL,
  chunk_index int NULL,
  snippet text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for memory_evidence
CREATE INDEX IF NOT EXISTS idx_memory_evidence_node ON memory_evidence(node_id);
CREATE INDEX IF NOT EXISTS idx_memory_evidence_source ON memory_evidence(source_id);
CREATE INDEX IF NOT EXISTS idx_memory_evidence_pack ON memory_evidence(pack_id);

-- Enable RLS on all tables
ALTER TABLE memory_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_evidence ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own nodes" ON memory_nodes;
DROP POLICY IF EXISTS "Users can insert their own nodes" ON memory_nodes;
DROP POLICY IF EXISTS "Users can update their own nodes" ON memory_nodes;
DROP POLICY IF EXISTS "Users can delete their own nodes" ON memory_nodes;

DROP POLICY IF EXISTS "Users can view their own edges" ON memory_edges;
DROP POLICY IF EXISTS "Users can insert their own edges" ON memory_edges;
DROP POLICY IF EXISTS "Users can delete their own edges" ON memory_edges;

DROP POLICY IF EXISTS "Users can view their own evidence" ON memory_evidence;
DROP POLICY IF EXISTS "Users can insert their own evidence" ON memory_evidence;
DROP POLICY IF EXISTS "Users can delete their own evidence" ON memory_evidence;

-- RLS Policies for memory_nodes
CREATE POLICY "Users can view their own nodes"
  ON memory_nodes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own nodes"
  ON memory_nodes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own nodes"
  ON memory_nodes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own nodes"
  ON memory_nodes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for memory_edges
CREATE POLICY "Users can view their own edges"
  ON memory_edges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own edges"
  ON memory_edges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own edges"
  ON memory_edges FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for memory_evidence
CREATE POLICY "Users can view their own evidence"
  ON memory_evidence FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own evidence"
  ON memory_evidence FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own evidence"
  ON memory_evidence FOR DELETE
  USING (auth.uid() = user_id);

-- Add helpful comments
COMMENT ON TABLE memory_nodes IS 'Generic knowledge graph nodes for memory tree system';
COMMENT ON TABLE memory_edges IS 'Relationships between memory nodes';
COMMENT ON TABLE memory_evidence IS 'Links from nodes back to source chunks';
COMMENT ON COLUMN pack_sources.scope IS 'Scope categorization: user_profile, knowledge:<topic>, etc.';
