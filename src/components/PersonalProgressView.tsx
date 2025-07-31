import React, { useState, useEffect } from 'react';
import { User as UserIcon, TrendingUp, Calendar, Target, Clock, Book, Activity, Zap, Briefcase, Waves, Weight, Camera, Award, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User as UserType, Habit, HabitCompletion } from '../utils/types';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';

interface PersonalProgressViewProps {
  currentUser: UserType;
  dataRefreshKey?: number;
}

interface HabitAnalysis {
  habit: Habit;
  completions: HabitCompletion[];
  weeklyUpdates: { currentWeek: number; lastWeek: number; twoWeeksAgo: number; threeWeeksAgo: number };
  currentStreak: number;
  longestStreak: number;
  totalProgress: number;
  averageWeekly: number;
  trend: 'improving' | 'declining' | 'stable' | 'new';
}

const PersonalProgressView: React.FC<PersonalProgressViewProps> = ({ currentUser, dataRefreshKey = 0 }) => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitAnalyses, setHabitAnalyses] = useState<HabitAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHabit, setSelectedHabit] = useState<HabitAnalysis | null>(null);

  useEffect(() => {
    loadPersonalData();
  }, [currentUser.id, dataRefreshKey]);

  const loadPersonalData = async () => {
    setLoading(true);
    try {
      const [habitsResult, completionsResult] = await Promise.all([
        supabase.from('habits').select('*').eq('user_id', currentUser.id).order('created_at'),
        supabase.from('habit_completions').select('*')
          .eq('user_id', currentUser.id)
          .gte('date', subDays(new Date(), 90).toISOString().split('T')[0])
          .order('date')
      ]);

      if (habitsResult.error) throw habitsResult.error;
      if (completionsResult.error) throw completionsResult.error;

      const userHabits = habitsResult.data || [];
      const userCompletions = completionsResult.data || [];

      setHabits(userHabits);

      const analyses: HabitAnalysis[] = userHabits.map(habit => {
        const habitCompletions = userCompletions.filter(c => c.habit_id === habit.id);
        
        return {
          habit,
          completions: habitCompletions,
          weeklyUpdates: calculateWeeklyUpdates(habit, habitCompletions),
          currentStreak: calculateCurrentStreak(habit, habitCompletions),
          longestStreak: calculateLongestStreak(habit, habitCompletions),
          totalProgress: calculateTotalProgress(habit, habitCompletions), 
          averageWeekly: calculateAverageWeekly(habit, habitCompletions),
          trend: calculateTrend(habit, habitCompletions)
        };
      });

      setHabitAnalyses(analyses);
    } catch (error) {
      console.error('Error loading personal data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateWeeklyUpdates = (habit: Habit, completions: HabitCompletion[]) => {
    const now = new Date();
    const weeks = [];
    
    for (let i = 0; i < 4; i++) {
      const weekStart = startOfWeek(subDays(now, i * 7), { weekStartsOn: 0 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
      
      const weekCompletions = completions.filter(c => {
        const date = new Date(c.date);
        return date >= weekStart && date <= weekEnd;
      });
      
      const updates = weekCompletions.filter(c => isHabitCompleted(habit, c.data)).length;
      weeks.push(updates);
    }
    
    return {
      currentWeek: weeks[0],
      lastWeek: weeks[1], 
      twoWeeksAgo: weeks[2],
      threeWeeksAgo: weeks[3]
    };
  };

  const calculateCurrentStreak = (habit: Habit, completions: HabitCompletion[]): number => {
    const completionDates = completions
      .filter(c => isHabitCompleted(habit, c.data))
      .map(c => c.date)
      .sort()
      .reverse();

    let streak = 0;
    let expectedDate = new Date();
    
    for (const dateStr of completionDates) {
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

  const calculateLongestStreak = (habit: Habit, completions: HabitCompletion[]): number => {
    const completionDates = completions
      .filter(c => isHabitCompleted(habit, c.data))
      .map(c => new Date(c.date))
      .sort((a, b) => a.getTime() - b.getTime());

    let longestStreak = 0;
    let currentStreak = 0;
    
    for (let i = 0; i < completionDates.length; i++) {
      if (i === 0) {
        currentStreak = 1;
      } else {
        const daysDiff = Math.floor((completionDates[i].getTime() - completionDates[i-1].getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff === 1) {
          currentStreak++;
        } else {
          longestStreak = Math.max(longestStreak, currentStreak);
          currentStreak = 1;
        }
      }
    }
    
    return Math.max(longestStreak, currentStreak);
  };

  const calculateTotalProgress = (habit: Habit, completions: HabitCompletion[]): number => {
    let total = 0;
    
    completions.forEach(completion => {
      switch (habit.type) {
        case 'book':
          total += completion.data.pages_read || 0;
          break;
        case 'running':
          total += completion.data.kilometers || 0;
          break;
        case 'ai_learning':
          if (completion.data.completed) total += 1;
          break;
        case 'job_search':
          total += (completion.data.applied_for_job ? 1 : 0) + 
                   (completion.data.sought_reference ? 1 : 0) + 
                   (completion.data.updated_cv ? 1 : 0);
          break;
        case 'swimming':
          total += completion.data.hours || 0;
          break;
        case 'weight':
        case 'exercise':
          total += completion.data.minutes || 0;
          break;
        case 'instagram':
          // For Instagram, we want the latest follower count, not total
          const latestCompletion = completions
            .filter(c => c.data.followers > 0)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          return latestCompletion?.data.followers || 0;
      }
    });
    
    return total;
  };

  const calculateAverageWeekly = (habit: Habit, completions: HabitCompletion[]): number => {
    const weeks = Math.max(1, Math.ceil(completions.length / 7));
    const activeWeeks = completions.filter(c => isHabitCompleted(habit, c.data)).length;
    return Math.round((activeWeeks / weeks) * 10) / 10;
  };

  const calculateTrend = (habit: Habit, completions: HabitCompletion[]): 'improving' | 'declining' | 'stable' | 'new' => {
    const weeklyData = calculateWeeklyUpdates(habit, completions);
    
    if (completions.length < 7) return 'new';
    
    const recent = (weeklyData.currentWeek + weeklyData.lastWeek) / 2;
    const older = (weeklyData.twoWeeksAgo + weeklyData.threeWeeksAgo) / 2;
    
    if (recent > older * 1.2) return 'improving';
    if (recent < older * 0.8) return 'declining'; 
    return 'stable';
  };

  const isHabitCompleted = (habit: Habit, data: any): boolean => {
    switch (habit.type) {
      case 'book': return data.pages_read > 0;
      case 'running': return data.kilometers > 0;
      case 'ai_learning': return data.completed;
      case 'job_search': return data.applied_for_job || data.sought_reference || data.updated_cv;
      case 'swimming': return data.hours > 0;
      case 'weight': return data.weight_kg > 0 || data.minutes > 0;
      case 'exercise': return data.minutes > 0;
      case 'instagram': return data.followers > 0;
      default: return false;
    }
  };

  const getHabitIcon = (habitType: string) => {
    switch (habitType) {
      case 'book': return <Book className="w-5 h-5" />;
      case 'running': return <Activity className="w-5 h-5" />;
      case 'ai_learning': return <Zap className="w-5 h-5" />;
      case 'job_search': return <Briefcase className="w-5 h-5" />;
      case 'swimming': return <Waves className="w-5 h-5" />;
      case 'weight': return <Weight className="w-5 h-5" />;
      case 'exercise': return <Activity className="w-5 h-5" />;
      case 'instagram': return <Camera className="w-5 h-5" />;
      default: return <Target className="w-5 h-5" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'declining': return <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />;
      case 'stable': return <TrendingUp className="w-4 h-4 text-blue-500 rotate-90" />;
      case 'new': return <Zap className="w-4 h-4 text-purple-500" />;
      default: return <TrendingUp className="w-4 h-4 text-gray-500" />;
    }
  };

  const getHabitUnit = (habitType: string): string => {
    switch (habitType) {
      case 'book': return 'pages';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (habits.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 text-center">
        <UserIcon className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-gray-900 mb-2">No Personal Data</h3>
        <p className="text-sm text-gray-600">Start by adding habits in Settings to see your personal progress analysis!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Personal Overview */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
            <UserIcon className="w-6 h-6 text-blue-600" />
            <span>Personal Progress</span>
          </h2>
          <Calendar className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-white rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-blue-600">{habits.length}</div>
            <div className="text-xs text-gray-600">Active Habits</div>
          </div>
          
          <div className="text-center p-3 bg-white rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-green-600">
              {Math.max(...habitAnalyses.map(h => h.currentStreak), 0)}
            </div>
            <div className="text-xs text-gray-600">Best Streak</div>
          </div>
          
          <div className="text-center p-3 bg-white rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-purple-600">
              {habitAnalyses.filter(h => h.trend === 'improving').length}
            </div>
            <div className="text-xs text-gray-600">Improving</div>
          </div>
          
          <div className="text-center p-3 bg-white rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-orange-600">
              {Math.round(habitAnalyses.reduce((sum, h) => sum + h.averageWeekly, 0) / habits.length * 10) / 10}
            </div>
            <div className="text-xs text-gray-600">Avg Weekly</div>
          </div>
        </div>
      </div>

      {/* Habit Analysis Cards */}
      <div className="space-y-3">
        {habitAnalyses.map((analysis) => (
          <div key={analysis.habit.id} className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                  style={{ backgroundColor: analysis.habit.color }}
                >
                  {getHabitIcon(analysis.habit.type)}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{analysis.habit.name}</h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <span className="capitalize">{analysis.habit.type.replace('_', ' ')}</span>
                    {getTrendIcon(analysis.trend)}
                    <span className="capitalize">{analysis.trend}</span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => setSelectedHabit(selectedHabit?.habit.id === analysis.habit.id ? null : analysis)}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <BarChart3 className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-3">
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-blue-600">{analysis.currentStreak}</div>
                <div className="text-xs text-gray-600">Current Streak</div>
              </div>
              
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-green-600">{analysis.longestStreak}</div>
                <div className="text-xs text-gray-600">Best Streak</div>
              </div>
              
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-purple-600">{analysis.totalProgress}</div>
                <div className="text-xs text-gray-600">{getHabitUnit(analysis.habit.type)}</div>
              </div>
              
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-orange-600">{analysis.averageWeekly}</div>
                <div className="text-xs text-gray-600">Avg/Week</div>
              </div>
            </div>

            {/* Weekly Updates */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900">Weekly Activity (Days)</h4>
              <div className="grid grid-cols-4 gap-2">
                <div className="flex flex-col items-center space-y-1">
                  <div className="text-lg font-bold text-green-600">{analysis.weeklyUpdates.currentWeek}</div>
                  <div className="text-xs text-gray-500">This Week</div>
                </div>
                <div className="flex flex-col items-center space-y-1">
                  <div className="text-lg font-bold text-blue-600">{analysis.weeklyUpdates.lastWeek}</div>
                  <div className="text-xs text-gray-500">Last Week</div>
                </div>
                <div className="flex flex-col items-center space-y-1">
                  <div className="text-lg font-bold text-gray-600">{analysis.weeklyUpdates.twoWeeksAgo}</div>
                  <div className="text-xs text-gray-500">2 Weeks Ago</div>
                </div>
                <div className="flex flex-col items-center space-y-1">
                  <div className="text-lg font-bold text-gray-600">{analysis.weeklyUpdates.threeWeeksAgo}</div>
                  <div className="text-xs text-gray-500">3 Weeks Ago</div>
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {selectedHabit?.habit.id === analysis.habit.id && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="space-y-3">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <h5 className="font-medium text-blue-900 mb-2">Performance Insights</h5>
                    <div className="text-sm text-blue-800">
                      {analysis.trend === 'improving' && "📈 Your consistency is improving! Keep up the great work."}
                      {analysis.trend === 'declining' && "📉 Your activity has decreased recently. Consider setting smaller goals to build momentum."}
                      {analysis.trend === 'stable' && "📊 You're maintaining consistent progress. Consider pushing for improvement!"}
                      {analysis.trend === 'new' && "🌟 You're just getting started! Focus on building a daily routine."}
                    </div>
                  </div>

                  {analysis.habit.target && (
                    <div className="bg-green-50 p-3 rounded-lg">
                      <h5 className="font-medium text-green-900 mb-2">Annual Target Progress</h5>
                      <div className="text-sm text-green-800">
                        Target: {analysis.habit.target}
                        <br />
                        Current Progress: {analysis.totalProgress} {getHabitUnit(analysis.habit.type)}
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <h5 className="font-medium text-purple-900 mb-2">Recent Activity</h5>
                    <div className="text-sm text-purple-800">
                      Last 30 days: {analysis.completions.filter(c => isHabitCompleted(analysis.habit, c.data)).length} active days
                      <br />
                      Total logged entries: {analysis.completions.length}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PersonalProgressView;