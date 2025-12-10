-- ============================================================================
-- MEMORY TREE DIAGNOSTIC QUERIES
-- ============================================================================
-- Run these queries in Supabase SQL Editor to diagnose memory tree issues

-- 1. Check if memory tree tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'memory_%'
ORDER BY table_name;

-- Expected output: memory_edges, memory_evidence, memory_nodes
-- If empty: You need to run memory_tree_schema.sql migration

-- 2. Count total memory nodes in database
SELECT COUNT(*) as total_nodes 
FROM memory_nodes;

-- 3. Count nodes by pack (shows which packs have tree data)
SELECT 
  pack_id,
  COUNT(*) as node_count,
  COUNT(DISTINCT scope) as scope_count,
  COUNT(DISTINCT node_type) as type_count
FROM memory_nodes
GROUP BY pack_id
ORDER BY node_count DESC;

-- 4. Check recent nodes (last 10 created)
SELECT 
  id,
  pack_id,
  scope,
  node_type,
  label,
  created_at
FROM memory_nodes
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check if specific pack has nodes (replace YOUR_PACK_ID)
SELECT 
  scope,
  node_type,
  COUNT(*) as count
FROM memory_nodes
WHERE pack_id = 'YOUR_PACK_ID'
GROUP BY scope, node_type
ORDER BY scope, node_type;

-- 6. Check evidence links (provenance tracking)
SELECT 
  mn.pack_id,
  mn.scope,
  mn.node_type,
  COUNT(me.id) as evidence_count
FROM memory_nodes mn
LEFT JOIN memory_evidence me ON mn.id = me.node_id
GROUP BY mn.pack_id, mn.scope, mn.node_type
ORDER BY evidence_count DESC
LIMIT 20;
