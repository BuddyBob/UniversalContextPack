-- QUICK DELETE - Single command to delete airstalk3r@gmail.com
-- WARNING: This will permanently delete the user and all associated data
-- Use with caution!

-- Delete from auth.users - this will cascade to all related tables due to CASCADE constraints
DELETE FROM auth.users WHERE email = 'airstalk3r@gmail.com';