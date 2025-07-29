/*
  # Enable Friend Competition Features - RLS Policy Updates

  This migration updates Row Level Security policies to enable friend competition features
  by allowing authenticated users to read each other's data while maintaining write security.

  ## Changes Made

  1. **Users Table**
     - Allow authenticated users to read all user profiles (id, name, email)
     - Users can still only manage their own profile data

  2. **Habits Table** 
     - Allow authenticated users to read all habits for competition features
     - Users can only insert/update/delete their own habits

  3. **Habit Completions Table**
     - Allow authenticated users to read all completions for leaderboards/charts
     - Users can only insert/update/delete their own completions

  4. **Books Table**
     - No changes (not used in competition features)

  ## Security Notes
  - Email addresses will be readable by all authenticated users
  - Users can still only modify their own data
  - Anonymous users have no access to any data
*/

-- 1. Update Users Table Policies
-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;

-- Create new policies for users table
CREATE POLICY "Authenticated users can read all users" ON public.users
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own data" ON public.users
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. Update Habits Table Policies
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can read own habits" ON public.habits;
DROP POLICY IF EXISTS "Users can insert own habits" ON public.habits;
DROP POLICY IF EXISTS "Users can update own habits" ON public.habits;
DROP POLICY IF EXISTS "Users can delete own habits" ON public.habits;

-- Create new policies for habits table
CREATE POLICY "Authenticated users can read all habits" ON public.habits
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own habits" ON public.habits
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own habits" ON public.habits
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own habits" ON public.habits
  FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Update Habit Completions Table Policies
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can read own completions" ON public.habit_completions;
DROP POLICY IF EXISTS "Users can insert own completions" ON public.habit_completions;
DROP POLICY IF EXISTS "Users can update own completions" ON public.habit_completions;
DROP POLICY IF EXISTS "Users can delete own completions" ON public.habit_completions;

-- Create new policies for habit_completions table
CREATE POLICY "Authenticated users can read all completions" ON public.habit_completions
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own completions" ON public.habit_completions
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own completions" ON public.habit_completions
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own completions" ON public.habit_completions
  FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Books table policies remain unchanged (not used in competition features)
-- The existing "Users can manage own books" policies are sufficient

-- Verify all tables have RLS enabled (should already be enabled)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;