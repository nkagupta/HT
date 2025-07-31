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
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Weekly Progress</h2>
            <div className="text-sm text-gray-500">
              Current week vs last week
            </div>
          </div>

          {userHabitsWithData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No habits found. Add some habits to track your progress!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {userHabitsWithData.map((habit) => {
                const isExpanded = expandedHabits.has(habit.id);
                const TrendIcon = habit.trend === 'up' ? TrendingUp : 
                                habit.trend === 'down' ? TrendingDown : Minus;
                const trendColor = habit.trend === 'up' ? 'text-green-500' : 
                                 habit.trend === 'down' ? 'text-red-500' : 'text-blue-500';

                return (
                  <div key={habit.id} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: habit.color }}
                        />
                        <div>
                          <h3 className="font-medium text-gray-800">{habit.name}</h3>
                          <p className="text-sm text-gray-500 capitalize">
                            {habit.type.replace('_', ' ')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        {/* Weekly Progress Display */}
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-800">
                            {habit.currentWeek}/{habit.totalPossible}
                          </div>
                          <div className="text-xs text-gray-500">This week</div>
                        </div>

                        <div className="text-center">
                          <div className="text-lg font-medium text-gray-600">
                            {habit.lastWeek}/{habit.totalPossible}
                          </div>
                          <div className="text-xs text-gray-500">Last week</div>
                        </div>

                        <TrendIcon className={`w-5 h-5 ${trendColor}`} />

                        <button
                          onClick={() => toggleHabitExpansion(habit.id)}
                          className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                        >
                          {isExpanded ? 
                            <ChevronUp className="w-5 h-5 text-gray-500" /> : 
                            <ChevronDown className="w-5 h-5 text-gray-500" />
                          }
                        </button>
                      </div>
                    </div>

                    {/* Expanded 4-week trend chart */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">
                          4-Week Trend
                        </h4>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={habit.fourWeekData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="week" />
                              <YAxis domain={[0, 7]} />
                              <Tooltip 
                                formatter={(value: number) => [`${value} days`, 'Completions']}
                                labelFormatter={(label) => `Week: ${label}`}
                              />
                              <Bar 
                                dataKey="completions" 
                                fill={habit.color || '#3B82F6'} 
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
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