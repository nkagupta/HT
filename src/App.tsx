import React, { useState, useEffect } from 'react';
import { Calendar, Download, Upload, User, LogOut, Settings, AlertTriangle } from 'lucide-react';
import { BarChart } from 'lucide-react';
import { supabase } from './lib/supabase';
import LoginScreen from './components/LoginScreen';
import CalendarView from './components/CalendarView';
import HabitSettings from './components/HabitSettings';
import SummaryView from './components/SummaryView';
import ChartsView from './components/ChartsView';
import { User as UserType } from './utils/types';

/**
 * Main Application Component
 * 
 * This is the root component that manages the overall application state and routing.
 * It handles user authentication, navigation between different views, and data import/export functionality.
 * 
 * Features:
 * - User authentication with Supabase
 * - Navigation between Calendar, Summary, and Settings views
 * - Data export/import functionality for user habits and completions
 * - Responsive mobile-first design
 */
function App() {
  // User authentication state
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  
  // Current view state - determines which component to render
  const [currentView, setCurrentView] = useState<'calendar' | 'settings' | 'summary' | 'charts'>('calendar');
  
  // Current date for calendar navigation
  const [currentDate] = useState(new Date());
  
  // Loading state for initial app load
  const [loading, setLoading] = useState(true);
  
  // Reference to hidden file input for data import
  const [importFileRef] = useState<React.RefObject<HTMLInputElement>>(React.createRef());

  useEffect(() => {
    /**
     * Initialize application by checking for existing user session
     * This runs once when the app loads to restore user login state
     */
    const checkUser = async () => {
      // Get current user session from Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // If user is logged in, fetch their profile data
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (userData) {
          // Set user data in app state
          setCurrentUser({
            id: userData.id,
            email: userData.email,
            name: userData.name
          });
        }
      }
      setLoading(false);
    };
    
    checkUser();

    // Set up listener for authentication state changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setCurrentUser(null);
      }
    });

    // Cleanup subscription on component unmount
    return () => subscription.unsubscribe();
  }, []);

  /**
   * Export all user data as JSON file
   * Includes habits, completions, and books data
   */
  const exportData = async () => {
    if (!currentUser) return;

    try {
      // Fetch all user habits
      const { data: habits } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', currentUser.id);

      // Fetch all habit completions
      const { data: completions } = await supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', currentUser.id);

      // Fetch all books data
      const { data: books } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', currentUser.id);

      // Combine all data into export object
      const exportData = {
        user: currentUser,
        habits: habits || [],
        completions: completions || [],
        books: books || [],
        exported_at: new Date().toISOString()
      };

      // Convert to JSON and create download link
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      // Generate filename with user name and date
      const exportFileDefaultName = `habit-tracker-${currentUser.name}-${new Date().toISOString().split('T')[0]}.json`;
      
      // Trigger download
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Error exporting data. Please try again.');
    }
  };

  /**
   * Import user data from JSON file
   * Validates data structure and imports habits, completions, and books
   */
  const importData = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate that required data arrays exist
      if (!data.habits || !Array.isArray(data.habits) ||
          !data.completions || !Array.isArray(data.completions) ||
          !data.books || !Array.isArray(data.books)) {
        throw new Error('Invalid data format. Missing required arrays: habits, completions, books');
      }

      // Validate each habit has required fields
      for (const habit of data.habits) {
        if (!habit.name || !habit.type || !habit.color) {
          throw new Error('Invalid habit structure. Each habit must have name, type, and color');
        }
      }

      // Validate each completion has required fields
      for (const completion of data.completions) {
        if (!completion.habit_id || !completion.date || !completion.data) {
          throw new Error('Invalid completion structure. Each completion must have habit_id, date, and data');
        }
      }

      // Validate each book has required fields
      for (const book of data.books) {
        if (!book.title || typeof book.total_pages !== 'number') {
          throw new Error('Invalid book structure. Each book must have title and total_pages');
        }
      }

      let importedCount = 0;

      // Import habits with upsert to handle duplicates
      if (data.habits.length > 0) {
        const { error: habitsError } = await supabase
          .from('habits')
          .upsert(
            data.habits.map((habit: any) => ({
              ...habit,
              user_id: currentUser!.id
            })),
            { onConflict: 'id' }
          );

        if (habitsError) throw habitsError;
        importedCount += data.habits.length;
      }

      // Import books with upsert to handle duplicates
      if (data.books.length > 0) {
        const { error: booksError } = await supabase
          .from('books')
          .upsert(
            data.books.map((book: any) => ({
              ...book,
              user_id: currentUser!.id
            })),
            { onConflict: 'id' }
          );

        if (booksError) throw booksError;
        importedCount += data.books.length;
      }

      // Import completions with upsert to handle duplicates
      if (data.completions.length > 0) {
        const { error: completionsError } = await supabase
          .from('habit_completions')
          .upsert(
            data.completions.map((completion: any) => ({
              ...completion,
              user_id: currentUser!.id
            })),
            { onConflict: 'habit_id,date' }
          );

        if (completionsError) throw completionsError;
        importedCount += data.completions.length;
      }

      alert(`Successfully imported ${importedCount} records!`);
      
      // Clear the file input for future imports
      if (importFileRef.current) {
        importFileRef.current.value = '';
      }
      
    } catch (error: any) {
      console.error('Error importing data:', error);
      alert(`Error importing data: ${error.message}`);
    }
  };

  /**
   * Handle file selection for import
   */
  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importData(file);
    }
  };

  /**
   * Log out current user and reset app state
   */
  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setCurrentView('calendar');
  };

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Show login screen if user is not authenticated
  if (!currentUser) {
    return <LoginScreen onLogin={setCurrentUser} />;
  }

  // Main application interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pb-safe">
      {/* Application Header with Navigation */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3">
          {/* Top row with logo and action buttons */}
          <div className="flex items-center justify-between mb-3">
            {/* App logo and title */}
            <button 
              onClick={() => setCurrentView('calendar')}
              className="flex items-center space-x-2 hover:opacity-75 transition-opacity touch-manipulation"
            >
              <Calendar className="w-6 h-6 text-blue-600" />
              <h1 className="text-lg font-bold text-gray-900">Habit Tracker</h1>
            </button>
            
            {/* Action buttons: Export, Import, Logout */}
            <div className="flex items-center space-x-2">
              {/* Export data button */}
              <button
                onClick={exportData}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Export Data"
              >
                <Download className="w-5 h-5" />
              </button>
              
              {/* Import data button */}
              <button
                onClick={() => importFileRef.current?.click()}
                className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Import Data"
              >
                <Upload className="w-5 h-5" />
              </button>
              
              {/* Hidden file input for import */}
              <input
                ref={importFileRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
              
              {/* Logout button */}
              <button
                onClick={logout}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* User info display */}
          <div className="flex items-center space-x-1 text-xs text-gray-600 mb-3">
            <User className="w-3 h-3" />
            <span>{currentUser.name}</span>
          </div>
          
          {/* Bottom navigation tabs */}
          <div className="grid grid-cols-4 gap-1">
            {/* Calendar view tab */}
            <button
              onClick={() => setCurrentView('calendar')}
              className={`flex items-center justify-center space-x-1 py-3 px-2 text-xs font-medium rounded-lg transition-colors ${
                currentView === 'calendar' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>Calendar</span>
            </button>
            
            {/* Charts view tab */}
            <button
              onClick={() => setCurrentView('charts')}
              className={`flex items-center justify-center space-x-1 py-3 px-2 text-xs font-medium rounded-lg transition-colors ${
                currentView === 'charts' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <BarChart className="w-3 h-3" />
              <span>Charts</span>
            </button>
            
            {/* Summary view tab */}
            <button
              onClick={() => setCurrentView('summary')}
              className={`flex items-center justify-center space-x-1 py-3 px-2 text-xs font-medium rounded-lg transition-colors ${
                currentView === 'summary' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <User className="w-3 h-3" />
              <span>Summary</span>
            </button>
            
            {/* Settings view tab */}
            <button
              onClick={() => setCurrentView('settings')}
              className={`flex items-center justify-center space-x-1 py-3 px-2 text-xs font-medium rounded-lg transition-colors ${
                currentView === 'settings' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Settings className="w-3 h-3" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area - renders different views based on current selection */}
      <main className="px-4 py-4 max-w-md mx-auto">
        {/* Calendar View - Daily habit tracking */}
        {currentView === 'calendar' && (
          <CalendarView
            currentUser={currentUser}
            currentDate={currentDate}
          />
        )}
        
        {/* Charts View - Data visualization and progress tracking */}
        {currentView === 'charts' && (
          <ChartsView currentUser={currentUser} />
        )}
        
        {/* Summary View - Progress overview and statistics */}
        {currentView === 'summary' && (
          <SummaryView currentUser={currentUser} />
        )}
        
        {/* Settings View - Habit management */}
        {currentView === 'settings' && (
          <HabitSettings
            currentUser={currentUser}
          />
        )}
      </main>
    </div>
  );
}

export default App;