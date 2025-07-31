import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Book, Save, CheckCircle, Info, X, AlertCircle, Users, TrendingUp } from 'lucide-react';
import Confetti from 'react-confetti';
import { supabase } from '../lib/supabase';
import { User, Habit, HabitCompletion, getDateKey, isWithinSevenDays } from '../utils/types';
import HabitInput from './HabitInput';

interface CalendarViewProps {
  currentUser: User;
  currentDate?: Date;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  currentUser,
  currentDate: propCurrentDate,
}) => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<{ [key: string]: HabitCompletion }>({});
  const [pendingChanges, setPendingChanges] = useState<{ [key: string]: any }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiColors, setConfettiColors] = useState<string[]>(['#3B82F6']);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showNudgeModal, setShowNudgeModal] = useState(false);
  const [nudgeData, setNudgeData] = useState<{
    habit: Habit;
    daysSinceUpdate: number;
    message: string;
    comparisonStats?: {
      totalActiveUsers: number;
      averageCompletionsThisWeek: number;
    };
  } | null>(null);
  const [currentDate, setCurrentDate] = useState(() => {
    return propCurrentDate || new Date();
  });
  
  const dateString = currentDate.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });

  // Playful nudge messages
  const nudgeMessages = [
    "Hey there! Your {habitName} is feeling a bit lonely. Time to show it some love! 💪",
    "Plot twist: Your {habitName} habit has been waiting {days} days for you! Let's not keep it waiting! 🎯",
    "Breaking news: Your friends have been crushing their goals while your {habitName} takes a vacation! 📰",
    "Your {habitName} called... it wants to know if you're still friends! 😅",
    "Houston, we have a problem! Your {habitName} has been offline for {days} days! 🚀",
    "Knock knock! Who's there? Your {habitName} habit, wondering where you've been! 🚪",
    "Your {habitName} is like a plant - it needs regular attention to grow! 🌱",
    "Fun fact: Consistency beats perfection! Your {habitName} is ready for a comeback! ⭐",
    "Your {habitName} habit has been doing pushups in the corner, waiting for your return! 💪",
    "Alert: Your {habitName} streak may be sleeping, but it's ready to wake up stronger! 🔥"
  ];
  useEffect(() => {
    loadHabitsAndCompletions();
    checkForNudges();
  }, [currentUser.id, currentDate]);

  const loadHabitsAndCompletions = async () => {
    try {
      // Load habits
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at');

      if (habitsError) throw habitsError;

      // Load completions for current date
      const dateKey = getDateKey(currentDate);

      const { data: completionsData, error: completionsError } = await supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('date', dateKey);

      if (completionsError) throw completionsError;

      setHabits(habitsData || []);
      
      // Convert completions array to object for easier lookup
      const completionsMap: { [key: string]: HabitCompletion } = {};
      completionsData?.forEach(completion => {
        const key = `${completion.date}-${completion.habit_id}`;
        completionsMap[key] = completion;
      });
      setCompletions(completionsMap);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkForNudges = async () => {
    try {
      // Load all user completions from the last 30 days to check for gaps
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: recentCompletions, error: completionsError } = await supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', currentUser.id)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (completionsError) {
        console.error('Error loading completions for nudge check:', completionsError);
        return;
      }

      // Load comparison stats from other users for context
      const { data: allUsersStats, error: statsError } = await supabase
        .from('habit_completions')
        .select('user_id, date')
        .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      if (statsError) {
        console.error('Error loading user stats for comparison:', statsError);
      }

      // Check each habit for 14+ day gaps
      for (const habit of habits) {
        const habitCompletions = recentCompletions?.filter(c => c.habit_id === habit.id) || [];
        
        if (habitCompletions.length === 0) {
          // No completions in the last 30 days
          const daysSinceUpdate = 30;
          if (shouldShowNudge(habit.id, daysSinceUpdate)) {
            showNudgeForHabit(habit, daysSinceUpdate, allUsersStats);
            break; // Show only one nudge at a time
          }
        } else {
          // Check the most recent completion
          const mostRecentCompletion = habitCompletions[0];
          const lastUpdateDate = new Date(mostRecentCompletion.date);
          const today = new Date();
          const daysSinceUpdate = Math.floor((today.getTime() - lastUpdateDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSinceUpdate >= 14 && shouldShowNudge(habit.id, daysSinceUpdate)) {
            showNudgeForHabit(habit, daysSinceUpdate, allUsersStats);
            break; // Show only one nudge at a time
          }
        }
      }
    } catch (error) {
      console.error('Error checking for nudges:', error);
    }
  };

  const shouldShowNudge = (habitId: string, daysSinceUpdate: number): boolean => {
    // Don't show nudges too frequently - only once every 3 days after the 14-day threshold
    const lastNudgeKey = `lastNudge_${habitId}`;
    const lastNudgeDate = localStorage.getItem(lastNudgeKey);
    
    if (lastNudgeDate) {
      const daysSinceLastNudge = Math.floor((Date.now() - parseInt(lastNudgeDate)) / (1000 * 60 * 60 * 24));
      return daysSinceLastNudge >= 3;
    }
    
    return true; // First nudge for this habit
  };

  const showNudgeForHabit = (habit: Habit, daysSinceUpdate: number, allUsersStats?: any[]) => {
    // Calculate comparison stats
    let comparisonStats;
    if (allUsersStats && allUsersStats.length > 0) {
      const uniqueUsers = new Set(allUsersStats.map(stat => stat.user_id));
      const totalActiveUsers = uniqueUsers.size;
      const averageCompletionsThisWeek = Math.round(allUsersStats.length / Math.max(totalActiveUsers, 1));
      
      comparisonStats = {
        totalActiveUsers,
        averageCompletionsThisWeek
      };
    }

    // Select a random nudge message
    const randomMessage = nudgeMessages[Math.floor(Math.random() * nudgeMessages.length)]
      .replace('{habitName}', habit.name.toLowerCase())
      .replace('{days}', daysSinceUpdate.toString());

    setNudgeData({
      habit,
      daysSinceUpdate,
      message: randomMessage,
      comparisonStats
    });
    
    setShowNudgeModal(true);
    
    // Store the nudge timestamp
    const lastNudgeKey = `lastNudge_${habit.id}`;
    localStorage.setItem(lastNudgeKey, Date.now().toString());
  };

  const dismissNudge = () => {
    setShowNudgeModal(false);
    setNudgeData(null);
  };

  const updateHabitCompletion = (habitId: string, date: Date, data: any) => {
    const dateKey = getDateKey(date);
    const completionKey = `${dateKey}-${habitId}`;
    
    // Store changes locally without saving to database
    setPendingChanges(prev => ({
      ...prev,
      [completionKey]: {
        user_id: currentUser.id,
        habit_id: habitId,
        date: dateKey,
        data
      }
    }));
  };

  const isHabitNewlyCompleted = (habit: Habit, previousData: any, newData: any): boolean => {
    const wasCompleted = isHabitCompleted(habit, previousData);
    const isNowCompleted = isHabitCompleted(habit, newData);
    return !wasCompleted && isNowCompleted;
  };

  const isHabitCompleted = (habit: Habit, data: any): boolean => {
    if (!data) return false;
    
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

  const triggerConfetti = (habitType: string) => {
    const colorMap: { [key: string]: string[] } = {
      book: ['#A0522D', '#D2B48C', '#8B4513'],
      running: ['#00FF00', '#32CD32', '#ADFF2F'],
      ai_learning: ['#00FFFF', '#00BFFF', '#8A2BE2'],
      job_search: ['#FFD700', '#DAA520', '#B8860B'],
      swimming: ['#1E90FF', '#87CEEB', '#ADD8E6'],
      weight: ['#800080', '#EE82EE', '#DDA0DD'],
      exercise: ['#FF4500', '#FF6347', '#FF7F50'],
      instagram: ['#FF1493', '#FF69B4', '#FFC0CB']
    };
    
    setConfettiColors(colorMap[habitType] || ['#3B82F6']);
    setShowConfetti(true);
    
    setTimeout(() => {
      setShowConfetti(false);
    }, 2000);
  };

  const saveAllChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) return;
    
    setSaving(true);
    try {
      // Save all pending changes
      const changes = Object.values(pendingChanges);
      
      const { data: savedCompletions, error } = await supabase
        .from('habit_completions')
        .upsert(changes, {
          onConflict: 'habit_id,date'
        })
        .select();

      if (error) throw error;

      // Check for new completions and trigger confetti
      savedCompletions?.forEach(completion => {
        const habit = habits.find(h => h.id === completion.habit_id);
        if (habit) {
          const completionKey = `${completion.date}-${completion.habit_id}`;
          const previousCompletion = completions[completionKey]?.data;
          
          if (isHabitNewlyCompleted(habit, previousCompletion, completion.data)) {
            triggerConfetti(habit.type);
          }
        }
      });
      // Update local completions state
      const updatedCompletions = { ...completions };
      savedCompletions?.forEach(completion => {
        const key = `${completion.date}-${completion.habit_id}`;
        updatedCompletions[key] = completion;
      });
      setCompletions(updatedCompletions);
      
      // Clear pending changes
      setPendingChanges({});
      
      // Show success feedback
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving changes:', error);
    } finally {
      setSaving(false);
    }
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
  };

  const getHabitCompletion = (habitId: string, date: Date) => {
    const dateKey = getDateKey(date);
    const completionKey = `${dateKey}-${habitId}`;
    
    // Return pending changes if available, otherwise saved data
    if (pendingChanges[completionKey]) {
      return pendingChanges[completionKey].data;
    }
    return completions[completionKey]?.data;
  };

  const getDayCompletionCount = (): number => {
    return habits.reduce((count, habit) => {
      const completion = getHabitCompletion(habit.id, currentDate);
      if (!completion) return count;

      // Check if habit is completed based on type
      switch (habit.type) {
        case 'book':
          return count + (completion.pages_read > 0 ? 1 : 0);
        case 'running':
          return count + (completion.kilometers > 0 ? 1 : 0);
        case 'ai_learning':
          return count + (completion.completed ? 1 : 0);
        case 'job_search':
          return count + (completion.applied_for_job || completion.sought_reference || completion.updated_cv ? 1 : 0);
        case 'swimming':
          return count + (completion.hours > 0 ? 1 : 0);
        case 'weight':
          return count + (completion.weight_kg > 0 ? 1 : 0);
        case 'exercise':
          return count + (completion.minutes > 0 ? 1 : 0);
        default:
          return count;
      }
    }, 0);
  };

  const getDayStats = () => {
    return habits.map(habit => {
      const completion = getHabitCompletion(habit.id, currentDate);
      let isCompleted = false;
      let value = '';

      if (completion) {
        switch (habit.type) {
          case 'book':
            isCompleted = completion.pages_read > 0;
            value = completion.pages_read > 0 ? `${completion.pages_read} pages` : '';
            break;
          case 'running':
            isCompleted = completion.kilometers > 0;
            value = completion.kilometers > 0 ? `${completion.kilometers} km` : '';
            break;
          case 'ai_learning':
            isCompleted = completion.completed;
            value = completion.topic || '';
            break;
          case 'job_search':
            isCompleted = completion.applied_for_job || completion.sought_reference || completion.updated_cv;
            const activities = [];
            if (completion.applied_for_job) activities.push('Job');
            if (completion.sought_reference) activities.push('Ref');
            if (completion.updated_cv) activities.push('CV');
            value = activities.join(', ');
            break;
          case 'swimming':
            isCompleted = completion.hours > 0;
            value = completion.hours > 0 ? `${completion.hours} hrs` : '';
            break;
          case 'weight':
            isCompleted = completion.weight_kg > 0;
            value = completion.weight_kg > 0 ? `${completion.weight_kg} kg` : '';
            break;
          case 'exercise':
            isCompleted = completion.minutes > 0;
            value = completion.minutes > 0 ? `${completion.minutes} min` : '';
            break;
        }
      }

      return { habit, isCompleted, value };
    });
  };

  const isToday = currentDate.toDateString() === new Date().toDateString();
  const canEdit = isWithinSevenDays(currentDate);
  const dayStats = getDayStats();
  const completedCount = getDayCompletionCount();
  const hasUnsavedChanges = Object.keys(pendingChanges).length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (habits.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 text-center">
        <Book className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-gray-900 mb-2">No Habits Yet</h3>
        <p className="text-sm text-gray-600 mb-4">Get started by adding your first habit in the settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Nudge Modal */}
      {showNudgeModal && nudgeData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 relative animate-pulse">
            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Friendly Reminder!</h3>
            </div>
            
            <div className="text-center mb-4">
              <p className="text-gray-700 mb-3">{nudgeData.message}</p>
              
              {nudgeData.comparisonStats && (
                <div className="bg-blue-50 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Community Update</span>
                  </div>
                  <div className="text-sm text-blue-800">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <TrendingUp className="w-3 h-3" />
                      <span>{nudgeData.comparisonStats.totalActiveUsers} friends are staying active</span>
                    </div>
                    <div className="text-xs text-blue-600">
                      Average: {nudgeData.comparisonStats.averageCompletionsThisWeek} completions this week
                    </div>
                  </div>
                </div>
              )}
              
              <div className="text-xs text-gray-500 mb-4">
                Last update: {nudgeData.daysSinceUpdate} days ago
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={dismissNudge}
                className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Maybe Later
              </button>
              <button
                onClick={() => {
                  dismissNudge();
                  // Optionally navigate to today's date for the habit
                  setCurrentDate(new Date());
                }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors font-medium"
              >
                Let's Do This! 🚀
              </button>
            </div>
            
            <button
              onClick={dismissNudge}
              className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">🎉 Celebration Rewards</h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <p>Complete any habit to unlock a special celebration animation!</p>
              <div className="space-y-2">
                <p><strong>Weekly Targets & How to Trigger Celebrations:</strong></p>
                <ul className="ml-4 space-y-1">
                  <li>• <strong>Reading:</strong> ~75 pages/week - Log any pages read</li>
                  <li>• <strong>Running:</strong> ~10 km/week - Log any distance covered</li>
                  <li>• <strong>AI Learning:</strong> ~2 topics/week - Mark a topic as completed</li>
                  <li>• <strong>Job Search:</strong> ~5 activities/week - Complete any activity</li>
                  <li>• <strong>Swimming:</strong> ~5 hours/week - Log any time spent</li>
                  <li>• <strong>Weight:</strong> ~150 min exercise/week - Log weight or exercise</li>
                  <li>• <strong>Exercise:</strong> ~200 min/week - Log any workout time</li>
                  <li>• <strong>Instagram:</strong> ~75 followers/week - Update follower count</li>
                </ul>
              </div>
              <p className="text-xs text-gray-500 italic">Weekly targets are based on realistic yearly goals. Each habit has its own unique celebration style!</p>
            </div>
          </div>
        </div>
      )}
      
      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          colors={confettiColors}
          numberOfPieces={100}
          recycle={false}
          gravity={0.3}
        />
      )}
      
      {/* Day Header */}
      <div className="bg-white rounded-xl shadow-sm p-4 border-2 border-black">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigateDay('prev')}
              className="p-3 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors touch-manipulation border-2 border-black hover:border-green-600"
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
            <button
              onClick={() => navigateDay('next')}
              className="p-3 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors touch-manipulation border-2 border-black hover:border-green-600"
            >
              <ChevronRight className="w-7 h-7" />
            </button>
          </div>
          <div className="flex items-center space-x-2">
            {!isToday && (
              <button
                onClick={goToToday}
                className="px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors touch-manipulation border-2 border-black hover:border-green-600"
              >
                Today
              </button>
            )}
            {canEdit && (
              <button
                onClick={saveAllChanges}
                disabled={!hasUnsavedChanges || saving}
                className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors touch-manipulation border-2 ${
                  hasUnsavedChanges
                    ? 'bg-gradient-to-r from-green-600 to-lime-600 text-white hover:from-green-700 hover:to-lime-700 border-black'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-400'
                } ${saveSuccess ? 'bg-green-600 hover:bg-green-600' : ''}`}
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : saveSuccess ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>
                  {saving ? 'Saving...' : saveSuccess ? 'Saved!' : hasUnsavedChanges ? 'Save' : 'Saved'}
                </span>
              </button>
            )}
            {/* Info Button - moved here */}
            <button
              onClick={() => setShowInfoModal(true)}
              className="w-8 h-8 bg-gradient-to-br from-green-500 to-lime-500 bg-opacity-20 text-green-600 rounded-full flex items-center justify-center hover:bg-opacity-30 transition-colors backdrop-blur-sm border-2 border-black hover:border-green-600"
              title="How to unlock celebrations"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-1">{dateString}</h2>
          <div className="flex items-center justify-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isToday ? 'bg-blue-500' : 'bg-gray-300'}`} />
            <span className="text-sm text-gray-600">
              {completedCount} of {habits.length} habits completed
              {hasUnsavedChanges && (
                <span className="ml-2 text-orange-600 font-medium">• Unsaved changes</span>
              )}
            </span>
          </div>
        </div>

        {/* Day Habits */}
        <div className="space-y-4">
          {dayStats.map(({ habit, isCompleted, value }) => (
            <div
              key={habit.id}
              className={`p-4 rounded-lg border-2 border-black transition-all ${
                isCompleted 
                  ? 'border-green-600 bg-green-50 shadow-lg' 
                  : 'border-black bg-white hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: habit.color }}
                  />
                  <div>
                    <div className="space-y-1">
                      <h3 className="text-base font-medium text-gray-900">{habit.name}</h3>
                      {habit.target && (
                        <p className="text-sm text-gray-600">{habit.target}</p>
                      )}
                      <p className="text-xs text-gray-500 capitalize">
                        {habit.type.replace('_', ' ')}
                      </p>
                    </div>
                    {value && (
                      <p className="text-sm text-gray-600 mt-1">{value}</p>
                    )}
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  isCompleted 
                    ? 'border-green-500 bg-green-500' 
                    : 'border-gray-300'
                }`}>
                  {isCompleted && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
              </div>
              
              <HabitInput
                habit={habit}
                date={currentDate}
                completion={getHabitCompletion(habit.id, currentDate)}
                onUpdate={(data) => updateHabitCompletion(habit.id, currentDate, data)}
                disabled={!canEdit}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarView;