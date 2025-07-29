/*
  # Clean All User Data

  1. Remove all existing data
    - Delete all habit completions
    - Delete all books data  
    - Delete all habits
    - Keep only users table for authentication
  
  2. Fresh start for beta testing
    - No test data
    - Clean database state
    - Users start with empty habits list
*/

-- Remove all habit completions
DELETE FROM habit_completions;

-- Remove all books data
DELETE FROM books;

-- Remove all habits
DELETE FROM habits;

-- Keep users table intact for authentication
-- Users will start fresh with no habits