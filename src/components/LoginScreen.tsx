import React, { useState, useEffect } from 'react';
import { Calendar, Mail, Eye, EyeOff, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User as UserType, HABIT_COLORS } from '../utils/types';

interface LoginScreenProps {
  onLogin: (user: UserType) => void;
}

/**
 * Login Screen Component
 * 
 * Handles user authentication (login/signup) and automatic default habit creation.
 * Features:
 * - Email/password authentication
 * - User registration with profile creation
 * - Automatic default habit setup based on user name
 * - Password visibility toggle
 * - Form validation and error handling
 */
const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  // Form state management
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * Default Habits Configuration
   * 
   * Predefined habit sets for specific users to automatically set up their tracking.
   * Each user gets 3 personalized habits based on their goals and preferences.
   */
  const addDefaultHabits = async (userId: string, userName: string) => {
    const defaultHabits: { [key: string]: Array<{ name: string; type: string; color: string; target: string }> } = {
      // Anuj's fitness and learning goals
      'Anuj Nawal': [
        { name: 'Read 6 Books', type: 'book', color: HABIT_COLORS[0], target: '6 books' },
        { name: 'Gym 12 Times/Month', type: 'exercise', color: HABIT_COLORS[1], target: '144 sessions' },
        { name: 'Learn AI', type: 'ai_learning', color: HABIT_COLORS[2], target: '96 topics' }
      ],
      // Suraj's endurance and reading goals
      'Suraj Rarath': [
        { name: 'Half Marathon Training', type: 'running', color: HABIT_COLORS[0], target: '1200 km' },
        { name: 'Swimming Practice', type: 'swimming', color: HABIT_COLORS[1], target: '240 hours' },
        { name: 'Read 6 Books', type: 'book', color: HABIT_COLORS[2], target: '6 books' }
      ],
      // Krishna's fitness and weight loss goals
      'Krishna Amar': [
        { name: 'Run 500km/Year', type: 'running', color: HABIT_COLORS[0], target: '500 km' },
        { name: 'Read 10 Books', type: 'book', color: HABIT_COLORS[1], target: '10 books' },
        { name: 'Weight Loss (10kg)', type: 'weight', color: HABIT_COLORS[2], target: '75 kg' }
      ],
      // Ritwik's career and social media goals
      'Ritwik Garg': [
        { name: 'Job Search', type: 'job_search', color: HABIT_COLORS[0], target: '240 activities' },
        { name: 'Learn AI', type: 'ai_learning', color: HABIT_COLORS[1], target: '96 topics' },
        { name: 'Instagram Growth', type: 'instagram', color: HABIT_COLORS[2], target: '5000 followers' }
      ],
      // Legacy support for shorter names (backward compatibility)
      'Anuj': [
        { name: 'Read 6 Books', type: 'book', color: HABIT_COLORS[0], target: '6 books' },
        { name: 'Gym 12 Times/Month', type: 'exercise', color: HABIT_COLORS[1], target: '144 sessions' },
        { name: 'Learn AI', type: 'ai_learning', color: HABIT_COLORS[2], target: '96 topics' }
      ],
      'Suraj': [
        { name: 'Half Marathon Training', type: 'running', color: HABIT_COLORS[0], target: '1200 km' },
        { name: 'Swimming Practice', type: 'swimming', color: HABIT_COLORS[1], target: '240 hours' },
        { name: 'Read 6 Books', type: 'book', color: HABIT_COLORS[2], target: '6 books' }
      ],
      'Amar': [
        { name: 'Run 500km/Year', type: 'running', color: HABIT_COLORS[0], target: '500 km' },
        { name: 'Read 10 Books', type: 'book', color: HABIT_COLORS[1], target: '10 books' },
        { name: 'Weight Loss (10kg)', type: 'weight', color: HABIT_COLORS[2], target: '75 kg' }
      ],
      'Krishna': [
        { name: 'Run 500km/Year', type: 'running', color: HABIT_COLORS[0], target: '500 km' },
        { name: 'Read 10 Books', type: 'book', color: HABIT_COLORS[1], target: '10 books' },
        { name: 'Weight Loss (10kg)', type: 'weight', color: HABIT_COLORS[2], target: '75 kg' }
      ],
      'Ritwik': [
        { name: 'Job Search', type: 'job_search', color: HABIT_COLORS[0], target: '240 activities' },
        { name: 'Learn AI', type: 'ai_learning', color: HABIT_COLORS[1], target: '96 topics' },
        { name: 'Instagram Growth', type: 'instagram', color: HABIT_COLORS[2], target: '5000 followers' }
      ]
    };

    // Try to find matching default habits for the user
    let habitsToAdd = defaultHabits[userName] || [];
    
    // If no exact match found, try partial name matching
    if (habitsToAdd.length === 0) {
      const nameKey = Object.keys(defaultHabits).find(key => 
        userName.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(userName.toLowerCase())
      );
      if (nameKey) {
        habitsToAdd = defaultHabits[nameKey];
      }
    }
    
    // Insert default habits into database if found
    if (habitsToAdd.length > 0) {
      const { error } = await supabase
        .from('habits')
        .insert(
          habitsToAdd.map(habit => ({
            user_id: userId,
            name: habit.name,
            type: habit.type,
            color: habit.color,
            target: habit.target
          }))
        );

      if (error) {
        console.error('Error adding default habits:', error);
      }
    }
  };

  useEffect(() => {
    /**
     * Check for existing user session on component mount
     * Automatically log in user if valid session exists
     */
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch user profile data
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (userData) {
          // Automatically log in user
          onLogin({
            id: userData.id,
            email: userData.email,
            name: userData.name
          });
        }
      }
    };
    
    checkUser();
  }, [onLogin]);

  /**
   * Handle form submission for both login and signup
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        // Handle user login
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        // Fetch user profile after successful login
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (userData) {
          onLogin({
            id: userData.id,
            email: userData.email,
            name: userData.name
          });
        }
      } else {
        // Handle user registration
        const { data, error } = await supabase.auth.signUp({
          email,
          password
        });

        if (error) throw error;

        if (data.user) {
          // Create user profile record in database
          const { error: profileError } = await supabase
            .from('users')
            .insert([
              {
                id: data.user.id,
                email: data.user.email!,
                name: name
              }
            ]);

          if (profileError) throw profileError;

          // Automatically add default habits for new user
          await addDefaultHabits(data.user.id, name);

          // Log in the new user
          onLogin({
            id: data.user.id,
            email: data.user.email!,
            name: name
          });
        }
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        {/* Header Section */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Habit Tracker</h1>
          <p className="text-sm text-gray-600">Track your daily habits and build consistency</p>
        </div>

        {/* Error Message Display */}
        {error && (
          <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Login/Signup Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name field (only shown during signup) */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Enter your full name"
                  required
                />
              </div>
            </div>
          )}

          {/* Email field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Enter your email"
                required
              />
            </div>
          </div>

          {/* Password field with visibility toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Enter your password"
                required
                minLength={6}
              />
              {/* Password visibility toggle button */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              isLogin ? 'Sign In' : 'Sign Up'
            )}
          </button>
        </form>

        {/* Toggle between login and signup */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;