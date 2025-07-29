import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Book, Zap, Calendar, Save, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User, Habit, HabitCompletion, getDateKey, isWithinSevenDays } from '../utils/types';
import HabitInput from './HabitInput';

interface CalendarViewProps {
  currentUser: User;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  currentUser,
}) => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<{ [key: string]: HabitCompletion }>({});
  const [pendingChanges, setPendingChanges] = useState<{ [key: string]: any }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    return today;
  });
  
  const dateString = currentDate.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });

  useEffect(() => {
    loadHabitsAndCompletions();
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
      {/* Day Header */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigateDay('prev')}
              className="p-3 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors touch-manipulation"
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
            <button
              onClick={() => navigateDay('next')}
              className="p-3 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors touch-manipulation"
            >
              <ChevronRight className="w-7 h-7" />
            </button>
          </div>
          <div className="flex items-center space-x-2">
            {!isToday && (
              <button
                onClick={goToToday}
                className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-manipulation"
              >
                Today
              </button>
            )}
            {canEdit && (
              <button
                onClick={saveAllChanges}
                disabled={!hasUnsavedChanges || saving}
                className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors touch-manipulation ${
                  hasUnsavedChanges
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
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
              className={`p-4 rounded-lg border-2 transition-all ${
                isCompleted 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: habit.color }}
                  />
                  <div>
                    <h3 className="text-base font-medium text-gray-900">{habit.name}</h3>
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