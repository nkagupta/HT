/**
 * Type Definitions for Habit Tracker Application
 * 
 * This file contains all TypeScript interfaces and types used throughout the application.
 * It defines the data structure for users, habits, completions, and utility functions.
 */

/**
 * User interface - represents a registered user
 */
export interface User {
  id: string;
  email: string;
  name: string;
}

/**
 * Habit Types - defines all supported habit tracking methods
 * Each type corresponds to a different way of measuring progress
 */
export type HabitType = 'book' | 'running' | 'ai_learning' | 'job_search' | 'swimming' | 'weight' | 'exercise' | 'instagram';

/**
 * Custom Field interface for future extensibility
 * Allows users to define custom tracking fields for habits
 */
export interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'checkbox' | 'select';
  placeholder?: string;
  options?: string[]; // For select type
  required?: boolean;
}

/**
 * Habit interface - represents a trackable habit
 * Standardized to exactly 3 fields for friend competition consistency
 */
export interface Habit {
  id: string;
  user_id: string;
  // Field 1: Habit Name
  name: string;
  // Field 2: Tracking Method
  type: HabitType;
  // Field 3: Target (Annual Goal)
  color: string;
  color: string; // For UI display only
}

/**
 * Completion Data Types
 * Each habit type has its own completion data structure
 */

/** Book reading completion - tracks pages read and book completion */
export interface BookCompletion {
  pages_read: number;
  book_title: string;
  book_finished?: boolean;
}

/** Running/exercise completion - tracks distance in kilometers */
export interface RunningCompletion {
  kilometers: number;
}

/** AI learning completion - tracks topic studied and completion status */
export interface AILearningCompletion {
  topic: string;
  completed: boolean;
}

/** Job search completion - tracks multiple job search activities */
export interface JobSearchCompletion {
  applied_for_job: boolean;
  sought_reference: boolean;
  updated_cv: boolean;
}

/** Swimming completion - tracks hours spent swimming */
export interface SwimmingCompletion {
  hours: number;
}

/** Weight tracking completion - tracks weight and exercise minutes */
export interface WeightCompletion {
  weight_kg: number;
  minutes: number;
}

/** General exercise completion - tracks minutes of activity */
export interface ExerciseCompletion {
  minutes: number;
}

/** Instagram growth completion - tracks follower count */
export interface InstagramCompletion {
  followers: number;
}

/** Union type for all possible completion data */
export type HabitCompletionData = 
  | BookCompletion 
  | RunningCompletion 
  | AILearningCompletion 
  | JobSearchCompletion 
  | SwimmingCompletion 
  | WeightCompletion 
  | ExerciseCompletion
  | InstagramCompletion;

/** Habit completion record - links a habit to its completion data for a specific date */
export interface HabitCompletion {
  id: string;
  user_id: string;
  habit_id: string;
  date: string;
  data: HabitCompletionData;
  created_at?: string;
  updated_at?: string;
}

/**
 * Friend Competition Data Structures
 */
export interface UserProgress {
  user: User;
  habits: Habit[];
  totalLogged: {
    pages: number;
    kilometers: number;
    minutes: number;
    topics: number;
    activities: number;
  };
  currentStreak: number;
  weeklyTotal: number;
  monthlyTotal: number;
}

export interface CompetitionMetrics {
  userId: string;
  userName: string;
  habitType: HabitType;
  totalLogged: number;
  unit: string;
  target?: string;
}
/** Book record - represents a book being read */
export interface Book {
  id: string;
  user_id: string;
  title: string;
  total_pages: number;
  finished_date?: string;
}

/**
 * Utility Functions
 */

/** Convert Date object to ISO date string (YYYY-MM-DD) */
export const getDateKey = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Generate array of dates for current month calendar view
 * Includes days from previous/next month to fill complete weeks
 */
export const getCurrentMonthDates = (currentDate: Date): Date[] => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Get first and last day of the month
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  // Extend to include full weeks (start from Sunday)
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - firstDay.getDay());
  
  // Extend to include full weeks (end on Saturday)
  const endDate = new Date(lastDay);
  endDate.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
  
  // Generate array of all dates in the extended range
  const dates: Date[] = [];
  const currentDateIter = new Date(startDate);
  
  while (currentDateIter <= endDate) {
    dates.push(new Date(currentDateIter));
    currentDateIter.setDate(currentDateIter.getDate() + 1);
  }
  
  return dates;
};

/** Check if a date is within the last 7 days (for edit permissions) */
export const isWithinSevenDays = (date: Date): boolean => {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  
  return date >= sevenDaysAgo && date <= today;
};

/** Check if a date is within the last 14 days (for edit/delete permissions) */
export const isWithinFourteenDays = (date: Date): boolean => {
  const today = new Date();
  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(today.getDate() - 14);
  
  return date >= fourteenDaysAgo && date <= today;
};

/**
 * Predefined AI Learning Topics
 * Used in the AI learning habit type for consistent topic selection
 */
export const AI_TOPICS = [
  'Machine Learning',
  'Deep Learning',
  'Natural Language Processing',
  'Computer Vision',
  'Reinforcement Learning',
  'Generative AI',
  'Data Science',
  'Neural Networks'
];

/**
 * Predefined Color Palette for Habits
 * Provides consistent color options for habit visual identification
 */
export const HABIT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#F97316', // orange
  '#06B6D4', // cyan
  '#84CC16'  // lime
];