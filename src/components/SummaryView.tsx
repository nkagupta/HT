import React, { useState, useEffect } from 'react';
import { User, Calendar, TrendingUp, Award, Clock, Target, LineChart, List } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User as UserType, Habit, HabitCompletion } from '../utils/types';

interface SummaryViewProps {
  currentUser: UserType;
}

interface HabitMonthlySummary {
  habit: Habit;
  monthlyTotal: number;
  unit: string;
}

interface UserSummary {
  user: UserType;
  habits: Habit[];
  habitMonthlySummaries: HabitMonthlySummary[];
  totalCompletions: number;
  weeklyCompletions: number;
  recentStreak: number;
  currentStreak: number;
}

const SummaryView: React.FC<SummaryViewProps> = ({ currentUser }) => {
  const [userSummaries, setUserSummaries] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Default targets for each user
  const defaultTargets: { [key: string]: { [habitName: string]: string } } = {
    'Anuj Nawal': {
      'Read 6 Books': '6 books/year',
      'Gym 12 Times/Month': '12 sessions/month', 
      'Learn AI': '8 topics/month'
    },
    'Suraj Rarath': {
      'Half Marathon Training': '100 km/month',
      'Swimming Practice': '20 hours/month',
      'Read 6 Books': '6 books/year'
    },
    'Krishna Amar': {
      'Run 500km/Year': '42 km/month',
      'Read 10 Books': '10 books/year',
      'Weight Loss (10kg)': '75 kg target'
    },
    'Ritwik Garg': {
      'Job Search': '20 activities/month',
      'Read 10 Books': '10 books/year',
      'Weight Loss (10kg)': '75 kg target',
      'Learn AI': '8 topics/month',
      'Instagram Growth': '5000 followers'
    }
  };

  useEffect(() => {
    loadAllUserSummaries();
  }, []);

  const getCurrentMonthRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0]
    };
  };

  const getDefaultTarget = (userName: string, habitName: string): string | null => {
    const userTargets = defaultTargets[userName] || defaultTargets[userName.split(' ')[0]];
    if (!userTargets) return null;
    
    // Try exact match first
    if (userTargets[habitName]) return userTargets[habitName];
    
    // Try partial match
    const targetKey = Object.keys(userTargets).find(key => 
      habitName.toLowerCase().includes(key.toLowerCase()) || 
      key.toLowerCase().includes(habitName.toLowerCase())
    );
    
    return targetKey ? userTargets[targetKey] : null;
  };

  const calculateHabitMonthlyTotal = (habit: Habit, completions: HabitCompletion[]): HabitMonthlySummary => {
    const monthRange = getCurrentMonthRange();
    const monthlyCompletions = completions.filter(c => 
      c.habit_id === habit.id && 
      c.date >= monthRange.start && 
      c.date <= monthRange.end
    );

    let total = 0;
    let unit = '';

    switch (habit.type) {
      case 'book':
        total = monthlyCompletions.reduce((sum, c) => sum + (c.data.pages_read || 0), 0);
        unit = 'pages';
        break;
      case 'running':
        total = monthlyCompletions.reduce((sum, c) => sum + (c.data.kilometers || 0), 0);
        unit = 'km';
        break;
      case 'ai_learning':
        total = monthlyCompletions.filter(c => c.data.completed).length;
        unit = 'topics';
        break;
      case 'job_search':
        total = monthlyCompletions.reduce((sum, c) => {
          const activities = (c.data.applied_for_job ? 1 : 0) + 
                           (c.data.sought_reference ? 1 : 0) + 
                           (c.data.updated_cv ? 1 : 0);
          return sum + activities;
        }, 0);
        unit = 'activities';
        break;
      case 'swimming':
        total = monthlyCompletions.reduce((sum, c) => sum + (c.data.hours || 0), 0);
        unit = 'hours';
        break;
      case 'weight':
        // For weight, show the latest recorded weight
        const latestWeight = monthlyCompletions
          .filter(c => c.data.weight_kg > 0 || c.data.minutes > 0)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        if (latestWeight) {
          // Show weight if available, otherwise show total exercise minutes
          if (latestWeight.data.weight_kg > 0) {
            total = latestWeight.data.weight_kg;
            unit = 'kg (latest)';
          } else {
            total = monthlyCompletions.reduce((sum, c) => sum + (c.data.minutes || 0), 0);
            unit = 'exercise min';
          }
        }
        break;
      case 'exercise':
        total = monthlyCompletions.reduce((sum, c) => sum + (c.data.minutes || 0), 0);
        unit = 'minutes';
        break;
      case 'instagram':
        // Calculate monthly gain (difference between latest and earliest follower count)
        const instagramCompletions = monthlyCompletions
          .filter(c => c.data.followers > 0)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        if (instagramCompletions.length > 1) {
          const earliest = instagramCompletions[0].data.followers;
          const latest = instagramCompletions[instagramCompletions.length - 1].data.followers;
          total = latest - earliest;
        } else if (instagramCompletions.length === 1) {
          total = 0; // No gain if only one entry
        }
        unit = 'followers gained';
        break;
    }

    return {
      habit,
      monthlyTotal: Math.round(total * 10) / 10, // Round to 1 decimal place
      unit
    };
  };

  const loadAllUserSummaries = async () => {
    try {
      // Get all registered users from database
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('name');

      if (usersError) throw usersError;

      const allUsers = users || [];
      const summaries: UserSummary[] = [];

      // Process each registered user
      for (const user of allUsers) {
        // Load user's habits
        const { data: habits, error: habitsError } = await supabase
          .from('habits')
          .select('*')
          .eq('user_id', user.id);

        if (habitsError) throw habitsError;

        // Get user's completions for the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data: completions, error: completionsError } = await supabase
          .from('habit_completions')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

        if (completionsError) throw completionsError;

        // Get completions for the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const weeklyCompletions = completions?.filter(c => 
          new Date(c.date) >= sevenDaysAgo
        ) || [];

        // Calculate monthly summaries for each habit
        const habitMonthlySummaries = (habits || []).map(habit => 
          calculateHabitMonthlyTotal(habit, completions || [])
        );

        // Calculate recent streak (meaningful completions per week)
        const recentStreak = weeklyCompletions.filter(c => {
          const data = c.data;
          const habit = habits?.find(h => h.id === c.habit_id);
          if (!habit) return false;
          
          // Count meaningful completions based on actual logged numbers
          switch (habit.type) {
            case 'book': return data.pages_read > 0;
            case 'running': return data.kilometers > 0;
            case 'ai_learning': return data.completed;
            case 'job_search': return data.applied_for_job || data.sought_reference || data.updated_cv;
            case 'swimming': return data.hours > 0;
            case 'weight': return data.weight_kg > 0 || data.minutes > 0;
            case 'exercise': return data.minutes > 0;
            default: return false;
          }
        }).length;

        // Calculate current streak
        const currentStreak = calculateStreak(completions || [], habits || []);

        summaries.push({
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          },
          habits: habits || [],
          habitMonthlySummaries,
          totalCompletions: completions?.length || 0,
          weeklyCompletions: weeklyCompletions.length,
          recentStreak,
          currentStreak
        });
      }

      setUserSummaries(summaries);
    } catch (error) {
      console.error('Error loading user summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStreak = (completions: HabitCompletion[], habits: Habit[]): number => {
    if (completions.length === 0) return 0;

    // Sort completions by date (newest first)
    const sortedCompletions = completions
      .filter(c => {
        const data = c.data;
        const habit = habits.find(h => h.id === c.habit_id);
        if (!habit) return false;
        
        // Check if the completion has meaningful data
        switch (habit.type) {
          case 'book': return data.pages_read > 0;
          case 'running': return data.kilometers > 0;
          case 'ai_learning': return data.completed;
          case 'job_search': return data.applied_for_job || data.sought_reference || data.updated_cv;
          case 'swimming': return data.hours > 0;
          case 'weight': return data.weight_kg > 0;
          case 'exercise': return data.minutes > 0;
          default: return false;
        }
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (sortedCompletions.length === 0) return 0;

    // Group by date and count streak
    const dateSet = new Set(sortedCompletions.map(c => c.date));
    const dates = Array.from(dateSet).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    let streak = 0;
    let currentDate = new Date();
    
    for (const dateStr of dates) {
      const date = new Date(dateStr);
      const daysDiff = Math.floor((currentDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === streak) {
        streak++;
      } else if (daysDiff > streak) {
        break;
      }
    }
    
    return streak;
  };

  const getStreakIcon = (streak: number) => {
    if (streak >= 7) return <Award className="w-5 h-5 text-yellow-500" />;
    if (streak >= 3) return <TrendingUp className="w-5 h-5 text-green-500" />;
    return <Clock className="w-5 h-5 text-gray-400" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* User Summaries */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 mb-4">User Summary</h2>
        
        <div className="grid grid-cols-1 gap-3">
          {userSummaries.map((summary) => (
            <div 
              key={summary.user.id} 
              className={`p-4 rounded-xl border-2 transition-all ${
                summary.user.id === currentUser.id 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br from-blue-500 to-purple-600">
                    {summary.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {summary.user.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      ({summary.habits.length} habits)
                    </p>
                  </div>
                </div>
                {summary.user.id === currentUser.id && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    You
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">{summary.recentStreak}</div>
                  <div className="text-sm text-gray-600">Recent streak (tasks/week)</div>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-center space-x-0.5">
                    {getStreakIcon(summary.currentStreak)}
                    <span className="text-lg font-bold text-gray-900">{summary.currentStreak}</span>
                  </div>
                  <div className="text-sm text-gray-600">Day Streak</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900">All Habits - This Month</h4>
                {summary.habitMonthlySummaries.length > 0 ? (
                  summary.habitMonthlySummaries.map((habitSummary) => {
                    const defaultTarget = getDefaultTarget(summary.user.name, habitSummary.habit.name);
                    const habitTarget = habitSummary.habit.target || defaultTarget;
                    return (
                      <div key={habitSummary.habit.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-2 mb-1">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: habitSummary.habit.color }}
                          />
                          <span className="text-sm font-medium text-gray-900">{habitSummary.habit.name}</span>
                          <div className="flex items-center space-x-1 ml-auto">
                            {(['running', 'swimming', 'weight', 'exercise'].includes(habitSummary.habit.type)) && (
                              <button
                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                title="View Graph"
                              >
                                <LineChart className="w-3 h-3" />
                              </button>
                            )}
                            {habitSummary.habit.type === 'book' && (
                              <button
                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                title="View Book List"
                              >
                                <List className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        {habitTarget && (
                          <div className="text-xs text-gray-500 mb-1 ml-5">Target: {habitTarget}</div>
                        )}
                        <div className="text-sm text-blue-600 font-bold ml-5">
                          {habitSummary.monthlyTotal} {habitSummary.unit}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-gray-400 italic text-center py-2">
                    No habits tracked yet
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>This week: {summary.weeklyCompletions} completions</span>
                  <span>Total: {summary.totalCompletions}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {userSummaries.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 text-center">
          <User className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900 mb-2">No Users Found</h3>
          <p className="text-sm text-gray-600">Start by creating user accounts to see summaries here.</p>
        </div>
      )}
    </div>
  );
};

export default SummaryView;