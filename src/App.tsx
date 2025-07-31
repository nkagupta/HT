import React, { useState, useEffect } from 'react';
import { Calendar, Download, Upload, User, LogOut, Settings, BarChart, Info, Users, ChevronDown } from 'lucide-react';
import { supabase } from './lib/supabase';
import LoginScreen from './components/LoginScreen';
import CalendarView from './components/CalendarView';
import HabitSettings from './components/HabitSettings';
import SummaryView from './components/SummaryView';
import ChartsView from './components/ChartsView';
import { User as UserType } from './utils/types';

/**
 * Main Application Component
 * Redesigned with prominent header layout and hamburger menu
 */
function App() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [currentView, setCurrentView] = useState<'calendar' | 'settings' | 'summary' | 'charts'>('calendar');
  const [loading, setLoading] = useState(true);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [settingsHaveUnsavedChanges, setSettingsHaveUnsavedChanges] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<UserType[]>([]);
  const [selectedViewUser, setSelectedViewUser] = useState<UserType | null>(null);

  const incrementDataRefreshKey = () => setDataRefreshKey(prev => prev + 1);

  useEffect(() => {
    checkUser();
    loadAvailableUsers();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setCurrentUser(null);
        setSelectedViewUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
          setSelectedViewUser(userObj); // Default to viewing own data
        }
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, email, name')
        .order('name');
      
      if (error) throw error;
      setAvailableUsers(users || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSelectedViewUser(null);
    setCurrentView('calendar');
    setShowHamburgerMenu(false);
  };

  const handleViewChange = (newView: 'calendar' | 'settings' | 'summary' | 'charts') => {
    if (currentView === 'settings' && settingsHaveUnsavedChanges) {
      const confirmLeave = window.confirm('You have unsaved changes in settings. Are you sure you want to leave?');
      if (!confirmLeave) return;
      setSettingsHaveUnsavedChanges(false);
    }
    setCurrentView(newView);
  };

  const getPageInfoContent = () => {
    switch (currentView) {
      case 'calendar':
        return 'HabitFlow is your comprehensive habit tracking companion. Navigate between Calendar (daily tracking), Analytics (progress visualization), Progress (competition overview), and Settings (habit management). Track reading, exercise, learning, and more with friends in a beautiful, intuitive interface. Data syncs across all views in real-time.';
      case 'charts':
        return 'HabitFlow is your comprehensive habit tracking companion. Navigate between Calendar (daily tracking), Analytics (progress visualization), Progress (competition overview), and Settings (habit management). Track reading, exercise, learning, and more with friends in a beautiful, intuitive interface. Data syncs across all views in real-time.';
      case 'summary':
        return 'HabitFlow is your comprehensive habit tracking companion. Navigate between Calendar (daily tracking), Analytics (progress visualization), Progress (competition overview), and Settings (habit management). Track reading, exercise, learning, and more with friends in a beautiful, intuitive interface. Data syncs across all views in real-time.';
      case 'settings':
        return 'HabitFlow is your comprehensive habit tracking companion. Navigate between Calendar (daily tracking), Analytics (progress visualization), Progress (competition overview), and Settings (habit management). Track reading, exercise, learning, and more with friends in a beautiful, intuitive interface. Data syncs across all views in real-time.';
      default:
        return 'HabitFlow is your comprehensive habit tracking companion. Navigate between Calendar (daily tracking), Analytics (progress visualization), Progress (competition overview), and Settings (habit management). Track reading, exercise, learning, and more with friends in a beautiful, intuitive interface. Data syncs across all views in real-time.';
    }
  };

  const switchToUser = (user: UserType) => {
    setSelectedViewUser(user);
    setShowHamburgerMenu(false);
    incrementDataRefreshKey(); // Refresh data for the new user
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

  const displayUser = selectedViewUser || currentUser;
  const isViewingOwnData = displayUser.id === currentUser.id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-olive-100 pb-safe">
      {/* Redesigned Header */}
      <header className="bg-white shadow-lg border-b-2 border-black sticky top-0 z-40">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Left Side - Website Name and User */}
            <div className="flex-1">
              <button 
                onClick={() => handleViewChange('calendar')}
                className="flex items-center space-x-3 hover:opacity-75 transition-opacity group"
              >
                <Calendar className="w-8 h-8 text-blue-600 group-hover:scale-105 transition-transform" />
                <div className="text-left">
                  <h1 className="text-2xl font-bold text-gray-900 leading-tight">HabitFlow</h1>
                  <div className="flex items-center space-x-2 text-sm">
                    <User className="w-4 h-4 text-gray-600" />
                    <span className="text-gray-700 font-medium">{currentUser.name}</span>
                    {!isViewingOwnData && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full border border-black">
                        Viewing {displayUser.name.split(' ')[0]}'s data
                      </span>
                    )}
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
                    {/* Info Button */}
                    <button
                      onClick={() => {
                        setShowInfoModal(true);
                        setShowHamburgerMenu(false);
                      }}
                      className="w-full flex items-center space-x-3 p-4 text-left text-gray-700 hover:bg-blue-50 rounded-lg transition-colors border-2 border-black hover:border-blue-600"
                    >
                      <Info className="w-5 h-5 text-blue-600" />
                      <div>
                        <div className="font-semibold">About HabitFlow</div>
                        <div className="text-sm text-gray-500">Learn how the complete app works</div>
                      </div>
                    </button>

                    {/* Logout */}
                    <button
                      onClick={logout}
                      className="w-full flex items-center space-x-3 p-4 text-left text-red-700 hover:bg-red-50 rounded-lg transition-colors border-2 border-black hover:border-red-600"
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

        {/* Navigation Tabs */}
        <div className="px-4 pb-4">
          <div className="grid grid-cols-4 gap-1">
            <button
              onClick={() => handleViewChange('calendar')}
              className={`flex items-center justify-center space-x-2 py-3 px-2 text-sm font-medium rounded-lg transition-all border-2 ${
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
              className={`flex items-center justify-center space-x-2 py-3 px-2 text-sm font-medium rounded-lg transition-all border-2 ${
                currentView === 'charts' 
                  ? 'bg-gradient-to-r from-green-600 to-olive-600 text-white border-black shadow-lg' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-black hover:border-gray-600'
              }`}
            >
              <BarChart className="w-4 h-4" />
              <span>Analytics</span>
            </button>
            
            <button
              onClick={() => handleViewChange('summary')}
              className={`flex items-center justify-center space-x-2 py-3 px-2 text-sm font-medium rounded-lg transition-all border-2 ${
                currentView === 'summary' 
                  ? 'bg-gradient-to-r from-green-600 to-olive-600 text-white border-black shadow-lg' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-black hover:border-gray-600'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Progress</span>
            </button>
            
            <button
              onClick={() => handleViewChange('settings')}
              className={`flex items-center justify-center space-x-2 py-3 px-2 text-sm font-medium rounded-lg transition-all border-2 ${
                currentView === 'settings' 
                  ? 'bg-gradient-to-r from-green-600 to-olive-600 text-white border-black shadow-lg' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-black hover:border-gray-600'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 border-2 border-black max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">About HabitFlow</h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 border-2 border-black"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4 text-gray-600 leading-relaxed">
              <p>{getPageInfoContent()}</p>
              
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900">Navigation Guide:</h4>
                <ul className="space-y-2 text-sm">
                  <li>• <strong>Calendar:</strong> Daily habit tracking and completion</li>
                  <li>• <strong>Analytics:</strong> Visual progress charts and trends</li>
                  <li>• <strong>Progress:</strong> Rankings, streaks, and competition overview</li>
                  <li>• <strong>Settings:</strong> Manage habits, import/export data, edit entries</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900">Key Features:</h4>
                <ul className="space-y-2 text-sm">
                  <li>• <strong>Multi-User:</strong> View any user's progress (read-only)</li>
                  <li>• <strong>8 Habit Types:</strong> Books, Running, AI Learning, Job Search, Swimming, Weight, Exercise, Instagram</li>
                  <li>• <strong>Real-time Sync:</strong> All data updates instantly across views</li>
                  <li>• <strong>Data Management:</strong> Export any user's data, import only your own</li>
                  <li>• <strong>Smart Editing:</strong> Edit recent entries (7 days), manage older ones (14 days)</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-6">
              <button
                onClick={() => setShowInfoModal(false)}
                className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-olive-600 text-white font-medium rounded-lg hover:from-green-700 hover:to-olive-700 transition-colors border-2 border-black"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="px-4 py-4 max-w-md mx-auto">
        {currentView === 'calendar' && <CalendarView currentUser={displayUser} />}
        {currentView === 'charts' && <ChartsView currentUser={displayUser} dataRefreshKey={dataRefreshKey} />}
        {currentView === 'summary' && <SummaryView currentUser={displayUser} dataRefreshKey={dataRefreshKey} />}
        {currentView === 'settings' && (
          <HabitSettings
            currentUser={currentUser}
            viewingUser={displayUser}
            availableUsers={availableUsers}
            isViewingOwnData={isViewingOwnData}
            onUnsavedChangesChange={setSettingsHaveUnsavedChanges}
            onDataRefresh={incrementDataRefreshKey}
            onUserSwitch={switchToUser}
          />
        )}
      </main>
    </div>
  );
}

export default App;