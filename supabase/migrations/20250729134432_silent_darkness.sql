/*
  # Add Target Column to Habits Table

  1. Schema Changes
    - Add `target` column to `habits` table to store yearly targets for each habit
    - This allows users to set and track progress against specific goals

  2. Data Structure
    - `target` (text, nullable) - Stores target descriptions like "10 books", "500km", "75kg"
    - Flexible text format allows for different target types across habit categories

  3. Backward Compatibility
    - Column is nullable so existing habits continue to work
    - Users can optionally add targets to existing habits
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'habits' AND column_name = 'target'
  ) THEN
    ALTER TABLE habits ADD COLUMN target text;
  END IF;
END $$;