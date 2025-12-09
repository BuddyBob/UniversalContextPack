# Fix User Profiles Permissions

## Problem
The application is getting a "permission denied for table user_profiles" error because Row Level Security (RLS) policies are not properly configured.

## Solution
Run the SQL script in your Supabase SQL editor:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `fix_user_profiles_permissions.sql`
4. Click "Run" to execute

## What This Fixes
- Allows authenticated users to view their own profile
- Allows users to insert their own profile (for new signups)
- Allows users to update their own profile
- Grants proper permissions to the authenticated role

## Verification
After running the SQL script:
1. Sign out of your application
2. Clear browser cache/cookies
3. Try signing in again
4. The error should be resolved

## Alternative: Manual Setup in Supabase UI
If you prefer to use the UI:
1. Go to Authentication → Policies in your Supabase dashboard
2. Select the `user_profiles` table
3. Add three policies:
   - **SELECT**: `auth.uid() = user_id`
   - **INSERT**: `auth.uid() = user_id`
   - **UPDATE**: `auth.uid() = user_id` (both USING and WITH CHECK)

## Current Button Behavior
The pricing page buttons are working correctly:
- **"Sign Up Free"** button → Triggers Google OAuth sign-in
- **"Get Started"** button → Triggers Google OAuth sign-in for unlimited plan
- **"Buy X Credits"** button → Triggers Google OAuth sign-in for pay-per-use

All buttons redirect to Google sign-in when user is not authenticated, then return to the pricing page after successful authentication.
