import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Users, BookOpen, Activity, Target, BarChart3, LineChart, User } from 'lucide-react';
import { BarChart, Bar, LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, eachDayOfInterval, startOfWeek, startOfMonth, startOfQuarter, startOfYear } from 'date-fns';
import { supabase } from '../lib/supabase';
import { User as UserType, UserProgress, CompetitionMetrics } from '../utils/types';

interface ChartsViewProps {
  currentUser: UserType;
}

type TimePeriod = 'week' | 'month' | 'quarter' | 'year';
type ChartType = 'overview' | 'books' | 'exercise' | 'competition';

interface ChartData {
  date: string;
  [key: string]: any;
}

const ChartsView: React.FC<ChartsViewProps> = ({ currentUser }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month');
  const [selectedChart, setSelectedChart] = useState<ChartType>('overview');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [competitionData, setCompetitionData] = useState<CompetitionMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const periods = [
    { value: 'week' as TimePeriod, label: 'This Week', days: 7 },
    { value: 'month' as TimePeriod, label: 'This Month', days: 30 },
    { value: 'quarter' as TimePeriod, label: 'This Quarter', days: 90 },
    { value: 'year' as TimePeriod, label: 'This Year', days: 365 }
  ];

  const chartTypes = [
    { value: 'books' as ChartType, label: 'Reading Competition', icon: BookOpen },
    { value: 'exercise' as ChartType, label: 'Fitness Competition', icon: Activity },
    { value: 'overview' as ChartType, label: 'Daily Progress', icon: TrendingUp },
    { value: 'competition' as ChartType, label: 'Overall Ranking', icon: Users }
  ];

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'];

  // Custom dot component for chart icons
  const CustomDot = (props: any) => {
    const { cx, cy, payload, dataKey } = props;
    
    // Only show icon on the last data point
    if (payload && chartData && payload === chartData[chartData.length - 1]) {
      let IconComponent = User; // Default icon
      
      // Determine icon based on chart type
      if (selectedChart === 'books') {
        IconComponent = BookOpen;
      } else if (selectedChart === 'exercise') {
        IconComponent = Activity;
      }
      
      return (
        <g>
          <circle cx={cx} cy={cy} r={8} fill="white" stroke={props.stroke} strokeWidth={2} />
          <foreignObject x={cx - 6} y={cy - 6} width={12} height={12}>
            <div className="flex items-center justify-center w-full h-full">
              <IconComponent className="w-3 h-3" style={{ color: props.stroke }} />
            </div>
          </foreignObject>
        </g>
      );
    }
    
    // Regular small dot for other points
    return <circle cx={cx} cy={cy} r={2} fill={props.stroke} />;
  };
  useEffect(() => {
    loadAllData();
  }, [selectedPeriod, selectedChart, currentUser.id]);

  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;

    switch (selectedPeriod) {
      case 'week':
        startDate = startOfWeek(now);
        break;
      case 'month':
        startDate = startOfMonth(now);
        break;
      case 'quarter':
        startDate = startOfQuarter(now);
        break;
      case 'year':
        startDate = startOfYear(now);
        break;
      default:
        startDate = startOfMonth(now);
    }

    // Ensure week starts on Sunday
    if (selectedPeriod === 'week') {
      startDate = startOfWeek(now, { weekStartsOn: 0 });
    }

    return { startDate, endDate: now };
  };

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { startDate, endDate } = getDateRange();
      
      // Step 1: Load ALL users from the database
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('name');

      if (usersError) {
        throw new Error(`Failed to load users: ${usersError.message}`);
      }

      if (!allUsers || allUsers.length === 0) {
        setUserProgress([]);
        setCompetitionData([]);
        setChartData([]);
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

      // Step 3: Load completions for ALL users within date range
      const { data: allCompletions, error: completionsError } = await supabase
        .from('habit_completions')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date');

      if (completionsError) {
        throw new Error(`Failed to load completions: ${completionsError.message}`);
      }

      // Step 4: Process data for each user
      const processedUserProgress: UserProgress[] = [];
      const competitionMetrics: CompetitionMetrics[] = [];

      for (const user of allUsers) {
        const userHabits = (allHabits || []).filter(h => h.user_id === user.id);
        const userCompletions = (allCompletions || []).filter(c => c.user_id === user.id);

        // Calculate totals for this user
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

        // Calculate streaks and totals
        const currentStreak = calculateUserStreak(userCompletions, userHabits);
        const weeklyTotal = userCompletions.filter(c => {
          const completionDate = new Date(c.date);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return completionDate >= weekAgo;
        }).length;

        processedUserProgress.push({
          user: { id: user.id, email: user.email, name: user.name },
          habits: userHabits,
          totalLogged,
          currentStreak,
          weeklyTotal,
          monthlyTotal: userCompletions.length
        });

        // Add to competition metrics
        userHabits.forEach(habit => {
          let value = 0;
          let unit = '';
          
          switch (habit.type) {
            case 'book':
              value = totalLogged.pages;
              unit = 'pages';
              break;
            case 'running':
              value = totalLogged.kilometers;
              unit = 'km';
              break;
            case 'ai_learning':
              value = totalLogged.topics;
              unit = 'topics';
              break;
            case 'job_search':
              value = totalLogged.activities;
              unit = 'activities';
              break;
            case 'swimming':
            case 'weight':
            case 'exercise':
              value = totalLogged.minutes;
              unit = 'minutes';
              break;
          }

          if (value > 0) {
            competitionMetrics.push({
              userId: user.id,
              userName: user.name.split(' ')[0],
              habitType: habit.type,
              totalLogged: value,
              unit,
              target: habit.target || undefined
            });
          }
        });
      }

      setUserProgress(processedUserProgress);
      setCompetitionData(competitionMetrics);

      // Generate chart data based on selected chart type
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
    // Simple streak calculation - days with any meaningful completion
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
        date: format(date, selectedPeriod === 'week' ? 'EEE' : 'MMM dd'),
        dateKey
      };

      userProgressData.forEach((userProgress) => {
        const userName = userProgress.user.name.split(' ')[0];

        switch (selectedChart) {
          case 'overview':
            // Daily total logged numbers
            const dayTotal = userProgress.totalLogged.pages + 
                           userProgress.totalLogged.kilometers + 
                           userProgress.totalLogged.minutes + 
                           userProgress.totalLogged.topics + 
                           userProgress.totalLogged.activities;
            dataPoint[userName] = dayTotal;
            break;

          case 'books':
            dataPoint[userName] = userProgress.totalLogged.pages;
            break;

          case 'exercise':
            const exerciseTotal = userProgress.totalLogged.kilometers + userProgress.totalLogged.minutes;
            dataPoint[userName] = exerciseTotal;
            break;

          case 'competition':
            const competitionTotal = Object.values(userProgress.totalLogged).reduce((sum, val) => sum + val, 0);
            dataPoint[userName] = competitionTotal;
            break;
        }
      });

      return dataPoint;
    });
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
      // Show ranking table instead of chart
      const sortedUsers = userProgress.sort((a, b) => {
        const aTotal = Object.values(a.totalLogged).reduce((sum, val) => sum + val, 0);
        const bTotal = Object.values(b.totalLogged).reduce((sum, val) => sum + val, 0);
        return bTotal - aTotal;
      });

      return (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">Friend Competition Leaderboard</h4>
            <div className="space-y-2">
              {sortedUsers.map((user, index) => {
                const total = Object.values(user.totalLogged).reduce((sum, val) => sum + val, 0);
                const isCurrentUser = user.user.id === currentUser.id;
                
                return (
                  <div key={user.user.id} className={`flex items-center justify-between p-3 rounded-lg ${
                    isCurrentUser ? 'bg-blue-100 border-2 border-blue-300' : 'bg-white border border-gray-200'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-yellow-500 text-white' :
                        index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-orange-600 text-white' :
                        'bg-gray-200 text-gray-600'
                      }`}>
                        {index + 1}
                      </div>
                      <span className="font-medium">{user.user.name}</span>
                      {isCurrentUser && <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">You</span>}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{total}</div>
                      <div className="text-xs text-gray-500">total points</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // Streak Visualization for overview
    if (selectedChart === 'overview') {
      return (
        <div className="space-y-6">
          {/* Streak Visualization */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Current Streaks</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={userProgress.map(up => ({
                  name: up.user.name.split(' ')[0],
                  streak: up.currentStreak
                }))}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value, name) => [`${value} days`, 'Current Streak']} />
                <Bar dataKey="streak" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Daily Progress Line Chart */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Daily Progress Trends</h4>
            <ResponsiveContainer width="100%" height={250}>
              <RechartsLineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}`, 'Total Logged']} />
                <Legend />
                {userProgress.map((up, index) => (
                  <Line
                    key={up.user.name}
                    type="monotone"
                    dataKey={up.user.name.split(' ')[0]}
                    stroke={colors[index % colors.length]}
                    strokeWidth={1.5}
                    dot={<CustomDot />}
                  />
                ))}
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    // Regular line charts for other types
    return (
      <ResponsiveContainer width="100%" height={300}>
        <RechartsLineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip formatter={(value) => [`${value}`, getTooltipLabel()]} />
          <Legend />
          {userNames.map((name, index) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={colors[index % colors.length]}
              strokeWidth={1.5}
              dot={{ r: 2 }}
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
        return `Reading Competition - ${periodLabel}`;
      case 'exercise':
        return `Fitness Competition - ${periodLabel}`;
      case 'competition':
        return `Friend Competition Ranking - ${periodLabel}`;
      default:
        return `Progress Chart - ${periodLabel}`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Friend Competition</h2>
          <div className="flex items-center space-x-1">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-600">{periods.find(p => p.value === selectedPeriod)?.label}</span>
          </div>
        </div>

        {/* Period Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Time Period</label>
          <div className="flex space-x-2 overflow-x-auto">
            {periods.map(period => (
              <button
                key={period.value}
                onClick={() => setSelectedPeriod(period.value)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  selectedPeriod === period.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Competition View</label>
          <div className="grid grid-cols-2 gap-2">
            {chartTypes.map(type => {
              const Icon = type.icon;
              return (
                <button
                  key={type.value}
                  onClick={() => setSelectedChart(type.value)}
                  className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    selectedChart === type.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chart Display */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">{getChartTitle()}</h3>
          <Target className="w-5 h-5 text-blue-500" />
        </div>

        {renderChart()}

        {chartData.length === 0 && !loading && !error && (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <TrendingUp className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Competition Data</h3>
            <p className="text-gray-600">Start tracking habits to compete with friends!</p>
          </div>
        )}
      </div>

      {/* Competition Stats */}
      {userProgress.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-3">🏆 Competition Highlights</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div>
              📚 Most pages read: {Math.max(...userProgress.map(up => up.totalLogged.pages))} pages
            </div>
            <div>
              🏃 Most kilometers covered: {Math.max(...userProgress.map(up => up.totalLogged.kilometers))} km
            </div>
            <div>
              💪 Most exercise time: {Math.max(...userProgress.map(up => up.totalLogged.minutes))} minutes
            </div>
            <div>
              🔥 Longest streak: {Math.max(...userProgress.map(up => up.currentStreak))} days
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartsView;