import React, { useState, useEffect } from 'react';
import { User, Calendar, TrendingUp, Award, Clock, Target, Loader, Info, X, Book } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User as UserType, UserProgress } from '../utils/types';

interface SummaryViewProps {
  currentUser: UserType;
  dataRefreshKey?: number;
}

interface HabitProgress {
  habit: any;
  currentWeekUpdates: number;
  lastWeekUpdates: number;
  progressPercentage: number;
  currentProgress: number;
  targetValue: number;
  unit: string;
}

interface BookProgress {
  id: string;
  title: string;
  total_pages: number;
  current_pages: number;
  completion_percentage: number;
  user_name: string;
  finished_date?: string;
}

const SummaryView: React.FC<SummaryViewProps> = ({ currentUser, dataRefreshKey = 0 }) => {
  const [userSummaries, setUserSummaries] = useState<UserProgress[]>([]);
  const [books, setBooks] = useState<BookProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedHabitProgress, setSelectedHabitProgress] = useState<HabitProgress | null>(null);

  useEffect(() => {
    loadAllUserSummaries();
    loadAllBooks();
  }, [currentUser.id, dataRefreshKey]);

  const loadAllBooks = async () => {
    try {
      const [booksResult, usersResult, completionsResult] = await Promise.all([
        supabase.from('books').select('*').order('created_at'),
        supabase.from('users').select('*'),
        supabase.from('habit_completions').select('*')
          .gte('date', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      ]);

      if (booksResult.error) throw booksResult.error;
      if (usersResult.error) throw usersResult.error;
      if (completionsResult.error) throw completionsResult.error;

      const allBooks = booksResult.data || [];
      const allUsers = usersResult.data || [];
      const allCompletions = completionsResult.data || [];

      const booksWithProgress: BookProgress[] = allBooks.map(book => {
        const user = allUsers.find(u => u.id === book.user_id);
        
        // Calculate current pages read for this book
        const bookCompletions = allCompletions.filter(completion => 
          completion.user_id === book.user_id &&
          completion.data.book_title === book.title
        );

        const totalPagesRead = bookCompletions.reduce((sum, completion) => 
          sum + (completion.data.pages_read || 0), 0
        );

        const completionPercentage = book.total_pages > 0 ? 
          Math.min(100, (totalPagesRead / book.total_pages) * 100) : 0;

        return {
          id: book.id,
          title: book.title,
          total_pages: book.total_pages,
          current_pages: totalPagesRead,
          completion_percentage: completionPercentage,
          user_name: user?.name || 'Unknown User',
          finished_date: book.finished_date
        };
      });

      setBooks(booksWithProgress);
    } catch (error: any) {
      console.error('Error loading books:', error);
    }
  };

  const loadAllUserSummaries = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [usersResult, habitsResult, completionsResult] = await Promise.all([
        supabase.from('users').select('*').order('name'),
        supabase.from('habits').select('*').order('created_at'),
        supabase.from('habit_completions').select('*')
          .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('date')
      ]);

      if (usersResult.error) throw usersResult.error;
      if (habitsResult.error) throw habitsResult.error;
      if (completionsResult.error) throw completionsResult.error;

      const allUsers = usersResult.data || [];
      const allHabits = habitsResult.data || [];
      const allCompletions = completionsResult.data || [];

      const processedSummaries: UserProgress[] = allUsers.map(user => {
        const userHabits = allHabits.filter(h => h.user_id === user.id);
        const userCompletions = allCompletions.filter(c => c.user_id === user.id);

        const totalLogged = {
          pages: 0,
          kilometers: 0,
          minutes: 0,
          topics: 0,
          activities: 0
        };

        userCompletions.forEach(completion => {
          const habit = userHabits.find(h => h.id === completion.habit_id);
          if (!habit) return;

          switch (habit.type) {
            case 'book':
              totalLogged.pages += completion.data.pages_read || 0;
              break;
            case 'running':
              totalLogged.kilometers += completion.data.kilometers || 0;
              break;
            case 'ai_learning':
              if (completion.data.completed) totalLogged.topics += 1;
              break;
            case 'job_search':
              const jobActivities = (completion.data.applied_for_job ? 1 : 0) + 
                                  (completion.data.sought_reference ? 1 : 0) + 
                                  (completion.data.updated_cv ? 1 : 0);
              totalLogged.activities += jobActivities;
              break;
            case 'swimming':
              totalLogged.minutes += (completion.data.hours || 0) * 60;
              break;
            case 'weight':
            case 'exercise':
              totalLogged.minutes += completion.data.minutes || 0;
              break;
          }
        });

        const currentStreak = calculateUserStreak(userCompletions, userHabits);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const weeklyTotal = userCompletions.filter(c => new Date(c.date) >= sevenDaysAgo).length;

        return {
          user: { id: user.id, email: user.email, name: user.name },
          habits: userHabits,
          totalLogged,
          currentStreak,
          weeklyTotal,
          monthlyTotal: userCompletions.length
        };
      });

      processedSummaries.sort((a, b) => {
        const aTotal = Object.values(a.totalLogged).reduce((sum, val) => sum + val, 0);
        const bTotal = Object.values(b.totalLogged).reduce((sum, val) => sum + val, 0);
        return bTotal - aTotal;
      });

      setUserSummaries(processedSummaries);

    } catch (error: any) {
      console.error('Error loading user summaries:', error);
      setError(error.message || 'Failed to load summary data');
    } finally {
      setLoading(false);
    }
  };

  const calculateUserStreak = (completions: any[], habits: any[]): number => {
    if (completions.length === 0 || habits.length === 0) return 0;

    const completionDates = new Set(
      completions
        .filter(c => {
          const habit = habits.find(h => h.id === c.habit_id);
          if (!habit) return false;
          
          switch (habit.type) {
            case 'book': return c.data.pages_read > 0;
            case 'running': return c.data.kilometers > 0;
            case 'ai_learning': return c.data.completed;
            case 'job_search': return c.data.applied_for_job || c.data.sought_reference || c.data.updated_cv;
            case 'swimming': return c.data.hours > 0;
            case 'weight': return c.data.weight_kg > 0 || c.data.minutes > 0;
            case 'exercise': return c.data.minutes > 0;
            case 'instagram': return c.data.followers > 0;
            default: return false;
          }
        })
        .map(c => c.date)
    );

    const sortedDates = Array.from(completionDates).sort().reverse();
    
    let streak = 0;
    let expectedDate = new Date();
    
    for (const dateStr of sortedDates) {
      const date = new Date(dateStr);
      const daysDiff = Math.floor((expectedDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === streak) {
        streak++;
        expectedDate.setDate(expectedDate.getDate() - 1);
      } else if (daysDiff > streak) {
        break;
      }
    }
    
    return streak;
  };

  const calculateWeeklyUpdates = (habit: any, completions: any[]): { currentWeek: number; lastWeek: number } => {
    const habitCompletions = completions.filter(c => c.habit_id === habit.id);
    
    if (habitCompletions.length === 0) return { currentWeek: 0, lastWeek: 0 };

    const now = new Date();
    const currentSunday = new Date(now);
    currentSunday.setDate(now.getDate() - now.getDay()); // This week's Sunday
    currentSunday.setHours(0, 0, 0, 0);
    
    const lastSunday = new Date(currentSunday);
    lastSunday.setDate(currentSunday.getDate() - 7); // Last week's Sunday

    const currentWeekEnd = new Date(currentSunday);
    currentWeekEnd.setDate(currentSunday.getDate() + 6); // This week's Saturday

    const lastWeekEnd = new Date(lastSunday);
    lastWeekEnd.setDate(lastSunday.getDate() + 6); // Last week's Saturday

    const currentWeekCompletions = habitCompletions.filter(c => {
      const date = new Date(c.date);
      return date >= currentSunday && date <= currentWeekEnd;
    });

    const lastWeekCompletions = habitCompletions.filter(c => {
      const date = new Date(c.date);
      return date >= lastSunday && date <= lastWeekEnd;
    });

    // Count actual updates (days with activity)
    const currentWeekUpdates = currentWeekCompletions.filter(c => {
      switch (habit.type) {
        case 'book': return c.data.pages_read > 0;
        case 'running': return c.data.kilometers > 0;
        case 'ai_learning': return c.data.completed;
        case 'job_search': return c.data.applied_for_job || c.data.sought_reference || c.data.updated_cv;
        case 'swimming': return c.data.hours > 0;
        case 'weight': return c.data.weight_kg > 0 || c.data.minutes > 0;
        case 'exercise': return c.data.minutes > 0;
        case 'instagram': return c.data.followers > 0;
        default: return false;
      }
    }).length;

    const lastWeekUpdates = lastWeekCompletions.filter(c => {
      switch (habit.type) {
        case 'book': return c.data.pages_read > 0;
        case 'running': return c.data.kilometers > 0;
        case 'ai_learning': return c.data.completed;
        case 'job_search': return c.data.applied_for_job || c.data.sought_reference || c.data.updated_cv;
        case 'swimming': return c.data.hours > 0;
        case 'weight': return c.data.weight_kg > 0 || c.data.minutes > 0;
        case 'exercise': return c.data.minutes > 0;
        case 'instagram': return c.data.followers > 0;
        default: return false;
      }
    }).length;

    return { currentWeek: currentWeekUpdates, lastWeek: lastWeekUpdates };
  };

  const calculateProgressPercentage = (habit: any, completions: any[]): { percentage: number; currentProgress: number; targetValue: number; unit: string } => {
    const habitCompletions = completions.filter(c => c.habit_id === habit.id);
    
    if (habitCompletions.length === 0) {
      const targetMatch = habit.target?.match(/(\d+)/);
      const defaultTarget = targetMatch ? parseInt(targetMatch[1]) : getDefaultTarget(habit.type);
      return { percentage: 0, currentProgress: 0, targetValue: defaultTarget, unit: getHabitUnit(habit.type) };
    }

    let currentProgress = 0;
    // Only calculate progress if user has set a target
    if (!habit.target) {
      return null;
    }
    
    const targetMatch = habit.target?.match(/(\d+)/);
    const targetValue = parseInt(targetMatch[1]);
    const unit = getHabitUnit(habit.type);
    
    switch (habit.type) {
      case 'book':
        // For books, count completed books toward the target
        const userProgress = userSummaries.find(us => us.habits.some(h => h.id === habit.id));
        if (userProgress) {
          const completedBooks = books.filter(book => 
            book.user_name === userProgress.user.name &&
            book.completion_percentage >= 100
          ).length;
          currentProgress = completedBooks;
        }
        break;
      case 'running':
        currentProgress = habitCompletions.reduce((sum, c) => sum + (c.data.kilometers || 0), 0);
        break;
      case 'ai_learning':
        currentProgress = habitCompletions.filter(c => c.data.completed).length;
        break;
      case 'job_search':
        currentProgress = habitCompletions.reduce((sum, c) => {
          return sum + (c.data.applied_for_job ? 1 : 0) + 
                      (c.data.sought_reference ? 1 : 0) + 
                      (c.data.updated_cv ? 1 : 0);
        }, 0);
        break;
      case 'swimming':
        currentProgress = habitCompletions.reduce((sum, c) => sum + (c.data.hours || 0), 0);
        break;
      case 'weight':
      case 'exercise':
        currentProgress = habitCompletions.reduce((sum, c) => sum + (c.data.minutes || 0), 0);
        break;
      case 'instagram':
        const instagramData = habitCompletions
          .filter(c => c.data.followers > 0)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (instagramData.length > 0) {
          currentProgress = instagramData[0].data.followers;
        }
        break;
    }

    const startDate = new Date('2025-08-01');
    const endDate = new Date('2026-07-31');
    const currentDate = new Date();
    
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (elapsedDays <= 0) return { percentage: 50, currentProgress, targetValue: 1000, unit };

    const expectedProgress = (currentProgress / elapsedDays) * totalDays;
    const percentage = Math.min(100, Math.max(0, (expectedProgress / targetValue) * 100));
    
    return { percentage, currentProgress, targetValue, unit };
  };

  const getDefaultTarget = (habitType: string): number => {
    switch (habitType) {
      case 'book': return 12;
      case 'running': return 1000;
      case 'ai_learning': return 365;
      case 'job_search': return 100;
      case 'swimming': return 100;
      case 'weight': return 10000;
      case 'exercise': return 10000;
      case 'instagram': return 1000;
      default: return 100;
    }
  };

  const getHabitUnit = (habitType: string): string => {
    switch (habitType) {
      case 'book': return 'books completed';
      case 'running': return 'km';
      case 'ai_learning': return 'topics';
      case 'job_search': return 'activities';
      case 'swimming': return 'hours';
      case 'weight': return 'minutes';
      case 'exercise': return 'minutes';
      case 'instagram': return 'followers';
      default: return 'units';
    }
  };

  const getHabitDescription = (habitType: string): string => {
    switch (habitType) {
      case 'book': return 'Only completed books (100%) count toward your annual target';
      case 'running': return 'Total kilometers covered across all running sessions';
      case 'ai_learning': return 'Number of AI topics successfully completed';
      case 'job_search': return 'Total job applications, references sought, and CV updates';
      case 'swimming': return 'Total hours spent swimming';
      case 'weight': return 'Total exercise minutes logged (weight tracking days)';
      case 'exercise': return 'Total workout minutes across all exercise sessions';
      case 'instagram': return 'Current follower count (latest update)';
      default: return 'Progress toward your annual goal';
    }
  };

  const getUpdateIcon = (currentWeek: number, lastWeek: number) => {
    if (currentWeek > lastWeek) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (currentWeek < lastWeek) return <Clock className="w-4 h-4 text-red-500" />;
    return <Award className="w-4 h-4 text-blue-500" />;
  };

  const showProgressDetails = (habit: any, completions: any[]) => {
    const habitCompletions = completions.filter(c => c.habit_id === habit.id);
    const weeklyUpdates = calculateWeeklyUpdates(habit, completions);
    const progressData = calculateProgressPercentage(habit, completions);
    
    setSelectedHabitProgress({
      habit,
      currentWeekUpdates: weeklyUpdates.currentWeek,
      lastWeekUpdates: weeklyUpdates.lastWeek,
      progressPercentage: progressData.percentage,
      currentProgress: progressData.currentProgress,
      targetValue: progressData.targetValue,
      unit: progressData.unit
    });
    setShowProgressModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 text-center">
        <div className="text-red-500 mb-2">
          <Target className="w-10 h-10 mx-auto" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-2">Failed to Load Summary</h3>
        <p className="text-sm text-gray-600 mb-4">{error}</p>
        <button 
          onClick={() => loadAllUserSummaries()} 
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Details Modal */}
      {showProgressModal && selectedHabitProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Progress Calculation</h3>
              <button
                onClick={() => setShowProgressModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">{selectedHabitProgress.habit.name}</h4>
                <div className="space-y-1 text-gray-600">
                  <p><strong>Habit Type:</strong> {selectedHabitProgress.habit.type.replace('_', ' ')}</p>
                  <p><strong>Annual Target:</strong> {selectedHabitProgress.targetValue} {selectedHabitProgress.unit}</p>
                  <p><strong>Current Week Updates:</strong> {selectedHabitProgress.currentWeekUpdates} days</p>
                  <p><strong>Last Week Updates:</strong> {selectedHabitProgress.lastWeekUpdates} days</p>
                  <p><strong>Progress:</strong> {selectedHabitProgress.currentProgress} {selectedHabitProgress.unit}</p>
                  <p><strong>Progress Percentage:</strong> {selectedHabitProgress.progressPercentage.toFixed(1)}%</p>
                </div>
              </div>
              
              <div className="text-xs text-gray-500 space-y-1">
                <p><strong>How it's calculated:</strong></p>
                <p>• {getHabitDescription(selectedHabitProgress.habit.type)}</p>
                <p>• Weekly updates: Days with logged activity (Sunday-Saturday)</p>
                <p>• Progress %: (Projected Annual Progress / Target) × 100</p>
                <p>• Days elapsed since Aug 1, 2025: {Math.floor((new Date().getTime() - new Date('2025-08-01').getTime()) / (1000 * 60 * 60 * 24))}</p>
                <p>• Target: {selectedHabitProgress.habit.target}</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowProgressModal(false)}
              className="w-full mt-4 py-2 px-4 bg-gradient-to-r from-green-600 to-olive-600 text-white rounded-lg hover:from-green-700 hover:to-olive-700 transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Books Progress Section */}
      {books.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
              <Book className="w-5 h-5 text-blue-600" />
              <span>Book Progress</span>
            </h2>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {books.map((book) => (
              <div key={book.id} className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{book.title}</h3>
                    <p className="text-xs text-gray-600">{book.user_name}</p>
                  </div>
                  <div className="text-right ml-2">
                    <div className="text-lg font-bold text-blue-600">{Math.round(book.completion_percentage)}%</div>
                    <div className="text-xs text-gray-500">
                      {book.current_pages}/{book.total_pages} pages
                    </div>
                  </div>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      book.completion_percentage >= 100 ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(100, book.completion_percentage)}%` }}
                  />
                </div>
                
                {book.finished_date && (
                  <div className="mt-2 text-xs text-green-600 font-medium">
                    ✅ Completed on {new Date(book.finished_date).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress Overview */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Progress Overview</h2>
          <Calendar className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {userSummaries.map((summary, index) => {
            const totalActivity = Object.values(summary.totalLogged).reduce((sum, val) => sum + val, 0);
            const isCurrentUser = summary.user.id === currentUser.id;
            
            return (
              <div 
                key={summary.user.id} 
                className={`p-4 rounded-xl transition-all ${
                  index === 0 
                    ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 shadow-xl border-2 border-yellow-300'
                    : index === 1
                    ? 'bg-gradient-to-br from-gray-50 to-gray-100 shadow-lg border-2 border-gray-300'
                    : index === 2
                    ? 'bg-gradient-to-br from-green-50 to-olive-100 shadow-lg border-2 border-green-300'
                    : isCurrentUser 
                    ? 'bg-blue-50 shadow-md border-2 border-blue-300' 
                    : 'bg-white hover:shadow-md shadow-sm border border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                      index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-600' :
                      index === 2 ? 'bg-gradient-to-br from-green-400 to-olive-600' :
                      'bg-gradient-to-br from-blue-500 to-green-600'
                    }`}>
                      {index < 3 ? (index + 1) : summary.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 flex items-center space-x-2">
                        <span>{summary.user.name}</span>
                        {isCurrentUser && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                            You
                          </span>
                        )}
                        {index === 0 && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                            🏆 Leader
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {summary.habits.length} habits • Total: {totalActivity} points
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center p-2 rounded-lg bg-gray-50">
                    <div className="text-lg font-bold text-blue-600">{summary.totalLogged.pages}</div>
                    <div className="text-xs text-gray-600">Pages</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-gray-50">
                    <div className="text-lg font-bold text-green-600">{summary.totalLogged.kilometers}</div>
                    <div className="text-xs text-gray-600">Kilometers</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-gray-50">
                    <div className="text-lg font-bold text-olive-600">{summary.totalLogged.minutes}</div>
                    <div className="text-xs text-gray-600">Minutes</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="text-center p-2 rounded-lg bg-gray-50">
                    <div className="text-lg font-bold text-green-600">{summary.weeklyTotal}</div>
                    <div className="text-xs text-gray-600">This Week</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-gray-50">
                    <div className="text-lg font-bold text-olive-600">{summary.monthlyTotal}</div>
                    <div className="text-xs text-gray-600">This Month</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-900 uppercase tracking-wide">Individual Habit Progress</h4>
                  {summary.habits.length > 0 ? (
                    summary.habits.map((habit) => {
                      const userCompletions = [];
                      summary.habits.forEach(h => {
                        if (h.user_id === summary.user.id) {
                          const completions = userSummaries.find(us => us.user.id === summary.user.id);
                          if (completions) {
                            userCompletions.push(...(completions as any).completions || []);
                          }
                        }
                      });
                      
                      const weeklyUpdates = calculateWeeklyUpdates(habit, userCompletions);
                      const progressData = calculateProgressPercentage(habit, userCompletions);
                      
                      return (
                        <div key={habit.id} className="p-2 bg-gray-50 rounded-lg flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: habit.color }}
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-900">{habit.name}</span>
                              <div className="flex items-center space-x-2 text-xs text-gray-500">
                                {getUpdateIcon(weeklyUpdates.currentWeek, weeklyUpdates.lastWeek)}
                                <span>{weeklyUpdates.currentWeek} this week</span>
                              </div>
                            </div>
                          </div>
                          {progressData ? (
                            <button
                              onClick={() => showProgressDetails(habit, userCompletions)}
                              className="flex items-center space-x-1 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
                              title={`Click to see how ${habit.name} progress is calculated`}
                            >
                              <div 
                                className="w-12 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white shadow-sm"
                                style={{
                                  background: progressData.percentage < 50 ? 
                                    `linear-gradient(90deg, rgb(239, 68, 68) ${100-progressData.percentage}%, rgb(34, 197, 94) ${progressData.percentage}%)` : 
                                    `linear-gradient(90deg, rgb(239, 68, 68) ${100-progressData.percentage}%, rgb(34, 197, 94) ${progressData.percentage}%)`
                                }}
                              >
                                {Math.round(progressData.percentage)}%
                              </div>
                              <Info className="w-3 h-3 text-gray-400" />
                            </button>
                          ) : (
                            <div className="flex items-center space-x-1 px-2 py-1">
                              <div className="w-12 h-6 rounded-md flex items-center justify-center text-xs font-medium text-gray-500 bg-gray-100 shadow-sm">
                                N/A
                              </div>
                              <div className="w-3 h-3" /> {/* Spacer for alignment */}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-gray-400 italic text-center py-2">
                      No habits set up yet
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {userSummaries.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 text-center">
          <User className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900 mb-2">No Progress Data</h3>
          <p className="text-sm text-gray-600">Start by setting up habits to track your progress!</p>
        </div>
      )}
    </div>
  );
};

export default SummaryView;