import React, { useState, useEffect } from 'react';
import { User, Calendar, TrendingUp, Award, Clock, Target, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User as UserType, UserProgress } from '../utils/types';

interface SummaryViewProps {
  currentUser: UserType;
}

const SummaryView: React.FC<SummaryViewProps> = ({ currentUser }) => {
  const [userSummaries, setUserSummaries] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAllUserSummaries();
  }, [currentUser.id]);

  const loadAllUserSummaries = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Step 1: Load ALL registered users
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('name');

      if (usersError) {
        throw new Error(`Failed to load users: ${usersError.message}`);
      }

      if (!allUsers || allUsers.length === 0) {
        setUserSummaries([]);
        return;
      }

      // Step 2: Load habits for ALL users
      const { data: allHabits, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .order('created_at');

      if (habitsError) {
        throw new Error(`Failed to load habits: ${habitsError.message}`);
      }

      // Step 3: Load completions for ALL users (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: allCompletions, error: completionsError } = await supabase
        .from('habit_completions')
        .select('*')
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date');

      if (completionsError) {
        throw new Error(`Failed to load completions: ${completionsError.message}`);
      }

      // Step 4: Process summary for each user
      const processedSummaries: UserProgress[] = [];

      for (const user of allUsers) {
        const userHabits = (allHabits || []).filter(h => h.user_id === user.id);
        const userCompletions = (allCompletions || []).filter(c => c.user_id === user.id);

        // Calculate totals for this user across all habits
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
            case 'instagram':
              // Instagram doesn't contribute to main totals in this view
              break;
          }
        });

        // Calculate streak
        const currentStreak = calculateStreak(userCompletions, userHabits);
        
        // Weekly total
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const weeklyTotal = userCompletions.filter(c => 
          new Date(c.date) >= sevenDaysAgo
        ).length;

        processedSummaries.push({
          user: { id: user.id, email: user.email, name: user.name },
          habits: userHabits,
          totalLogged,
          currentStreak,
          weeklyTotal,
          monthlyTotal: userCompletions.length
        });
      }

      // Sort by total activity (most active first)
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

    // Get unique dates with meaningful completions
    const completionDates = new Set(
      completions
        .filter(c => {
          const habit = habits.find(h => h.id === c.habit_id);
          if (!habit) return false;
          
          // Check if completion has meaningful data
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

  const getStreakIcon = (streak: number) => {
    if (streak >= 7) return <Award className="w-5 h-5 text-yellow-500" />;
    if (streak >= 3) return <TrendingUp className="w-5 h-5 text-green-500" />;
    return <Clock className="w-5 h-5 text-gray-400" />;
  };

  const getHabitSummary = (habit: any, completions: any[]): string => {
    const habitCompletions = completions.filter(c => c.habit_id === habit.id);
    
    if (habitCompletions.length === 0) return 'No activity';

    let total = 0;
    let unit = '';

    switch (habit.type) {
      case 'book':
        total = habitCompletions.reduce((sum, c) => sum + (c.data.pages_read || 0), 0);
        unit = 'pages';
        break;
      case 'running':
        total = habitCompletions.reduce((sum, c) => sum + (c.data.kilometers || 0), 0);
        unit = 'km';
        break;
      case 'ai_learning':
        total = habitCompletions.filter(c => c.data.completed).length;
        unit = 'topics';
        break;
      case 'job_search':
        total = habitCompletions.reduce((sum, c) => {
          return sum + (c.data.applied_for_job ? 1 : 0) + 
                      (c.data.sought_reference ? 1 : 0) + 
                      (c.data.updated_cv ? 1 : 0);
        }, 0);
        unit = 'activities';
        break;
      case 'swimming':
        total = habitCompletions.reduce((sum, c) => sum + (c.data.hours || 0), 0);
        unit = 'hours';
        break;
      case 'weight':
        const latestWeight = habitCompletions
          .filter(c => c.data.weight_kg > 0)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        if (latestWeight) {
          return `${latestWeight.data.weight_kg} kg (latest)`;
        }
        total = habitCompletions.reduce((sum, c) => sum + (c.data.minutes || 0), 0);
        unit = 'exercise min';
        break;
      case 'exercise':
        total = habitCompletions.reduce((sum, c) => sum + (c.data.minutes || 0), 0);
        unit = 'minutes';
        break;
      case 'instagram':
        const instagramData = habitCompletions
          .filter(c => c.data.followers > 0)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (instagramData.length > 0) {
          return `${instagramData[0].data.followers} followers`;
        }
        return 'No data';
    }

    return total > 0 ? `${Math.round(total * 10) / 10} ${unit}` : 'No activity';
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
      {/* Friend Competition Summary */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Friend Competition Summary</h2>
          <Calendar className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {userSummaries.map((summary, index) => {
            const totalActivity = Object.values(summary.totalLogged).reduce((sum, val) => sum + val, 0);
            const isCurrentUser = summary.user.id === currentUser.id;
            
            return (
              <div 
                key={summary.user.id} 
                className={`p-4 rounded-xl border-2 transition-all ${
                  isCurrentUser 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                      index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-600' :
                      index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                      'bg-gradient-to-br from-blue-500 to-purple-600'
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

                {/* Competition Stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold text-blue-600">{summary.totalLogged.pages}</div>
                    <div className="text-xs text-gray-600">Pages</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold text-green-600">{summary.totalLogged.kilometers}</div>
                    <div className="text-xs text-gray-600">Kilometers</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold text-purple-600">{summary.totalLogged.minutes}</div>
                    <div className="text-xs text-gray-600">Minutes</div>
                  </div>
                </div>

                {/* Streak and Weekly Info */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center space-x-1">
                      {getStreakIcon(summary.currentStreak)}
                      <span className="text-lg font-bold text-gray-900">{summary.currentStreak}</span>
                    </div>
                    <div className="text-xs text-gray-600">Day Streak</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold text-orange-600">{summary.weeklyTotal}</div>
                    <div className="text-xs text-gray-600">This Week</div>
                  </div>
                </div>

                {/* Individual Habits */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-900 uppercase tracking-wide">Individual Habits</h4>
                  {summary.habits.length > 0 ? (
                    summary.habits.map((habit) => {
                      const userCompletions = []; // We'd need to pass this data down or refetch
                      return (
                        <div key={habit.id} className="p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between">
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
          <h3 className="text-base font-semibold text-gray-900 mb-2">No Competition Data</h3>
          <p className="text-sm text-gray-600">Start by setting up habits to compete with friends!</p>
        </div>
      )}

      {/* Competition Insights */}
      {userSummaries.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-3">🏆 Competition Insights</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div>
              📚 Top reader: {userSummaries.sort((a, b) => b.totalLogged.pages - a.totalLogged.pages)[0]?.user.name.split(' ')[0]} with {Math.max(...userSummaries.map(u => u.totalLogged.pages))} pages
            </div>
            <div>
              🏃 Top runner: {userSummaries.sort((a, b) => b.totalLogged.kilometers - a.totalLogged.kilometers)[0]?.user.name.split(' ')[0]} with {Math.max(...userSummaries.map(u => u.totalLogged.kilometers))} km
            </div>
            <div>
              💪 Most active: {userSummaries.sort((a, b) => b.totalLogged.minutes - a.totalLogged.minutes)[0]?.user.name.split(' ')[0]} with {Math.max(...userSummaries.map(u => u.totalLogged.minutes))} minutes
            </div>
            <div>
              🔥 Longest streak: {userSummaries.sort((a, b) => b.currentStreak - a.currentStreak)[0]?.user.name.split(' ')[0]} with {Math.max(...userSummaries.map(u => u.currentStreak))} days
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SummaryView;