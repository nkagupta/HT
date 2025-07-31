import React, { useState, useEffect } from 'react';
import { User, Calendar, TrendingUp, Award, Clock, Target, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User as UserType, UserProgress } from '../utils/types';

interface SummaryViewProps {
  currentUser: UserType;
  dataRefreshKey?: number;
}

const SummaryView: React.FC<SummaryViewProps> = ({ currentUser, dataRefreshKey = 0 }) => {
  const [userSummaries, setUserSummaries] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAllUserSummaries();
  }, [currentUser.id, dataRefreshKey]);

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

        const currentStreak = calculateStreak(userCompletions, userHabits);
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

  const calculateStreak = (completions: any[], habits: any[]): number => {
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

  const calculateLikelihood = (habit: any, completions: any[]): number => {
    const habitCompletions = completions.filter(c => c.habit_id === habit.id);
    
    if (habitCompletions.length === 0) return 0;

    // Calculate current progress
    let currentProgress = 0;
    
    switch (habit.type) {
      case 'book':
        currentProgress = habitCompletions.reduce((sum, c) => sum + (c.data.pages_read || 0), 0);
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

    // Calculate days since August 1, 2025
    const startDate = new Date('2025-08-01');
    const endDate = new Date('2026-07-31');
    const currentDate = new Date();
    
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (elapsedDays <= 0) return 50; // Before start date
    
    // Simple linear projection
    const expectedProgress = (currentProgress / elapsedDays) * totalDays;
    
    // Extract target from habit.target string and compare
    const targetMatch = habit.target?.match(/(\d+)/);
    const targetValue = targetMatch ? parseInt(targetMatch[1]) : 1000; // Default fallback
    
    const likelihood = Math.min(100, Math.max(0, (expectedProgress / targetValue) * 100));
    
    return likelihood;
  };

  const getStreakIcon = (streak: number) => {
    if (streak >= 7) return <Award className="w-5 h-5 text-yellow-500" />;
    if (streak >= 3) return <TrendingUp className="w-5 h-5 text-green-500" />;
    return <Clock className="w-5 h-5 text-gray-400" />;
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
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 text-center">
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
      <div className="bg-white rounded-xl shadow-sm p-4 border-2 border-black">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Progress Overview</h2>
          <Calendar className="w-5 h-5 text-gray-400" />
        </div>
        
        {/* Current Streaks Section - Moved from Charts */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Current Streaks</span>
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {userSummaries.map((summary) => (
              <div key={summary.user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-olive-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {summary.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{summary.user.name}</div>
                    <div className="text-xs text-gray-500">{summary.habits.length} habits</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-1">
                    {getStreakIcon(summary.currentStreak)}
                    <span className="text-lg font-bold text-gray-900">{summary.currentStreak}</span>
                  </div>
                  <div className="text-xs text-gray-500">day streak</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {userSummaries.map((summary, index) => {
            const totalActivity = Object.values(summary.totalLogged).reduce((sum, val) => sum + val, 0);
            const isCurrentUser = summary.user.id === currentUser.id;
            
            return (
              <div 
                key={summary.user.id} 
                className={`p-4 rounded-xl border-2 transition-all ${
                  index === 0 
                    ? 'border-black bg-gradient-to-br from-yellow-50 to-yellow-100 shadow-xl'
                    : index === 1
                    ? 'border-black bg-gradient-to-br from-gray-50 to-gray-100 shadow-lg'
                    : index === 2
                    ? 'border-black bg-gradient-to-br from-green-50 to-olive-100 shadow-lg'
                    : isCurrentUser 
                    ? 'border-blue-600 bg-blue-50 shadow-md border-2' 
                    : 'border-black bg-white hover:border-gray-600 shadow-sm'
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
                  <div className="text-center p-2 rounded-lg bg-gray-50 border border-black">
                    <div className="text-lg font-bold text-blue-600">{summary.totalLogged.pages}</div>
                    <div className="text-xs text-gray-600">Pages</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-gray-50 border border-black">
                    <div className="text-lg font-bold text-green-600">{summary.totalLogged.kilometers}</div>
                    <div className="text-xs text-gray-600">Kilometers</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-gray-50 border border-black">
                    <div className="text-lg font-bold text-olive-600">{summary.totalLogged.minutes}</div>
                    <div className="text-xs text-gray-600">Minutes</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="text-center p-2 rounded-lg bg-gray-50 border border-black">
                    <div className="text-lg font-bold text-green-600">{summary.weeklyTotal}</div>
                    <div className="text-xs text-gray-600">This Week</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-gray-50 border border-black">
                    <div className="text-lg font-bold text-olive-600">{summary.monthlyTotal}</div>
                    <div className="text-xs text-gray-600">This Month</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-900 uppercase tracking-wide">Habit Progress</h4>
                  {summary.habits.length > 0 ? (
                    summary.habits.map((habit) => {
                      const likelihood = calculateLikelihood(habit, (summary as any).allCompletions || []);
                      
                      return (
                        <div key={habit.id} className="p-2 bg-gray-50 rounded-lg flex items-center justify-between border border-black">
                          <div className="flex items-center space-x-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: habit.color }}
                            />
                            <span className="text-sm font-medium text-gray-900">{habit.name}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {habit.target && `Target: ${habit.target}`}
                          </div>
                          
                          <div 
                            className="w-12 h-8 rounded-md flex items-center justify-center text-xs font-bold text-white shadow-sm border border-black"
                            style={{
                              background: likelihood < 50 ? 
                                `linear-gradient(90deg, rgb(239, 68, 68) ${100-likelihood}%, rgb(34, 197, 94) ${likelihood}%)` : 
                                `linear-gradient(90deg, rgb(239, 68, 68) ${100-likelihood}%, rgb(34, 197, 94) ${likelihood}%)`
                            }}
                            title={`${Math.round(likelihood)}% progress toward annual goal`}
                          >
                            {Math.round(likelihood)}%
                          </div>
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
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 text-center">
          <User className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900 mb-2">No Progress Data</h3>
          <p className="text-sm text-gray-600">Start by setting up habits to track your progress!</p>
        </div>
      )}
    </div>
  );
};

export default SummaryView;