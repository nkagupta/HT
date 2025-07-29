/*
  # Database Cleanup and Restructure for Friend Competition

  1. Data Cleanup
    - Remove ALL existing habit completion data
    - Remove ALL existing books data
    - Preserve user accounts and habit definitions

  2. Habit Structure Standardization
    - Ensure habits table has proper target column
    - Add any missing indexes for performance

  3. Security
    - Maintain existing RLS policies
    - Ensure proper access controls for friend competition features
*/

-- 1. Clean up all tracking/logging data
DELETE FROM public.habit_completions;
DELETE FROM public.books;

-- 2. Ensure habits table has proper structure for the new 3-field system
-- The target column should already exist, but ensure it's properly configured
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'habits' AND column_name = 'target'
  ) THEN
    ALTER TABLE public.habits ADD COLUMN target text;
  END IF;
END $$;

-- 3. Add performance indexes for friend competition queries
CREATE INDEX IF NOT EXISTS idx_habits_user_id_type ON public.habits(user_id, type);
CREATE INDEX IF NOT EXISTS idx_habit_completions_user_date ON public.habit_completions(user_id, date);

-- 4. Update any existing habits to ensure they have proper targets
-- This sets empty targets to NULL for cleaner data handling
UPDATE public.habits 
SET target = NULL 
WHERE target = '' OR target IS NULL;