import React, { useState, useEffect } from 'react';
import { Calendar, LogOut, Info, X, User, BarChart3 } from 'lucide-react';
import { supabase } from './lib/supabase';
import LoginScreen from './components/LoginScreen';
import CalendarView from './components/CalendarView';
import HabitSettings from './components/HabitSettings';
import SummaryView from './components/SummaryView';
import ChartsView from './components/ChartsView';
import PersonalProgressView from './components/PersonalProgressView';
import { User as UserType, Habit, HabitCompletion, Book } from './utils/types';

/**
 * Main Application Component
 * Redesigned with prominent header layout and hamburger menu
 */
function App() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [currentView, setCurrentView] = useState<'calendar' | 'settings' | 'progress' | 'charts' | 'personal'>('calendar');
  const [loading, setLoading] = useState(true);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [settingsHaveUnsavedChanges, setSettingsHaveUnsavedChanges] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  
  // Global data states
  const [allHabits, setAllHabits] = useState<Habit[]>([]);
  const [allCompletions, setAllCompletions] = useState<HabitCompletion[]>([]);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [allBooks, setAllBooks] = useState<Book[]>([]);

  const incrementDataRefreshKey = () => setDataRefreshKey(prev => prev + 1);

  // Fetch global app data
  const fetchGlobalAppData = async () => {
    if (!currentUser) return;

    try {
      // Fetch all habits
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .order('created_at', { ascending: true });

      if (habitsError) throw habitsError;
      setAllHabits(habitsData || []);

      // Fetch all habit completions
      const { data: completionsData, error: completionsError } = await supabase
        .from('habit_completions')
        .select('*')
        .order('date', { ascending: false });

      if (completionsError) throw completionsError;
      setAllCompletions(completionsData || []);

      // Fetch all users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true });

      if (usersError) throw usersError;
      setAllUsers(usersData || []);

      // Fetch all books
      const { data: booksData, error: booksError } = await supabase
        .from('books')
        .select('*')
        .order('created_at', { ascending: false });

      if (booksError) throw booksError;
      setAllBooks(booksData || []);

    } catch (error) {
      console.error('Error fetching global app data:', error);
    }
  };
  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setCurrentUser(null);
        setAllHabits([]);
        setAllCompletions([]);
        setAllUsers([]);
        setAllBooks([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch global data when user changes or data refresh is triggered
  useEffect(() => {
    if (currentUser) {
      fetchGlobalAppData();
    }
  }, [currentUser, dataRefreshKey]);
  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (userData) {
          const userObj = {
            id: userData.id,
            email: userData.email,
            name: userData.name
          };
          setCurrentUser(userObj);
        }
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setCurrentView('calendar');
    setShowHamburgerMenu(false);
  };

  const handleViewChange = (newView: 'calendar' | 'settings' | 'progress' | 'charts' | 'personal') => {
    if (currentView === 'settings' && settingsHaveUnsavedChanges) {
      const confirmLeave = window.confirm('You have unsaved changes in settings. Are you sure you want to leave?');
      if (!confirmLeave) return;
      setSettingsHaveUnsavedChanges(false);
    }
    setCurrentView(newView);
    setShowHamburgerMenu(false);
    
    // Fix mobile zoom issue - reset viewport
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      setTimeout(() => {
        metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
      }, 100);
    }
  };

  const getAppInfoContent = () => {
    return `HabitFlow is your comprehensive habit tracking companion designed for consistent daily progress and friendly competition.

**Complete Feature Overview:**

**📅 Calendar View**: Daily habit tracking interface where you can log progress for each of your habits. Track books (pages read), running (kilometers), AI learning (topics completed), job search activities, swimming (hours), weight tracking, exercise (minutes), and Instagram growth (followers).

**📊 Analytics View**: Visual progress charts and data analysis with multiple time periods (week, month). View daily progress trends, reading competition, fitness competition, and overall ranking charts. Each chart shows real data points without artificial connections.

**🏆 Progress View**: Competition overview showing individual habit streaks, completion percentages toward annual goals, and rankings among all users. See detailed breakdowns of pages read, kilometers covered, exercise minutes, and other metrics.

**👤 Personal Progress**: Your individual habit analysis with detailed insights, trends, and personal achievement tracking across all your habits.

**⚙️ Settings View**: Comprehensive habit management including creating/editing/deleting habits, managing historical entries (edit within 7 days, delete within 14 days), and data export functionality for backup purposes.

**Key Features:**
• 8 Different Habit Types with specialized tracking
• Individual Habit Streaks and Progress Tracking  
• Annual Goal Progress with Detailed Calculations
• Real-time Data Synchronization Across All Views
• Historical Entry Management with Time-based Permissions
• Comprehensive Data Export for Backup and Analysis
• Mobile-Optimized Interface with Touch-Friendly Controls
• Secure User Authentication and Data Protection

**How It Works:**
1. Set up your habits in Settings with annual targets
2. Track daily progress in Calendar view  
3. Monitor trends and competition in Analytics
4. Review achievements and progress in Progress tabs
5. Analyze personal performance in Personal Progress
6. Manage habits and export data in Settings

The app encourages consistency through visual progress tracking, friendly competition elements, and detailed analytics to help you build lasting habits over time.`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-olive-100 flex items-center justify-center px-4">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={setCurrentUser} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-olive-100 pb-safe">
      {/* Redesigned Header - Only place with black outlines */}
      <header className="bg-white shadow-lg border-b-2 border-black sticky top-0 z-40">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Left Side - Website Name and User */}
            <div className="flex-1">
              <button 
                onClick={() => handleViewChange('calendar')}
                className="flex items-center space-x-3 hover:opacity-75 transition-opacity group"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-green-600 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="text-white font-bold text-lg">H</span>
                </div>
                <div className="text-left">
                  <h1 className="text-2xl font-bold text-gray-900 leading-tight">HabitFlow</h1>
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="text-gray-700 font-medium">{currentUser.name}</span>
                  </div>
                </div>
              </button>
            </div>

            {/* Right Side - Hamburger Menu */}
            <div className="relative">
              <button
                onClick={() => setShowHamburgerMenu(!showHamburgerMenu)}
                className="p-3 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border-2 border-black hover:border-blue-600"
                title="Menu"
              >
                <div className="w-6 h-6 flex flex-col justify-center space-y-1">
                  <div className={`w-full h-0.5 bg-current transition-transform ${showHamburgerMenu ? 'rotate-45 translate-y-2' : ''}`} />
                  <div className={`w-full h-0.5 bg-current transition-opacity ${showHamburgerMenu ? 'opacity-0' : ''}`} />
                  <div className={`w-full h-0.5 bg-current transition-transform ${showHamburgerMenu ? '-rotate-45 -translate-y-2' : ''}`} />
                </div>
              </button>

              {/* Hamburger Menu Dropdown */}
              {showHamburgerMenu && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border-2 border-black z-50">
                  <div className="p-4 space-y-4">
                    {/* Settings Button */}
                    <button
                      onClick={() => handleViewChange('settings')}
                      className="w-full flex items-center space-x-3 p-4 text-left text-gray-700 hover:bg-green-50 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div>
                        <div className="font-semibold">Settings</div>
                        <div className="text-sm text-gray-500">Manage habits and preferences</div>
                      </div>
                    </button>
                    
                    {/* Info Button */}
                    <button
                      onClick={() => {
                        setShowInfoModal(true);
                        setShowHamburgerMenu(false);
                      }}
                      className="w-full flex items-center space-x-3 p-4 text-left text-gray-700 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Info className="w-5 h-5 text-blue-600" />
                      <div>
                        <div className="font-semibold">About HabitFlow</div>
                        <div className="text-sm text-gray-500">Complete app functionality guide</div>
                      </div>
                    </button>

                    {/* Logout */}
                    <button
                      onClick={logout}
                      className="w-full flex items-center space-x-3 p-4 text-left text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <LogOut className="w-5 h-5 text-red-600" />
                      <div>
                        <div className="font-semibold">Sign Out</div>
                        <div className="text-sm text-red-500">Logout from your account</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs - Fixed syntax and structure */}
        <div className="px-4 pb-4">
          <div className="grid grid-cols-4 gap-1">
            <button
              onClick={() => handleViewChange('calendar')}
              className={`flex items-center justify-center space-x-1 py-3 px-1 text-xs font-medium rounded-lg transition-all border-2 ${
                currentView === 'calendar' 
                  ? 'bg-gradient-to-r from-green-600 to-olive-600 text-white border-black shadow-lg' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-black hover:border-gray-600'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Calendar</span>
            </button>
            
            <button
              onClick={() => handleViewChange('charts')}
              className={`flex items-center justify-center space-x-1 py-3 px-1 text-xs font-medium rounded-lg transition-all border-2 ${
                currentView === 'charts' 
                  ? 'bg-gradient-to-r from-green-600 to-olive-600 text-white border-black shadow-lg' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-black hover:border-gray-600'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analytics</span>
            </button>
            
            <button
              onClick={() => handleViewChange('progress')}
              className={`flex items-center justify-center space-x-1 py-3 px-1 text-xs font-medium rounded-lg transition-all border-2 ${
                currentView === 'progress' 
                  ? 'bg-gradient-to-r from-green-600 to-olive-600 text-white border-black shadow-lg' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-black hover:border-gray-600'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Progress</span>
            </button>

            <button
              onClick={() => handleViewChange('personal')}
              className={`flex items-center justify-center space-x-1 py-3 px-1 text-xs font-medium rounded-lg transition-all border-2 ${
                currentView === 'personal' 
                  ? 'bg-gradient-to-r from-green-600 to-olive-600 text-white border-black shadow-lg' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-black hover:border-gray-600'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Personal</span>
            </button>
          </div>
        </div>
      </header>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">HabitFlow - Complete Guide</h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-gray-600 leading-relaxed whitespace-pre-line text-sm">
              {getAppInfoContent()}
            </div>
            
            <div className="mt-6">
              <button
                onClick={() => setShowInfoModal(false)}
                className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-olive-600 text-white font-medium rounded-lg hover:from-green-700 hover:to-olive-700 transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="px-4 py-4 max-w-md mx-auto">
        {currentView === 'calendar' && (
          <CalendarView 
            currentUser={currentUser} 
            onDataRefresh={incrementDataRefreshKey} 
          />
        )}
        {currentView === 'charts' && (
          <ChartsView
            habits={allHabits}
            habitCompletions={allCompletions}
            users={allUsers}
            currentUser={currentUser} 
          />
        )}
        {currentView === 'progress' && (
          <SummaryView
            habits={allHabits}
            habitCompletions={allCompletions}
            users={allUsers}
            books={allBooks}
            currentUser={currentUser} 
          />
        )}
        {currentView === 'personal' && (
          <PersonalProgressView 
            habits={allHabits}
            habitCompletions={allCompletions}
            currentUser={currentUser} 
          />
        )}
        {currentView === 'settings' && (
          <HabitSettings
            habits={allHabits}
            onHabitsUpdate={incrementDataRefreshKey}
            userId={currentUser.id}
          />
        )}
      </main>
    </div>
  );
}

export default App;