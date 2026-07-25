-- PostgreSQL Performance Audit Script
-- Run: psql -d automotive_os -f pg-audit.sql

-- 1. Table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
       n_live_tup AS estimated_rows
FROM pg_stat_user_tables 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC 
LIMIT 30;

-- 2. Index usage statistics (unused indexes excluding PKs)
SELECT schemaname, tablename, indexrelid::regclass AS index_name,
       idx_scan, idx_tup_read, idx_tup_fetch,
       pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes 
WHERE idx_scan = 0 
  AND indexrelid::regclass::text NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

-- 3. Tables without indexes (excluding small lookup tables)
SELECT schemaname, tablename, n_live_tup
FROM pg_stat_user_tables t
WHERE NOT EXISTS (
  SELECT 1 FROM pg_stat_user_indexes i 
  WHERE i.schemaname = t.schemaname AND i.tablename = t.tablename
  AND i.indexrelid::regclass::text NOT LIKE '%_pkey'
)
AND n_live_tup > 100
ORDER BY n_live_tup DESC;

-- 4. Sequence scans (potential missing indexes)
SELECT schemaname, tablename, seq_scan, seq_tup_read, idx_scan,
       round(100.0*idx_scan/(NULLIF(seq_scan+idx_scan,0)),1) as idx_pct
FROM pg_stat_user_tables 
WHERE seq_scan > 1000 
ORDER BY seq_scan DESC 
LIMIT 20;

-- 5. Tables with no primary key
SELECT schemaname, tablename 
FROM pg_stat_user_tables t
WHERE NOT EXISTS (
  SELECT 1 FROM pg_class c 
  JOIN pg_index i ON c.oid = i.indexrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = t.tablename||'_pkey'
    AND n.nspname = t.schemaname
    AND i.indisprimary
);
