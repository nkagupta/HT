import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, BookOpen, Activity, Trophy, Info, Calendar, Clock } from 'lucide-react';
import { Habit, HabitCompletion, User } from '../utils/types';

interface ChartsViewProps {
  habits: Habit[];
  habitCompletions: HabitCompletion[];
  users: User[];
  currentUser: User;
}

type ChartType = 'overview' | 'books' | 'exercise' | 'competition';
type TimePeriod = 'week' | 'month';

const ChartsView: React.FC<ChartsViewProps> = ({ habits, habitCompletions, users, currentUser }) => {
  const [selectedChart, setSelectedChart] = useState<ChartType>('overview');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('week');
  const [showInfo, setShowInfo] = useState(false);

  // Add null checks for props
  const safeHabits = habits || [];
  const safeHabitCompletions = habitCompletions || [];
  const safeUsers = users || [];

  // Show loading state if required data is not available
  if (!habits || !habitCompletions || !users || !currentUser) {
    return (
      <div className="p-4 max-w-6xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading analytics...</div>
        </div>
      </div>
    );
  }

  const chartTypes = [
    { id: 'overview' as ChartType, label: 'Daily Progress', icon: Calendar },
    { id: 'books' as ChartType, label: 'Reading', icon: BookOpen },
    { id: 'exercise' as ChartType, label: 'Fitness', icon: Activity },
    { id: 'competition' as ChartType, label: 'Competition', icon: Trophy },
  ];

  // Get date range based on period
  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    
    if (timePeriod === 'week') {
      start.setDate(end.getDate() - 6);
    } else {
      start.setDate(end.getDate() - 29);
    }
    
    return { start, end };
  };

  // Generate chart data
  const chartData = useMemo(() => {
    const { start, end } = getDateRange();
    const data = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayCompletions = safeHabitCompletions.filter(c => c.date === dateStr);
      
      if (selectedChart === 'overview') {
        const totalHabits = safeHabits.length;
        const completedHabits = dayCompletions.length;
        data.push({
          date: timePeriod === 'week' ? 
            d.toLocaleDateString('en-US', { weekday: 'short' }) + '\n' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) :
            d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0,
          label: `${completedHabits}/${totalHabits} habits`
        });
      } else if (selectedChart === 'books') {
        const bookCompletions = dayCompletions.filter(c => {
          const habit = safeHabits.find(h => h.id === c.habit_id);
          return habit?.type === 'book';
        });
        const totalPages = bookCompletions.reduce((sum, c) => sum + (c.data?.pages_read || 0), 0);
        data.push({
          date: timePeriod === 'week' ? 
            d.toLocaleDateString('en-US', { weekday: 'short' }) + '\n' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) :
            d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: totalPages,
          label: `${totalPages} pages`
        });
      } else if (selectedChart === 'exercise') {
        const exerciseCompletions = dayCompletions.filter(c => {
          const habit = safeHabits.find(h => h.id === c.habit_id);
          return ['running', 'swimming', 'weight', 'exercise'].includes(habit?.type || '');
        });
        const totalMinutes = exerciseCompletions.reduce((sum, c) => sum + (c.data?.minutes || 0), 0);
        data.push({
          date: timePeriod === 'week' ? 
            d.toLocaleDateString('en-US', { weekday: 'short' }) + '\n' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) :
            d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: totalMinutes,
          label: `${totalMinutes} minutes`
        });
      }
    }
    
    return data;
  }, [safeHabits, safeHabitCompletions, selectedChart, timePeriod]);

  // Competition data
  const competitionData = useMemo(() => {
    if (selectedChart !== 'competition') return [];
    
    const { start, end } = getDateRange();
    
    return safeUsers.map(user => {
      const userCompletions = safeHabitCompletions.filter(c => {
        const completionDate = new Date(c.date);
        return c.user_id === user.id && completionDate >= start && completionDate <= end;
      });
      
      const score = userCompletions.length;
      
      return {
        user: user.name,
        score,
        isCurrentUser: user.id === currentUser.id
      };
    }).sort((a, b) => b.score - a.score);
  }, [safeUsers, safeHabitCompletions, currentUser, selectedChart, timePeriod]);

  // Period highlights
  const periodHighlights = useMemo(() => {
    const { start, end } = getDateRange();
    const periodCompletions = safeHabitCompletions.filter(c => {
      const completionDate = new Date(c.date);
      return completionDate >= start && completionDate <= end;
    });

    const highlights = [];

    // Most active day
    const dayCount: { [key: string]: number } = {};
    periodCompletions.forEach(c => {
      dayCount[c.date] = (dayCount[c.date] || 0) + 1;
    });
    const mostActiveDay = Object.entries(dayCount).reduce((max, [date, count]) => 
      count > max.count ? { date, count } : max, { date: '', count: 0 });
    
    if (mostActiveDay.count > 0) {
      highlights.push(`Most active: ${new Date(mostActiveDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${mostActiveDay.count} habits)`);
    }

    // Most pages read
    const pagesByUser: { [key: string]: number } = {};
    periodCompletions.forEach(c => {
      const habit = safeHabits.find(h => h.id === c.habit_id);
      if (habit?.type === 'book' && c.data?.pages_read) {
        const user = safeUsers.find(u => u.id === c.user_id);
        if (user) {
          pagesByUser[user.name] = (pagesByUser[user.name] || 0) + c.data.pages_read;
        }
      }
    });
    const topReader = Object.entries(pagesByUser).reduce((max, [user, pages]) => 
      pages > max.pages ? { user, pages } : max, { user: '', pages: 0 });
    
    if (topReader.pages > 0) {
      highlights.push(`Most pages by ${topReader.user}: ${topReader.pages} pages`);
    }

    // Most exercise time
    const exerciseByUser: { [key: string]: number } = {};
    periodCompletions.forEach(c => {
      const habit = safeHabits.find(h => h.id === c.habit_id);
      if (['running', 'swimming', 'weight', 'exercise'].includes(habit?.type || '') && c.data?.minutes) {
        const user = safeUsers.find(u => u.id === c.user_id);
        if (user) {
          exerciseByUser[user.name] = (exerciseByUser[user.name] || 0) + c.data.minutes;
        }
      }
    });
    const topExerciser = Object.entries(exerciseByUser).reduce((max, [user, minutes]) => 
      minutes > max.minutes ? { user, minutes } : max, { user: '', minutes: 0 });
    
    if (topExerciser.minutes > 0) {
      highlights.push(`Most exercise by ${topExerciser.user}: ${Math.round(topExerciser.minutes / 60)}h ${topExerciser.minutes % 60}m`);
    }

    return highlights;
  }, [safeHabits, safeHabitCompletions, safeUsers, timePeriod]);

  const getChartInfo = () => {
    switch (selectedChart) {
      case 'overview':
        return {
          title: 'Daily Progress Chart',
          description: 'Shows the percentage of habits completed each day. This gives you an overview of how consistent you are across all your habits. A higher percentage means you completed more of your daily habits.'
        };
      case 'books':
        return {
          title: 'Reading Progress Chart',
          description: 'Tracks the total number of pages read each day across all your book habits. This helps you visualize your reading consistency and daily reading volume.'
        };
      case 'exercise':
        return {
          title: 'Fitness Activity Chart',
          description: 'Shows the total minutes spent on fitness activities (running, swimming, weight training, exercise) each day. This helps track your daily physical activity commitment.'
        };
      case 'competition':
        return {
          title: 'Competition Leaderboard',
          description: 'Shows the total number of habit completions for each user during the selected period. This creates friendly competition and motivation among users.'
        };
      default:
        return { title: '', description: '' };
    }
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Period Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Period Highlights</p>
              <div className="mt-2 space-y-1">
                {periodHighlights.length > 0 ? (
                  periodHighlights.slice(0, 2).map((highlight, index) => (
                    <p key={index} className="text-xs text-blue-700">{highlight}</p>
                  ))
                ) : (
                  <p className="text-xs text-blue-700">No activity yet</p>
                )}
              </div>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Total Completions</p>
              <p className="text-2xl font-bold text-green-800">
                {safeHabitCompletions.filter(c => {
                  const { start, end } = getDateRange();
                  const completionDate = new Date(c.date);
                  return completionDate >= start && completionDate <= end;
                }).length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium">Active Days</p>
              <p className="text-2xl font-bold text-purple-800">
                {(() => {
                  const { start, end } = getDateRange();
                  const activeDays = new Set();
                  safeHabitCompletions.forEach(c => {
                    const completionDate = new Date(c.date);
                    if (completionDate >= start && completionDate <= end) {
                      activeDays.add(c.date);
                    }
                  });
                  return activeDays.size;
                })()}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Chart Type Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 sm:mb-0">Analytics Dashboard</h2>
          
          {/* Time Period Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setTimePeriod('week')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                timePeriod === 'week'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setTimePeriod('month')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                timePeriod === 'month'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Month
            </button>
          </div>
        </div>

        {/* Chart Type Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {chartTypes.map((chart) => {
            const Icon = chart.icon;
            return (
              <button
                key={chart.id}
                onClick={() => setSelectedChart(chart.id)}
                className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                  selectedChart === chart.id
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <Icon className={`w-6 h-6 mx-auto mb-2 ${
                  selectedChart === chart.id ? 'text-blue-600' : 'text-gray-500'
                }`} />
                <p className={`text-sm font-medium ${
                  selectedChart === chart.id ? 'text-blue-800' : 'text-gray-700'
                }`}>
                  {chart.label}
                </p>
              </button>
            );
          })}
        </div>

        {/* Chart Header with Info */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-800">
            {chartTypes.find(c => c.id === selectedChart)?.label} Chart
          </h3>
          <button
            onClick={() => setShowInfo(true)}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            title="Chart Information"
          >
            <Info className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Chart Display */}
        <div className="bg-gray-50 rounded-lg p-4" style={{ height: timePeriod === 'week' ? '320px' : '300px' }}>
          {selectedChart === 'competition' ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={competitionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="user" 
                  tick={{ fontSize: 12 }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => [`${value} completions`, 'Score']}
                  labelFormatter={(label) => `User: ${label}`}
                />
                <Bar 
                  dataKey="score" 
                  fill={(entry: any) => entry.isCurrentUser ? '#3B82F6' : '#6B7280'}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: timePeriod === 'week' ? 60 : 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={timePeriod === 'month' ? -45 : 0}
                  textAnchor={timePeriod === 'month' ? 'end' : 'middle'}
                  height={timePeriod === 'week' ? 80 : 60}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    selectedChart === 'overview' ? `${value}%` : 
                    selectedChart === 'books' ? `${value} pages` : `${value} minutes`,
                    name === 'value' ? chartTypes.find(c => c.id === selectedChart)?.label : name
                  ]}
                  labelFormatter={(label) => `Date: ${label.replace('\n', ' ')}`}
                />
                <Bar 
                  dataKey="value" 
                  fill="#3B82F6" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              {getChartInfo().title}
            </h3>
            <p className="text-gray-600 mb-4">
              {getChartInfo().description}
            </p>
            <button
              onClick={() => setShowInfo(false)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartsView;