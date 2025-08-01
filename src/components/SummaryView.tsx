import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ChevronDown, 
  ChevronUp,
  BookOpen,
  Plus,
  X
} from 'lucide-react';
import { Habit, HabitCompletion, User, Book } from '../utils/types';

interface SummaryViewProps {
  habits: Habit[];
  habitCompletions: HabitCompletion[];
  users: User[];
  currentUser: User;
  books: Book[];
}

type Tab = 'progress' | 'books';

const SummaryView: React.FC<SummaryViewProps> = ({ 
  habits, 
  habitCompletions, 
  users, 
  currentUser,
  books 
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('progress');
  const [expandedHabits, setExpandedHabits] = useState<Set<string>>(new Set());
  const [showAddBook, setShowAddBook] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookPages, setNewBookPages] = useState('');

  // Helper function to get all users with their weekly progress
  const getAllUsersProgress = useMemo(() => {
    return users.map(user => {
      const userHabits = habits.filter(h => h.user_id === user.id);
      
      // Calculate weekly completion for this user
      const now = new Date();
      const currentWeekStart = getWeekStart(now);
      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
      
      const weeklyCompletions = habitCompletions.filter(c => {
        if (c.user_id !== user.id) return false;
        const completionDate = new Date(c.date);
        return completionDate >= currentWeekStart && completionDate <= currentWeekEnd;
      });
      
      const completedDays = new Set(weeklyCompletions.map(c => c.date)).size;
      const totalPossibleDays = Math.min(7, userHabits.length * 7); // Max 7 days per week
      
      return {
        user,
        habits: userHabits,
        completedDays,
        totalPossibleDays: 7, // Always show out of 7 days
        weeklyCompletions: weeklyCompletions.length,
        habitsCount: userHabits.length
      };
    }).filter(userProgress => userProgress.habitsCount > 0); // Only show users with habits
  }, [users, habits, habitCompletions]);

  // Helper function to get week start (Sunday)
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  // Get current and last week's data for each habit
  const getWeeklyData = (habitId: string) => {
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
    
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);

    const currentWeekCompletions = habitCompletions.filter(c => {
      if (c.habit_id !== habitId || c.user_id !== currentUser.id) return false;
      const completionDate = new Date(c.date);
      return completionDate >= currentWeekStart && completionDate <= currentWeekEnd;
    });

    const lastWeekCompletions = habitCompletions.filter(c => {
      if (c.habit_id !== habitId || c.user_id !== currentUser.id) return false;
      const completionDate = new Date(c.date);
      return completionDate >= lastWeekStart && completionDate <= lastWeekEnd;
    });

    return {
      currentWeek: currentWeekCompletions.length,
      lastWeek: lastWeekCompletions.length,
      totalPossible: 7
    };
  };

  // Generate 4-week trend data for a habit
  const getFourWeekData = (habitId: string) => {
    const data = [];
    const now = new Date();
    
    for (let i = 3; i >= 0; i--) {
      const weekStart = getWeekStart(now);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const weekCompletions = habitCompletions.filter(c => {
        if (c.habit_id !== habitId || c.user_id !== currentUser.id) return false;
        const completionDate = new Date(c.date);
        return completionDate >= weekStart && completionDate <= weekEnd;
      });

      data.push({
        week: `Week ${4-i}`,
        completions: weekCompletions.length,
        percentage: Math.round((weekCompletions.length / 7) * 100)
      });
    }
    
    return data;
  };

  // User's habits with weekly data
  const userHabitsWithData = useMemo(() => {
    return habits
      .filter(h => h.user_id === currentUser.id)
      .map(habit => {
        const weeklyData = getWeeklyData(habit.id);
        const trend = weeklyData.currentWeek > weeklyData.lastWeek ? 'up' : 
                     weeklyData.currentWeek < weeklyData.lastWeek ? 'down' : 'stable';
        
        return {
          ...habit,
          ...weeklyData,
          trend,
          fourWeekData: getFourWeekData(habit.id)
        };
      });
  }, [habits, habitCompletions, currentUser.id]);

  // Toggle habit expansion
  const toggleHabitExpansion = (habitId: string) => {
    const newExpanded = new Set(expandedHabits);
    if (newExpanded.has(habitId)) {
      newExpanded.delete(habitId);
    } else {
      newExpanded.add(habitId);
    }
    setExpandedHabits(newExpanded);
  };

  // Add book function
  const addBook = async () => {
    if (!newBookTitle.trim() || !newBookPages.trim()) return;
    
    try {
      const { supabase } = await import('../lib/supabase');
      await supabase.from('books').insert({
        user_id: currentUser.id,
        title: newBookTitle.trim(),
        total_pages: parseInt(newBookPages)
      });
      
      setNewBookTitle('');
      setNewBookPages('');
      setShowAddBook(false);
      window.location.reload(); // Refresh to show new book
    } catch (error) {
      console.error('Error adding book:', error);
    }
  };

  // Get reading progress for books
  const getBooksWithProgress = () => {
    return books.map(book => {
      const bookCompletions = habitCompletions.filter(c => {
        const habit = habits.find(h => h.id === c.habit_id && h.type === 'book');
        return habit && c.data?.bookId === book.id;
      });
      
      const totalPagesRead = bookCompletions.reduce((sum, c) => sum + (c.data?.pages || 0), 0);
      const progress = Math.min(Math.round((totalPagesRead / book.total_pages) * 100), 100);
      const isCompleted = progress >= 100;
      
      const user = users.find(u => u.id === book.user_id);
      
      return {
        ...book,
        pagesRead: totalPagesRead,
        progress,
        isCompleted,
        userName: user?.name || 'Unknown User'
      };
    });
  };

  const booksWithProgress = getBooksWithProgress();

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6">
        <button
          onClick={() => setActiveTab('progress')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'progress'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Progress
        </button>
        <button
          onClick={() => setActiveTab('books')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'books'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Books
        </button>
      </div>

      {/* Progress Tab */}
      {activeTab === 'progress' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">All Users Progress</h2>
            <div className="text-sm text-gray-500">
              Weekly completion summary
            </div>
          </div>

          {getAllUsersProgress.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No users with habits found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getAllUsersProgress.map((userProgress) => {
                const isCurrentUser = userProgress.user.id === currentUser.id;
                const completionPercentage = Math.round((userProgress.completedDays / 7) * 100);

                return (
                  <div 
                    key={userProgress.user.id} 
                    className={`bg-white rounded-lg border-2 p-6 transition-all hover:shadow-md ${
                      isCurrentUser ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    {/* User Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                          isCurrentUser ? 'bg-blue-600' : 'bg-gray-600'
                        }`}>
                          {userProgress.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className={`font-semibold ${isCurrentUser ? 'text-blue-900' : 'text-gray-800'}`}>
                            {userProgress.user.name}
                            {isCurrentUser && <span className="text-sm font-normal text-blue-600 ml-2">(You)</span>}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {userProgress.habitsCount} habit{userProgress.habitsCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Weekly Progress */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Weekly Progress</span>
                        <span className={`text-sm font-bold ${
                          completionPercentage >= 70 ? 'text-green-600' : 
                          completionPercentage >= 40 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {userProgress.completedDays}/7 days
                        </span>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            completionPercentage >= 70 ? 'bg-green-500' : 
                            completionPercentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${completionPercentage}%` }}
                        />
                      </div>
                      
                      <div className="text-xs text-gray-500 mt-1">
                        {completionPercentage}% completion rate
                      </div>
                    </div>

                    {/* Habits Summary */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Active Habits</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {userProgress.habits.slice(0, 4).map((habit) => (
                          <div key={habit.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded-md">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: habit.color }}
                            />
                            <span className="text-xs text-gray-700 truncate">
                              {habit.name}
                            </span>
                          </div>
                        ))}
                        {userProgress.habits.length > 4 && (
                          <div className="flex items-center justify-center p-2 bg-gray-100 rounded-md">
                            <span className="text-xs text-gray-500">
                              +{userProgress.habits.length - 4} more
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className={`text-lg font-bold ${isCurrentUser ? 'text-blue-600' : 'text-gray-800'}`}>
                            {userProgress.weeklyCompletions}
                          </div>
                          <div className="text-xs text-gray-500">Total Logs</div>
                        </div>
                        <div>
                          <div className={`text-lg font-bold ${
                            completionPercentage >= 70 ? 'text-green-600' : 
                            completionPercentage >= 40 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {completionPercentage}%
                          </div>
                          <div className="text-xs text-gray-500">Success Rate</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Books Tab */}
      {activeTab === 'books' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Reading Progress</h2>
            <button
              onClick={() => setShowAddBook(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Book</span>
            </button>
          </div>

          {/* Add Book Modal */}
          {showAddBook && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Add New Book</h3>
                  <button
                    onClick={() => setShowAddBook(false)}
                    className="p-1 rounded-full hover:bg-gray-100"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Book Title
                    </label>
                    <input
                      type="text"
                      value={newBookTitle}
                      onChange={(e) => setNewBookTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter book title"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Pages
                    </label>
                    <input
                      type="number"
                      value={newBookPages}
                      onChange={(e) => setNewBookPages(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter total pages"
                    />
                  </div>
                </div>
                
                <div className="flex space-x-3 mt-6">
                  <button
                    onClick={() => setShowAddBook(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addBook}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add Book
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Books List */}
          {booksWithProgress.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No books added yet. Click "Add Book" to start tracking your reading!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {booksWithProgress.map((book) => (
                <div key={book.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-medium text-gray-800 line-clamp-2">{book.title}</h3>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      book.isCompleted 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {book.progress}%
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Pages: {book.pagesRead}/{book.total_pages}</span>
                      <span>Reader: {book.userName}</span>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          book.isCompleted ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${book.progress}%` }}
                      />
                    </div>
                    
                    {book.isCompleted && (
                      <div className="flex items-center text-green-600 text-sm">
                        <BookOpen className="w-4 h-4 mr-1" />
                        <span>Completed!</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SummaryView;