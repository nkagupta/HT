import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Users, BookOpen, Activity, Target, ChevronDown } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, subWeeks, subMonths, subYears, startOfWeek, startOfMonth, startOfQuarter, startOfYear, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';
import { supabase } from '../lib/supabase';
import { User as UserType, Habit, HabitCompletion } from '../utils/types';

interface ChartsViewProps {
  currentUser: UserType;
}

type TimePeriod = 'week' | 'month' | 'quarter' | 'year';
type ChartType = 'overview' | 'books' | 'exercise' | 'comparison';

interface ChartData {
  date: string;
  [key: string]: any;
}

interface UserProgress {
  user: UserType;
  habits: Habit[];
  completions: HabitCompletion[];
  totalPages: number;
  totalKilometers: number;
  totalMinutes: number;
  completionRate: number;
}

const ChartsView: React.FC<ChartsViewProps> = ({ currentUser }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month');
  const [selectedChart, setSelectedChart] = useState<ChartType>('overview');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const periods = [
    { value: 'week' as TimePeriod, label: 'This Week', days: 7 },
    { value: 'month' as TimePeriod, label: 'This Month', days: 30 },
    { value: 'quarter' as TimePeriod, label: 'This Quarter', days: 90 },
    { value: 'year' as TimePeriod, label: 'This Year', days: 365 }
  ];

  const chartTypes = [
    { value: 'overview' as ChartType, label: 'Overview', icon: TrendingUp },
    { value: 'books' as ChartType, label: 'Reading Progress', icon: BookOpen },
    { value: 'exercise' as ChartType, label: 'Exercise & Fitness', icon: Activity },
    { value: 'comparison' as ChartType, label: 'User Comparison', icon: Users }
  ];

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'];

  useEffect(() => {
    loadChartData();
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

    return { startDate, endDate: now };
  };

  const loadChartData = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      // Get all users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('name');

      if (usersError) throw usersError;

      const allUsers = users || [];
      const userProgressData: UserProgress[] = [];

      // Load data for each user
      for (const user of allUsers) {
        const { data: habits } = await supabase
          .from('habits')
          .select('*')
          .eq('user_id', user.id);

        const { data: completions } = await supabase
          .from('habit_completions')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);

        const userHabits = habits || [];
        const userCompletions = completions || [];

        // Calculate aggregated metrics
        const totalPages = userCompletions
          .filter(c => userHabits.find(h => h.id === c.habit_id && h.type === 'book'))
          .reduce((sum, c) => sum + (c.data.pages_read || 0), 0);

        const totalKilometers = userCompletions
          .filter(c => userHabits.find(h => h.id === c.habit_id && h.type === 'running'))
          .reduce((sum, c) => sum + (c.data.kilometers || 0), 0);

        const totalMinutes = userCompletions
          .filter(c => {
            const habit = userHabits.find(h => h.id === c.habit_id);
            return habit && (habit.type === 'exercise' || habit.type === 'weight');
          })
          .reduce((sum, c) => sum + (c.data.minutes || 0), 0);

        // Calculate completion rate
        const totalPossibleDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const completionRate = userHabits.length > 0 
          ? (userCompletions.length / (userHabits.length * totalPossibleDays)) * 100 
          : 0;

        userProgressData.push({
          user,
          habits: userHabits,
          completions: userCompletions,
          totalPages,
          totalKilometers,
          totalMinutes,
          completionRate: Math.min(completionRate, 100)
        });
      }

      setUserProgress(userProgressData);

      // Generate chart data based on selected chart type
      const data = generateChartData(userProgressData, startDate, endDate);
      setChartData(data);

    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateChartData = (userProgressData: UserProgress[], startDate: Date, endDate: Date): ChartData[] => {
    let intervals: Date[] = [];
    let formatString = 'MMM dd';

    switch (selectedPeriod) {
      case 'week':
        intervals = eachDayOfInterval({ start: startDate, end: endDate });
        formatString = 'EEE';
        break;
      case 'month':
        intervals = eachDayOfInterval({ start: startDate, end: endDate });
        formatString = 'MMM dd';
        break;
      case 'quarter':
        intervals = eachWeekOfInterval({ start: startDate, end: endDate });
        formatString = 'MMM dd';
        break;
      case 'year':
        intervals = eachMonthOfInterval({ start: startDate, end: endDate });
        formatString = 'MMM yyyy';
        break;
    }

    return intervals.map(date => {
      const dateKey = date.toISOString().split('T')[0];
      const dataPoint: ChartData = {
        date: format(date, formatString),
        dateKey
      };

      userProgressData.forEach((userProgress, index) => {
        const userName = userProgress.user.name.split(' ')[0]; // Use first name

        switch (selectedChart) {
          case 'overview':
            // Daily completion count
            const dayCompletions = userProgress.completions.filter(c => c.date === dateKey).length;
            dataPoint[userName] = dayCompletions;
            break;

          case 'books':
            // Cumulative pages read
            const pagesUpToDate = userProgress.completions
              .filter(c => {
                const habit = userProgress.habits.find(h => h.id === c.habit_id && h.type === 'book');
                return habit && c.date <= dateKey;
              })
              .reduce((sum, c) => sum + (c.data.pages_read || 0), 0);
            dataPoint[userName] = pagesUpToDate;
            break;

          case 'exercise':
            // Cumulative exercise minutes
            const minutesUpToDate = userProgress.completions
              .filter(c => {
                const habit = userProgress.habits.find(h => h.id === c.habit_id);
                return habit && (habit.type === 'exercise' || habit.type === 'running' || habit.type === 'weight') && c.date <= dateKey;
              })
              .reduce((sum, c) => sum + ((c.data.minutes || 0) + (c.data.kilometers ? c.data.kilometers * 60 : 0)), 0);
            dataPoint[userName] = minutesUpToDate;
            break;

          case 'comparison':
            // Total meaningful activities for the day
            const dayActivities = userProgress.completions.filter(c => {
              if (c.date !== dateKey) return false;
              const habit = userProgress.habits.find(h => h.id === c.habit_id);
              if (!habit) return false;
              
              // Count meaningful activities based on logged numbers
              switch (habit.type) {
                case 'book': return c.data.pages_read > 0;
                case 'running': return c.data.kilometers > 0;
                case 'ai_learning': return c.data.completed;
                case 'job_search': 
                  return (c.data.applied_for_job ? 1 : 0) + 
                         (c.data.sought_reference ? 1 : 0) + 
                         (c.data.updated_cv ? 1 : 0);
                case 'swimming': return c.data.hours > 0;
                case 'weight': return c.data.weight_kg > 0 || c.data.minutes > 0;
                case 'exercise': return c.data.minutes > 0;
                case 'instagram': return c.data.followers > 0;
                default: return false;
              }
            }).reduce((sum, c) => {
              const habit = userProgress.habits.find(h => h.id === c.habit_id);
              if (!habit) return sum;
              
              // For job_search, count individual activities
              if (habit.type === 'job_search') {
                return sum + (c.data.applied_for_job ? 1 : 0) + 
                            (c.data.sought_reference ? 1 : 0) + 
                            (c.data.updated_cv ? 1 : 0);
              }
              
              // For other habits, count as 1 activity if they have meaningful data
              return sum + 1;
            }, 0);
            dataPoint[userName] = dayActivities;
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

    const userNames = userProgress.map(up => up.user.name.split(' ')[0]);

    switch (selectedChart) {
      case 'overview':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              {userNames.map((name, index) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'books':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value} pages`, 'Pages Read']} />
              <Legend />
              {userNames.map((name, index) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'exercise':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value} min`, 'Exercise Time']} />
              <Legend />
              {userNames.map((name, index) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'comparison':
        return (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}`, 'Activities Logged']} />
                <Legend />
                {userNames.map((name, index) => (
                  <Bar
                    key={name}
                    dataKey={name}
                    fill={colors[index % colors.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>

            {/* Summary Stats */}
            <div className="mt-6 grid grid-cols-2 gap-4">
              {userProgress.map((up, index) => (
                <div key={up.user.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: colors[index % colors.length] }}
                    />
                    <h4 className="font-medium text-gray-900">{up.user.name.split(' ')[0]}</h4>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>📚 {up.totalPages} pages read</div>
                    <div>🏃 {up.totalKilometers.toFixed(1)} km covered</div>
                    <div>⏱️ {up.totalMinutes} min exercised</div>
                    <div>📊 {up.totalCompletions} total activities logged</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const getChartTitle = () => {
    const periodLabel = periods.find(p => p.value === selectedPeriod)?.label || 'This Month';
    
    switch (selectedChart) {
      case 'overview':
        return `Daily Habit Completions - ${periodLabel}`;
      case 'books':
        return `Reading Progress - ${periodLabel}`;
      case 'exercise':
        return `Exercise & Fitness Progress - ${periodLabel}`;
      case 'comparison':
        return `Daily Activities Logged - ${periodLabel}`;
      default:
        return `Progress Chart - ${periodLabel}`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Progress Charts</h2>
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
          <label className="block text-sm font-medium text-gray-700 mb-2">Chart Type</label>
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

        {chartData.length === 0 && !loading && (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <TrendingUp className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-600">Start tracking habits to see your progress charts!</p>
          </div>
        )}
      </div>

      {/* Insights */}
      {userProgress.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-3">📊 Key Insights</h3>
          <div className="space-y-2 text-sm text-gray-600">
            {selectedChart === 'books' && (
              <div>
                📖 Total pages read by all users: {userProgress.reduce((sum, up) => sum + up.totalPages, 0)} pages
              </div>
            )}
            {selectedChart === 'exercise' && (
              <div>
                💪 Total exercise time: {userProgress.reduce((sum, up) => sum + up.totalMinutes, 0)} minutes ({Math.round(userProgress.reduce((sum, up) => sum + up.totalMinutes, 0) / 60)} hours)
              </div>
            )}
            <div>
              🏆 Most active user: {userProgress.sort((a, b) => b.completions.length - a.completions.length)[0]?.user.name.split(' ')[0]} with {userProgress.sort((a, b) => b.completions.length - a.completions.length)[0]?.completions.length} activities logged
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartsView;