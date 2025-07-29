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
  const [showFakeDataControls, setShowFakeDataControls] = useState(false);
  const [generatingFakeData, setGeneratingFakeData] = useState(false);
  const [removingFakeData, setRemovingFakeData] = useState(false);

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

  // Function to generate fake data for visualization
  const generateFakeData = async () => {
    if (!confirm('This will add fake data for the last 2 weeks for all users. Are you sure?')) {
      return;
    }

    setGeneratingFakeData(true);
    try {
      // Get all users and their habits
      const { data: users } = await supabase
        .from('users')
        .select('*');

      if (!users || users.length === 0) {
        alert('No users found to generate fake data for.');
        return;
      }

      // Generate fake data for each user
      for (const user of users) {
        const { data: habits } = await supabase
          .from('habits')
          .select('*')
          .eq('user_id', user.id);

        if (!habits || habits.length === 0) continue;

        // Generate data for last 14 days
        const fakeCompletions = [];
        const today = new Date();
        
        for (let i = 0; i < 14; i++) {
          const date = new Date(today);
          date.setDate(today.getDate() - i);
          const dateKey = date.toISOString().split('T')[0];

          // Randomly complete 60-90% of habits each day
          const completionRate = 0.6 + Math.random() * 0.3;
          const habitsToComplete = Math.floor(habits.length * completionRate);
          
          // Shuffle habits and take the first N
          const shuffledHabits = [...habits].sort(() => Math.random() - 0.5);
          const completedHabits = shuffledHabits.slice(0, habitsToComplete);

          for (const habit of completedHabits) {
            let fakeData = {};

            // Generate realistic fake data based on habit type
            switch (habit.type) {
              case 'book':
                fakeData = {
                  pages_read: Math.floor(Math.random() * 30) + 5, // 5-35 pages
                  book_title: `Book ${Math.floor(Math.random() * 10) + 1}`,
                  book_finished: Math.random() < 0.1, // 10% chance of finishing
                  FAKE_DATA_MARKER: true
                };
                break;
              case 'running':
                fakeData = {
                  kilometers: Math.round((Math.random() * 8 + 2) * 10) / 10, // 2-10 km
                  FAKE_DATA_MARKER: true
                };
                break;
              case 'ai_learning':
                const topics = ['Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision'];
                fakeData = {
                  topic: topics[Math.floor(Math.random() * topics.length)],
                  completed: Math.random() < 0.8, // 80% completion rate
                  FAKE_DATA_MARKER: true
                };
                break;
              case 'job_search':
                fakeData = {
                  applied_for_job: Math.random() < 0.4,
                  sought_reference: Math.random() < 0.3,
                  updated_cv: Math.random() < 0.2,
                  FAKE_DATA_MARKER: true
                };
                break;
              case 'swimming':
                fakeData = {
                  hours: Math.round((Math.random() * 2 + 0.5) * 10) / 10, // 0.5-2.5 hours
                  FAKE_DATA_MARKER: true
                };
                break;
              case 'weight':
                const isWeightDay = date.getDay() === 0; // Sunday
                if (isWeightDay) {
                  fakeData = {
                    weight_kg: Math.round((75 + Math.random() * 10 - 5) * 10) / 10, // 70-80 kg
                    minutes: Math.floor(Math.random() * 60) + 30, // 30-90 minutes
                    FAKE_DATA_MARKER: true
                  };
                } else {
                  fakeData = {
                    weight_kg: 0,
                    minutes: Math.floor(Math.random() * 60) + 30, // 30-90 minutes
                    FAKE_DATA_MARKER: true
                  };
                }
                break;
              case 'exercise':
                fakeData = {
                  minutes: Math.floor(Math.random() * 90) + 30, // 30-120 minutes
                  FAKE_DATA_MARKER: true
                };
                break;
              case 'instagram':
                fakeData = {
                  followers: Math.floor(Math.random() * 50) + Math.floor(i * 2), // Growing followers
                  FAKE_DATA_MARKER: true
                };
                break;
              default:
                fakeData = { FAKE_DATA_MARKER: true };
            }

            fakeCompletions.push({
              user_id: user.id,
              habit_id: habit.id,
              date: dateKey,
              data: fakeData
            });
          }
        }

        // Insert fake completions
        if (fakeCompletions.length > 0) {
          const { error } = await supabase
            .from('habit_completions')
            .upsert(fakeCompletions, {
              onConflict: 'habit_id,date'
            });

          if (error) {
            console.error('Error inserting fake data for user:', user.name, error);
          }
        }
      }

      alert('Fake data generated successfully! You can now see realistic charts with 2 weeks of data.');
      loadChartData(); // Reload charts with fake data
    } catch (error) {
      console.error('Error generating fake data:', error);
      alert('Error generating fake data. Please try again.');
    } finally {
      setGeneratingFakeData(false);
    }
  };

  // Function to remove all fake data
  const removeFakeData = async () => {
    if (!confirm('This will remove ALL fake data (marked with FAKE_DATA_MARKER). Are you sure?')) {
      return;
    }

    setRemovingFakeData(true);
    try {
      // Find all completions with fake data marker
      const { data: fakeCompletions, error: fetchError } = await supabase
        .from('habit_completions')
        .select('id, data')
        .contains('data', { FAKE_DATA_MARKER: true });

      if (fetchError) throw fetchError;

      if (!fakeCompletions || fakeCompletions.length === 0) {
        alert('No fake data found to remove.');
        return;
      }

      // Delete all fake completions
      const fakeIds = fakeCompletions.map(completion => completion.id);
      const { error: deleteError } = await supabase
        .from('habit_completions')
        .delete()
        .in('id', fakeIds);

      if (deleteError) throw deleteError;

      alert(`Successfully removed ${fakeCompletions.length} fake data entries.`);
      loadChartData(); // Reload charts without fake data
    } catch (error) {
      console.error('Error removing fake data:', error);
      alert('Error removing fake data. Please try again.');
    } finally {
      setRemovingFakeData(false);
    }
  };

  useEffect(() => {
    loadChartData();
  }, [selectedPeriod, selectedChart]);

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
            // Weekly completion rate
            const weekCompletions = userProgress.completions.filter(c => c.date === dateKey).length;
            const possibleCompletions = userProgress.habits.length;
            const rate = possibleCompletions > 0 ? (weekCompletions / possibleCompletions) * 100 : 0;
            dataPoint[userName] = Math.round(rate);
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
                <Tooltip formatter={(value) => [`${value}%`, 'Completion Rate']} />
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
                    <div>🎯 {up.completionRate.toFixed(1)}% completion rate</div>
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
        return `User Performance Comparison - ${periodLabel}`;
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
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFakeDataControls(!showFakeDataControls)}
              className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors"
              title="Show/Hide Fake Data Controls"
            >
              🧪 Dev
            </button>
            <div className="flex items-center space-x-1">
              <Calendar className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-600">{periods.find(p => p.value === selectedPeriod)?.label}</span>
            </div>
          </div>
        </div>

        {/* Fake Data Controls */}
        {showFakeDataControls && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <h3 className="text-sm font-medium text-orange-800 mb-2">🧪 Development Tools</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={generateFakeData}
                disabled={generatingFakeData}
                className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingFakeData ? (
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>📊</span>
                )}
                <span>{generatingFakeData ? 'Generating...' : 'Generate 2 Weeks Fake Data'}</span>
              </button>
              
              <button
                onClick={removeFakeData}
                disabled={removingFakeData}
                className="flex items-center space-x-1 px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {removingFakeData ? (
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>🗑️</span>
                )}
                <span>{removingFakeData ? 'Removing...' : 'Remove All Fake Data'}</span>
              </button>
            </div>
            <p className="text-xs text-orange-600 mt-2">
              ⚠️ Fake data is marked with FAKE_DATA_MARKER and can be safely removed anytime.
            </p>
          </div>
        )}
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
              🏆 Most active user: {userProgress.sort((a, b) => b.completions.length - a.completions.length)[0]?.user.name.split(' ')[0]} with {userProgress.sort((a, b) => b.completions.length - a.completions.length)[0]?.completions.length} completions
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartsView;