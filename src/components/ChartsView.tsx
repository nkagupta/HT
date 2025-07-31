import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Users, BookOpen, Activity, Target, ChevronLeft, ChevronRight, Info, X } from 'lucide-react';
import { BarChart, Bar, LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, eachDayOfInterval, startOfWeek, startOfMonth } from 'date-fns';
import { supabase } from '../lib/supabase';
import { User as UserType, UserProgress, CompetitionMetrics } from '../utils/types';

interface ChartsViewProps {
  currentUser: UserType;
  dataRefreshKey?: number;
}

type TimePeriod = 'week' | 'month';
type ChartType = 'overview' | 'books' | 'exercise' | 'competition';

interface ChartData {
  date: string;
  [key: string]: any;
}

const ChartsView: React.FC<ChartsViewProps> = ({ currentUser, dataRefreshKey = 0 }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month');
  const [selectedChart, setSelectedChart] = useState<ChartType>('overview');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [competitionData, setCompetitionData] = useState<CompetitionMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDisplayDate, setCurrentDisplayDate] = useState(new Date());
  const [showChartInfoModal, setShowChartInfoModal] = useState(false);
  const [chartInfoContent, setChartInfoContent] = useState('');

  const periods = [
    { value: 'week' as TimePeriod, label: 'This Week', days: 7 },
    { value: 'month' as TimePeriod, label: 'This Month', days: 30 }
  ];

  const chartTypes = [
    { value: 'overview' as ChartType, label: 'Daily Progress', icon: TrendingUp },
    { value: 'books' as ChartType, label: 'Reading Progress', icon: BookOpen },
    { value: 'exercise' as ChartType, label: 'Fitness Progress', icon: Activity },
    { value: 'competition' as ChartType, label: 'Competition', icon: Users }
  ];

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'];

  useEffect(() => {
    loadAllData();
  }, [selectedPeriod, selectedChart, currentUser.id, dataRefreshKey, currentDisplayDate]);

  const getDateRange = () => {
    let startDate: Date;
    let endDate: Date;

    switch (selectedPeriod) {
      case 'week':
        startDate = startOfWeek(currentDisplayDate, { weekStartsOn: 0 });
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        break;
      case 'month':
        startDate = startOfMonth(currentDisplayDate);
        endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        break;
      default:
        startDate = startOfMonth(currentDisplayDate);
        endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    }

    return { startDate, endDate };
  };

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { startDate, endDate } = getDateRange();
      
      const [usersResult, habitsResult, completionsResult] = await Promise.all([
        supabase.from('users').select('*').order('name'),
        supabase.from('habits').select('*').order('created_at'),
        supabase.from('habit_completions').select('*')
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0])
          .order('date')
      ]);

      if (usersResult.error) throw usersResult.error;
      if (habitsResult.error) throw habitsResult.error;
      if (completionsResult.error) throw completionsResult.error;

      const allUsers = usersResult.data || [];
      const allHabits = habitsResult.data || [];
      const allCompletions = completionsResult.data || [];

      const processedUserProgress: UserProgress[] = allUsers.map(user => {
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
          completions: userCompletions,
          totalLogged,
          currentStreak,
          weeklyTotal,
          monthlyTotal: userCompletions.length
        };
      });

      const competitionMetrics: CompetitionMetrics[] = [];
      
      processedUserProgress.forEach(userProgress => {
        userProgress.habits.forEach(habit => {
          let value = 0;
          let unit = '';
          
          switch (habit.type) {
            case 'book':
              value = userProgress.totalLogged.pages;
              unit = 'pages';
              break;
            case 'running':
              value = userProgress.totalLogged.kilometers;
              unit = 'km';
              break;
            case 'ai_learning':
              value = userProgress.totalLogged.topics;
              unit = 'topics';
              break;
            case 'job_search':
              value = userProgress.totalLogged.activities;
              unit = 'activities';
              break;
            case 'swimming':
            case 'weight':
            case 'exercise':
              value = userProgress.totalLogged.minutes;
              unit = 'minutes';
              break;
          }

          if (value > 0) {
            competitionMetrics.push({
              userId: userProgress.user.id,
              userName: userProgress.user.name.split(' ')[0],
              habitType: habit.type,
              totalLogged: value,
              unit,
              target: habit.target || undefined
            });
          }
        });
      });

      setUserProgress(processedUserProgress);
      setCompetitionData(competitionMetrics);

      const generatedChartData = generateChartData(processedUserProgress, startDate, endDate);
      setChartData(generatedChartData);

    } catch (error: any) {
      console.error('Error loading chart data:', error);
      setError(error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const calculateUserStreak = (completions: any[], habits: any[]): number => {
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
            default: return false;
          }
        })
        .map(c => c.date)
    );

    const sortedDates = Array.from(completionDates).sort().reverse();
    
    let streak = 0;
    let currentDate = new Date();
    
    for (const dateStr of sortedDates) {
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

  const generateChartData = (userProgressData: UserProgress[], startDate: Date, endDate: Date): ChartData[] => {
    const intervals = eachDayOfInterval({ start: startDate, end: endDate });
    
    return intervals.map(date => {
      const dateKey = date.toISOString().split('T')[0];
      const dataPoint: ChartData = {
        date: selectedPeriod === 'week' ? 
          format(date, 'EEE') + '\n' + format(date, 'MMM dd') : 
          format(date, selectedPeriod === 'month' ? 'MMM dd' : 'MMM dd'),
        dateKey
      };

      userProgressData.forEach((userProgress) => {
        const userName = userProgress.user.name.split(' ')[0];
        
        const dateCompletions = userProgress.completions?.filter(c => c.date === dateKey) || [];
        let dayValue = 0;

        switch (selectedChart) {
          case 'overview':
            dateCompletions.forEach(completion => {
              const habit = userProgress.habits.find(h => h.id === completion.habit_id);
              if (habit) {
                switch (habit.type) {
                  case 'book':
                    dayValue += completion.data.pages_read || 0;
                    break;
                  case 'running':
                    dayValue += completion.data.kilometers || 0;
                    break;
                  case 'ai_learning':
                    dayValue += completion.data.completed ? 1 : 0;
                    break;
                  case 'job_search':
                    dayValue += (completion.data.applied_for_job ? 1 : 0) + 
                               (completion.data.sought_reference ? 1 : 0) + 
                               (completion.data.updated_cv ? 1 : 0);
                    break;
                  case 'swimming':
                    dayValue += (completion.data.hours || 0);
                    break;
                  case 'weight':
                  case 'exercise':
                    dayValue += completion.data.minutes || 0;
                    break;
                }
              }
            });
            dataPoint[userName] = dayValue > 0 ? dayValue : undefined;
            break;

          case 'books':
            dateCompletions.forEach(completion => {
              const habit = userProgress.habits.find(h => h.id === completion.habit_id);
              if (habit && habit.type === 'book') {
                dayValue += completion.data.pages_read || 0;
              }
            });
            dataPoint[userName] = dayValue > 0 ? dayValue : undefined;
            break;

          case 'exercise':
            dateCompletions.forEach(completion => {
              const habit = userProgress.habits.find(h => h.id === completion.habit_id);
              if (habit) {
                if (habit.type === 'running') {
                  dayValue += completion.data.kilometers || 0;
                } else if (habit.type === 'exercise' || habit.type === 'weight' || habit.type === 'swimming') {
                  dayValue += completion.data.minutes || (completion.data.hours || 0) * 60;
                }
              }
            });
            dataPoint[userName] = dayValue > 0 ? dayValue : undefined;
            break;

          case 'competition':
            dateCompletions.forEach(completion => {
              const habit = userProgress.habits.find(h => h.id === completion.habit_id);
              if (habit) {
                switch (habit.type) {
                  case 'book':
                    dayValue += completion.data.pages_read || 0;
                    break;
                  case 'running':
                    dayValue += completion.data.kilometers || 0;
                    break;
                  case 'ai_learning':
                    dayValue += completion.data.completed ? 1 : 0;
                    break;
                  case 'job_search':
                    dayValue += (completion.data.applied_for_job ? 1 : 0) + 
                               (completion.data.sought_reference ? 1 : 0) + 
                               (completion.data.updated_cv ? 1 : 0);
                    break;
                  case 'swimming':
                    dayValue += (completion.data.hours || 0);
                    break;
                  case 'weight':
                  case 'exercise':
                    dayValue += completion.data.minutes || 0;
                    break;
                }
              }
            });
            dataPoint[userName] = dayValue > 0 ? dayValue : undefined;
            break;
        }
      });

      return dataPoint;
    });
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDisplayDate);
    
    switch (selectedPeriod) {
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
    }
    
    setCurrentDisplayDate(newDate);
  };

  const showChartInfo = (chartType: ChartType) => {
    let content = '';
    
    switch (chartType) {
      case 'overview':
        content = `**Daily Progress Overview**

This chart displays daily activity across all habit types, giving you a comprehensive view of everyone's progress.

**How it's calculated:**
• Each data point represents total daily activity
• Books: Pages read that day
• Running: Kilometers covered that day
• AI Learning: Topics completed (1 point each)
• Job Search: Activities completed (applications, references, CV updates)
• Swimming: Hours spent swimming
• Exercise/Weight: Minutes exercised

**Chart features:**
• Each user has a unique colored line
• Points only appear on days with logged activity
• Gaps indicate days without progress
• Compare productivity patterns across users`;
        break;
        
      case 'books':
        content = `**Reading Progress Chart**

Focused view showing daily reading activity for all users with book habits.

**How it's calculated:**
• Only includes data from book-type habits
• Shows pages read per day for each user
• Multiple books can contribute to same day's total
• Tracks consistent reading patterns

**What to look for:**
• Steady lines indicate consistent daily reading
• Gaps show days without reading activity
• High peaks reveal intensive reading sessions
• Compare reading dedication between users`;
        break;
        
      case 'exercise':
        content = `**Fitness Activity Chart**

Combined view of all fitness-related activities including running, exercise, weight training, and swimming.

**How it's calculated:**
• Running: Direct kilometers value
• Exercise: Minutes worked out
• Weight Training: Exercise minutes logged
• Swimming: Hours converted to minutes (×60)
• All values combined into daily fitness totals

**Insights:**
• Shows overall fitness commitment patterns
• Higher values indicate more intense workout days
• Gaps represent rest days or unlogged activities
• Track fitness consistency across users`;
        break;
        
      case 'competition':
        content = `**Competition Leaderboard**

Modern leaderboard showing real-time rankings based on total activity across all habit types.

**Ranking calculation:**
• All habit completions converted to standardized points
• Books: Pages read (higher value activities)
• Running: Kilometers covered
• AI Learning: Topics completed
• Job Search: Activities completed
• Exercise: Minutes exercised
• Swimming: Hours tracked

**Leaderboard features:**
• Live rankings update with each activity
• Shows current week vs previous week performance
• Displays total points and recent activity trends
• Highlights top performers with special styling`;
        break;
    }
    
    setChartInfoContent(content);
    setShowChartInfoModal(true);
  };

  const renderModernCompetition = () => {
    const sortedUsers = userProgress
      .map(user => {
        const totalPoints = Object.values(user.totalLogged).reduce((sum, val) => sum + val, 0);
        const currentWeekPoints = user.weeklyTotal;
        
        // Calculate last week points (rough estimation)
        const lastWeekPoints = Math.max(0, user.monthlyTotal - user.weeklyTotal);
        
        return {
          ...user,
          totalPoints,
          currentWeekPoints,
          lastWeekPoints,
          trend: currentWeekPoints > lastWeekPoints ? 'up' : currentWeekPoints < lastWeekPoints ? 'down' : 'stable'
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Top 3 Podium */}
          {sortedUsers.slice(0, 3).map((user, index) => (
            <div key={user.user.id} className={`relative p-6 rounded-xl text-center ${
              index === 0 ? 'bg-gradient-to-br from-yellow-100 to-yellow-200 transform scale-105' :
              index === 1 ? 'bg-gradient-to-br from-gray-100 to-gray-200' :
              'bg-gradient-to-br from-orange-100 to-orange-200'
            }`}>
              <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                index === 0 ? 'bg-gradient-to-br from-yellow-500 to-yellow-600' :
                index === 1 ? 'bg-gradient-to-br from-gray-500 to-gray-600' :
                'bg-gradient-to-br from-orange-500 to-orange-600'
              }`}>
                {index + 1}
              </div>
              <h3 className="font-bold text-lg text-gray-900 mb-1">{user.user.name}</h3>
              <div className="text-2xl font-bold text-gray-900 mb-2">{user.totalPoints}</div>
              <div className="text-sm text-gray-600">total points</div>
              
              <div className="flex justify-between mt-4 text-xs">
                <div className="text-center">
                  <div className="font-semibold text-green-600">{user.currentWeekPoints}</div>
                  <div className="text-gray-500">This Week</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-blue-600">{user.lastWeekPoints}</div>
                  <div className="text-gray-500">Last Week</div>
                </div>
              </div>
              
              {/* Trophy icon for winner */}
              {index === 0 && (
                <div className="absolute -top-2 -right-2">
                  <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">🏆</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Detailed Rankings */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Complete Rankings</h3>
          <div className="space-y-3">
            {sortedUsers.map((user, index) => {
              const isCurrentUser = user.user.id === currentUser.id;
              
              return (
                <div key={user.user.id} className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                  isCurrentUser ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50 hover:bg-gray-100'
                }`}>
                  <div className="flex items-center space-x-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      index < 3 ? 
                        index === 0 ? 'bg-yellow-500' :
                        index === 1 ? 'bg-gray-500' :
                        'bg-orange-500'
                      : 'bg-blue-500'
                    }`}>
                      {index + 1}
                    </div>
                    
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-gray-900">{user.user.name}</span>
                        {isCurrentUser && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {user.habits.length} active habits
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900">{user.totalPoints}</div>
                    <div className="text-sm text-gray-500">points</div>
                    
                    {/* Trend indicator */}
                    <div className={`text-xs mt-1 ${
                      user.trend === 'up' ? 'text-green-600' :
                      user.trend === 'down' ? 'text-red-600' :
                      'text-gray-500'
                    }`}>
                      {user.trend === 'up' ? '↗ Trending Up' :
                       user.trend === 'down' ? '↘ Trending Down' :
                       '→ Stable'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Performance */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">This Week's Top Performers</h4>
              {sortedUsers
                .sort((a, b) => b.currentWeekPoints - a.currentWeekPoints)
                .slice(0, 3)
                .map((user, index) => (
                  <div key={user.user.id} className="flex items-center justify-between py-2">
                    <span className="text-gray-700">{user.user.name}</span>
                    <span className="font-semibold text-green-600">{user.currentWeekPoints} points</span>
                  </div>
                ))}
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Biggest Improvers</h4>
              {sortedUsers
                .filter(user => user.currentWeekPoints > user.lastWeekPoints)
                .sort((a, b) => (b.currentWeekPoints - b.lastWeekPoints) - (a.currentWeekPoints - a.lastWeekPoints))
                .slice(0, 3)
                .map((user, index) => (
                  <div key={user.user.id} className="flex items-center justify-between py-2">
                    <span className="text-gray-700">{user.user.name}</span>
                    <span className="font-semibold text-blue-600">
                      +{user.currentWeekPoints - user.lastWeekPoints} points
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderChart = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-red-500 mb-2">
            <Target className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Data</h3>
          <p className="text-gray-600 text-sm">{error}</p>
          <button 
            onClick={() => loadAllData()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    const userNames = userProgress.map(up => up.user.name.split(' ')[0]);

    if (selectedChart === 'competition') {
      return renderModernCompetition();
    }

    if (selectedChart === 'overview') {
      return (
        <div className="space-y-6">
          <div>
            <ResponsiveContainer width="100%" height={250}>
              <RechartsLineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  interval={0}
                  angle={selectedPeriod === 'week' ? 0 : -45}
                  textAnchor={selectedPeriod === 'week' ? 'middle' : 'end'}
                  height={selectedPeriod === 'week' ? 60 : 80}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value) => value !== undefined ? [`${value}`, 'Activity Points'] : []} 
                  labelFormatter={(label) => `Date: ${label.replace('\n', ' ')}`}
                />
                <Legend />
                {userProgress.map((up, index) => (
                  <Line
                    key={up.user.name}
                    type="monotone"
                    dataKey={up.user.name.split(' ')[0]}
                    stroke={colors[index % colors.length]}
                    strokeWidth={1.5}
                    dot={{ r: 2 }}
                    connectNulls={false}
                  />
                ))}
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <RechartsLineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            interval={0}
            angle={selectedPeriod === 'week' ? 0 : -45}
            textAnchor={selectedPeriod === 'week' ? 'middle' : 'end'}
            height={selectedPeriod === 'week' ? 60 : 80}
          />
          <YAxis />
          <Tooltip 
            formatter={(value) => value !== undefined ? [`${value}`, getTooltipLabel()] : []} 
            labelFormatter={(label) => `Date: ${label.replace('\n', ' ')}`}
          />
          <Legend />
          {userNames.map((name, index) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={colors[index % colors.length]}
              strokeWidth={1.5}
              dot={{ r: 2 }}
              connectNulls={false}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    );
  };

  const getTooltipLabel = () => {
    switch (selectedChart) {
      case 'books': return 'Pages Read';
      case 'exercise': return 'Exercise Points';
      default: return 'Total Logged';
    }
  };

  const getChartTitle = () => {
    const periodLabel = periods.find(p => p.value === selectedPeriod)?.label || 'This Month';
    
    switch (selectedChart) {
      case 'overview':
        return `Daily Progress Overview - ${periodLabel}`;
      case 'books':
        return `Reading Progress - ${periodLabel}`;
      case 'exercise':
        return `Fitness Progress - ${periodLabel}`;
      case 'competition':
        return `Competition Leaderboard - ${periodLabel}`;
      default:
        return `Progress Chart - ${periodLabel}`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Chart Info Modal */}
      {showChartInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Chart Information</h3>
              <button
                onClick={() => setShowChartInfoModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-gray-600 leading-relaxed whitespace-pre-line text-sm">
              {chartInfoContent}
            </div>
            
            <div className="mt-6">
              <button
                onClick={() => setShowChartInfoModal(false)}
                className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-olive-600 text-white font-medium rounded-lg hover:from-green-700 hover:to-olive-700 transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Analytics Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Analytics Dashboard</h2>
          <div className="flex items-center space-x-1">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-600">{periods.find(p => p.value === selectedPeriod)?.label}</span>
          </div>
        </div>

        {/* Modern Time Period Selector */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            {periods.map(period => (
              <button
                key={period.value}
                onClick={() => setSelectedPeriod(period.value)}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  selectedPeriod === period.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modern Chart Type Selector */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {chartTypes.map(type => {
            const Icon = type.icon;
            return (
              <button
                key={type.value}
                onClick={() => setSelectedChart(type.value)}
                className={`flex flex-col items-center space-y-2 p-4 rounded-xl transition-all ${
                  selectedChart === type.value
                    ? 'bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-blue-200 shadow-md'
                    : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <Icon className={`w-6 h-6 ${
                  selectedChart === type.value ? 'text-blue-600' : 'text-gray-600'
                }`} />
                <span className={`text-sm font-medium ${
                  selectedChart === type.value ? 'text-blue-900' : 'text-gray-700'
                }`}>
                  {type.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modern Chart Container */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold text-gray-900">{getChartTitle()}</h3>
            <button
              onClick={() => showChartInfo(selectedChart)}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              title="Chart information"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
          <Target className="w-5 h-5 text-green-500" />
        </div>
        
        {/* Navigation for non-competition charts */}
        {selectedChart !== 'competition' && (
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigatePeriod('prev')}
              className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
            
            <div className="text-sm font-medium text-gray-700">
              {selectedPeriod === 'week' ? 
                format(currentDisplayDate, 'MMM dd, yyyy') :
                format(currentDisplayDate, 'MMMM yyyy')
              }
            </div>
            
            <button
              onClick={() => navigatePeriod('next')}
              className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {chartData.length === 0 && !loading && !error && selectedChart !== 'competition' && (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <TrendingUp className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Data</h3>
            <p className="text-gray-600">Start tracking habits to see your progress analytics!</p>
          </div>
        )}

        {renderChart()}
      </div>

      {/* Summary Stats */}
      {userProgress.length > 0 && selectedChart !== 'competition' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Period Highlights</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-xl font-bold text-blue-600">{Math.max(...userProgress.map(up => up.totalLogged.pages))}</div>
              <div className="text-blue-800">Most Pages Read</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-xl font-bold text-green-600">{Math.max(...userProgress.map(up => up.totalLogged.kilometers))}</div>
              <div className="text-green-800">Most Kilometers</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-xl font-bold text-purple-600">{Math.max(...userProgress.map(up => up.totalLogged.minutes))}</div>
              <div className="text-purple-800">Most Exercise Minutes</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-xl font-bold text-orange-600">{Math.max(...userProgress.map(up => up.currentStreak))}</div>
              <div className="text-orange-800">Longest Streak</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartsView;