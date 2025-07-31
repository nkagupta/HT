import React, { useState, useEffect } from 'react';
import { Save, Plus, X, Zap, CheckCircle, AlertCircle, Info, Settings, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User, Habit, HabitType, HABIT_COLORS } from '../utils/types';

interface HabitSettingsProps {
  currentUser: User;
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void;
}

/**
 * 3-Field Habit Suggestion Structure
 */
interface HabitSuggestion {
  name: string;        // Field 1: What you're tracking
  target: string;      // Field 2: Your yearly objective  
  type: HabitType;     // Field 3: How progress is measured
  color: string;       // Visual identification only
}

interface EditingHabit {
  id: string;
  name: string;
  target: string;
  type: HabitType;
  color: string;
}

interface ConfirmationState {
  isOpen: boolean;
  suggestions: HabitSuggestion[];
}

const HabitSettings: React.FC<HabitSettingsProps> = ({ currentUser, onUnsavedChangesChange }) => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingHabits, setEditingHabits] = useState<{ [key: string]: EditingHabit }>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  
  // Confirmation system for suggestions
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>({
    isOpen: false,
    suggestions: []
  });
  
  // Custom habit creation with 3 fields
  const [newHabit, setNewHabit] = useState({ 
    name: '',           // Field 1: Habit Name 
    target: '',         // Field 2: Annual Target
    type: 'exercise' as HabitType,  // Field 3: Tracking Method
    color: HABIT_COLORS[0]
  });
  const [showAddCustom, setShowAddCustom] = useState(false);

  // Manage entries state
  const [selectedDateForManagement, setSelectedDateForManagement] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedHabitIdForManagement, setSelectedHabitIdForManagement] = useState('');
  const [loadedCompletionForManagement, setLoadedCompletionForManagement] = useState<HabitCompletion | null>(null);
  const [isEditingLoadedEntry, setIsEditingLoadedEntry] = useState(false);
  const [editFormData, setEditFormData] = useState<HabitCompletionData | null>(null);
  const [entryManagementError, setEntryManagementError] = useState<string | null>(null);

  useEffect(() => {
    if (onUnsavedChangesChange) {
      onUnsavedChangesChange(hasUnsavedChanges);
    }
  }, [hasUnsavedChanges, onUnsavedChangesChange]);

  const habitTypes: { value: HabitType; label: string; description: string }[] = [
    { value: 'book', label: 'Reading Books', description: 'Track pages read and books finished' },
    { value: 'running', label: 'Running/Trekking', description: 'Track kilometers covered' },
    { value: 'ai_learning', label: 'AI Learning', description: 'Track topics studied' },
    { value: 'job_search', label: 'Job Search', description: 'Track applications and CV updates' },
    { value: 'swimming', label: 'Swimming', description: 'Track hours spent swimming' },
    { value: 'weight', label: 'Weight Tracking', description: 'Track weekly weight (Sundays only)' },
    { value: 'exercise', label: 'Exercise', description: 'Track minutes of exercise' },
    { value: 'instagram', label: 'Instagram Growth', description: 'Track follower count' }
  ];

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const updateHasUnsavedChanges = () => {
    const hasChanges = Object.keys(editingHabits).length > 0;
    setHasUnsavedChanges(hasChanges);
  };

  const startEditingHabit = (habit: Habit) => {
    setEditingHabits(prev => ({
      ...prev,
      [habit.id]: {
        id: habit.id,
        name: habit.name,
        target: habit.target || '',
        type: habit.type,
        color: habit.color
      }
    }));
    setHasUnsavedChanges(true);
  };

  const updateEditingHabit = (habitId: string, updates: Partial<EditingHabit>) => {
    setEditingHabits(prev => ({
      ...prev,
      [habitId]: { ...prev[habitId], ...updates }
    }));
  };

  const saveHabitChanges = async (habitId: string) => {
    const editingHabit = editingHabits[habitId];
    if (!editingHabit) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('habits')
        .update({
          name: editingHabit.name,
          target: editingHabit.target || null,
          type: editingHabit.type,
          color: editingHabit.color
        })
        .eq('id', habitId);

      if (error) throw error;

      setHabits(habits.map(h => h.id === habitId ? { ...h, ...editingHabit, target: editingHabit.target || null } : h));
      
      setEditingHabits(prev => {
        const newState = { ...prev };
        delete newState[habitId];
        return newState;
      });
      
      updateHasUnsavedChanges();
      showNotification('success', 'Habit updated successfully!');
    } catch (error) {
      console.error('Error updating habit:', error);
      showNotification('error', 'Failed to update habit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const cancelHabitChanges = (habitId: string) => {
    setEditingHabits(prev => {
      const newState = { ...prev };
      delete newState[habitId];
      return newState;
    });
    updateHasUnsavedChanges();
  };

  useEffect(() => {
    loadHabits();
  }, [currentUser.id]);

  const loadHabits = async () => {
    try {
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at');

      if (error) throw error;
      setHabits(data || []);
    } catch (error) {
      console.error('Error loading habits:', error);
      showNotification('error', 'Failed to load habits. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Redesigned Default Suggestions Based on 3-Field Structure
   * SUGGESTIONS ONLY - require user confirmation
   */
  const getPersonalizedSuggestions = (): HabitSuggestion[] => {
    const suggestionsByUser: { [key: string]: HabitSuggestion[] } = {
      'Anuj Nawal': [
        { 
          name: 'Daily Reading Habit', 
          target: '6 books per year', 
          type: 'book', 
          color: HABIT_COLORS[0] 
        },
        { 
          name: 'Regular Gym Sessions', 
          target: '144 sessions per year', 
          type: 'exercise', 
          color: HABIT_COLORS[1] 
        },
        { 
          name: 'AI Learning Journey', 
          target: '96 topics per year', 
          type: 'ai_learning', 
          color: HABIT_COLORS[2] 
        }
      ],
      'Suraj Rarath': [
        { 
          name: 'Marathon Training', 
          target: '600 km per year', 
          type: 'running', 
          color: HABIT_COLORS[0] 
        },
        { 
          name: 'Swimming Practice', 
          target: '240 hours per year', 
          type: 'swimming', 
          color: HABIT_COLORS[1] 
        },
        { 
          name: 'Reading Challenge', 
          target: '12 books per year', 
          type: 'book', 
          color: HABIT_COLORS[2] 
        }
      ],
      'Krishna Amar': [
        { 
          name: 'Running Goal', 
          target: '500 km per year', 
          type: 'running', 
          color: HABIT_COLORS[0] 
        },
        { 
          name: 'Reading Goal', 
          target: '10 books per year', 
          type: 'book', 
          color: HABIT_COLORS[1] 
        },
        { 
          name: 'Weight Management', 
          target: '75 kg target weight', 
          type: 'weight', 
          color: HABIT_COLORS[2] 
        }
      ],
      'Ritwik Garg': [
        { 
          name: 'Job Search Activities', 
          target: '240 activities per year', 
          type: 'job_search', 
          color: HABIT_COLORS[0] 
        },
        { 
          name: 'AI Skill Development', 
          target: '96 topics per year', 
          type: 'ai_learning', 
          color: HABIT_COLORS[1] 
        },
        { 
          name: 'Instagram Growth', 
          target: '5000 followers', 
          type: 'instagram', 
          color: HABIT_COLORS[2] 
        }
      ]
    };

    // Try exact match first, then partial match
    let suggestions = suggestionsByUser[currentUser.name] || [];
    
    if (suggestions.length === 0) {
      const nameKey = Object.keys(suggestionsByUser).find(key => 
        currentUser.name.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(currentUser.name.toLowerCase())
      );
      if (nameKey) {
        suggestions = suggestionsByUser[nameKey];
      }
    }

    // Filter out suggestions that match existing habit names
    const existingHabitNames = habits.map(h => h.name.toLowerCase());
    return suggestions.filter(suggestion => 
      !existingHabitNames.includes(suggestion.name.toLowerCase())
    );
  };

  // Show suggestion confirmation dialog (NO automatic addition)
  const showSuggestionDialog = () => {
    const suggestions = getPersonalizedSuggestions();
    
    if (suggestions.length === 0) {
      showNotification('info', `No new suggestions available. You may have already added similar habits.`);
      return;
    }

    setConfirmationState({
      isOpen: true,
      suggestions
    });
  };

  // Update suggestion in confirmation dialog
  const updateSuggestion = (index: number, updates: Partial<HabitSuggestion>) => {
    setConfirmationState(prev => ({
      ...prev,
      suggestions: prev.suggestions.map((suggestion, i) => 
        i === index ? { ...suggestion, ...updates } : suggestion
      )
    }));
  };

  // Only add habits after explicit user confirmation
  const confirmSuggestions = async () => {
    setSaving(true);
    try {
      const habitsToAdd = confirmationState.suggestions.map(suggestion => ({
        user_id: currentUser.id,      
        name: suggestion.name,        // Field 1: Habit Name
        target: suggestion.target,    // Field 2: Annual Target  
        type: suggestion.type,        // Field 3: Tracking Method
        color: suggestion.color
      }));

      const { data, error } = await supabase
        .from('habits')
        .insert(habitsToAdd)
        .select();

      if (error) throw error;

      setHabits([...habits, ...(data || [])]);
      setConfirmationState({ isOpen: false, suggestions: [] });
      showNotification('success', `Successfully added ${habitsToAdd.length} habit${habitsToAdd.length > 1 ? 's' : ''}!`);
      
    } catch (error) {
      console.error('Error adding suggested habits:', error);
      showNotification('error', 'Failed to add habits. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Add custom habit with 3 required fields
  const addCustomHabit = async () => {
    if (!newHabit.name.trim() || !newHabit.target.trim() || habits.length >= 6) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('habits')
        .insert([{
          user_id: currentUser.id,
          name: newHabit.name.trim(),       // Field 1: Habit Name
          target: newHabit.target.trim(),   // Field 2: Annual Target
          type: newHabit.type,              // Field 3: Tracking Method  
          color: newHabit.color
        }])
        .select()
        .single();

      if (error) throw error;

      setHabits([...habits, data]);
      setNewHabit({ name: '', target: '', type: 'exercise', color: HABIT_COLORS[0] });
      setShowAddCustom(false);
      showNotification('success', 'Habit added successfully!');
    } catch (error) {
      console.error('Error adding habit:', error);
      showNotification('error', 'Failed to add habit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeHabit = async (habitId: string) => {
    if (!confirm('Are you sure you want to delete this habit? This will also remove all associated tracking data.')) {
      return;
    }
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId);

      if (error) throw error;

      setHabits(habits.filter(h => h.id !== habitId));
      showNotification('success', 'Habit removed successfully!');
    } catch (error) {
      console.error('Error removing habit:', error);
      showNotification('error', 'Failed to remove habit. Please try again.');
    } finally {
      setSaving(false);
    }
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
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 left-4 right-4 z-50 p-3 rounded-lg shadow-lg border flex items-center space-x-2 ${
          notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {notification.type === 'success' && <CheckCircle className="w-5 h-5" />}
          {notification.type === 'error' && <AlertCircle className="w-5 h-5" />}
          {notification.type === 'info' && <Info className="w-5 h-5" />}
          <span className="text-sm flex-1">{notification.message}</span>
          <button 
            onClick={() => setNotification(null)}
            className="text-gray-500 hover:text-gray-700 touch-manipulation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Suggestion Confirmation Dialog */}
      {confirmationState.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Habit Suggestions</h3>
              <p className="text-sm text-gray-600 mt-1">
                Review and customize these suggested habits. Each habit has exactly 3 fields:
              </p>
              <div className="text-xs text-gray-500 mt-2 space-y-1">
                <div>• <strong>Habit Name:</strong> What you're tracking</div>
                <div>• <strong>Target:</strong> Your yearly objective</div>
                <div>• <strong>Tracking Method:</strong> How progress is measured</div>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              {confirmationState.suggestions.map((suggestion, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg">
                  <div className="space-y-3">
                    {/* Field 1: Habit Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Habit Name</label>
                      <input
                        type="text"
                        value={suggestion.name}
                        onChange={(e) => updateSuggestion(index, { name: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="What you're tracking"
                      />
                    </div>
                    
                    {/* Field 2: Annual Target */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Annual Target</label>
                      <input
                        type="text"
                        value={suggestion.target}
                        onChange={(e) => updateSuggestion(index, { target: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="Your yearly objective"
                      />
                    </div>
                    
                    {/* Field 3: Tracking Method */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tracking Method</label>
                      <select
                        value={suggestion.type}
                        onChange={(e) => updateSuggestion(index, { type: e.target.value as HabitType })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        {habitTypes.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        {habitTypes.find(t => t.value === suggestion.type)?.description}
                      </p>
                    </div>
                    
                    {/* Color Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Display Color
                      </label>
                      <div className="flex space-x-2">
                        {HABIT_COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => updateSuggestion(index, { color })}
                            className={`w-6 h-6 rounded-full border-2 ${
                              suggestion.color === color ? 'border-gray-600' : 'border-gray-300'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 border-t border-gray-200 flex space-x-3">
              <button
                onClick={() => setConfirmationState({ isOpen: false, suggestions: [] })}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSuggestions}
                disabled={saving || confirmationState.suggestions.some(s => !s.name.trim() || !s.target.trim())}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>{saving ? 'Adding...' : `Add ${confirmationState.suggestions.length} Habits`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Habit Settings</h2>
          <span className="text-sm text-gray-600">{habits.length}/6 habits</span>
        </div>
        
        {/* Add Custom Habit Button */}
        {!showAddCustom && habits.length < 6 && (
          <div className="mb-4">
            <button
              onClick={() => setShowAddCustom(true)}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Create Custom Habit</span>
            </button>
          </div>
        )}

        {/* Custom Habit Form */}
        {showAddCustom && (
          <div className="mb-4 p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
            <h3 className="text-base font-medium text-gray-900 mb-3">Create Custom Habit</h3>
            <p className="text-sm text-gray-600 mb-4">Design your habit with these three essential fields:</p>
            
            <div className="space-y-3">
              {/* Field 1: Habit Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Habit Name</label>
                <input
                  type="text"
                  value={newHabit.name}
                  onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="What you're tracking (e.g., Morning Reading, Daily Exercise)"
                />
              </div>
              
              {/* Field 2: Annual Target */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Annual Target</label>
                <input
                  type="text"
                  value={newHabit.target}
                  onChange={(e) => setNewHabit({ ...newHabit, target: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Your yearly objective (e.g., 12 books, 500 km, 75 kg)"
                />
              </div>
              
              {/* Field 3: Tracking Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tracking Method</label>
                <select
                  value={newHabit.type}
                  onChange={(e) => setNewHabit({ ...newHabit, type: e.target.value as HabitType })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="" disabled>Select how progress is measured</option>
                  {habitTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {newHabit.type && (
                  <p className="text-xs text-gray-500 mt-1">
                    {habitTypes.find(t => t.value === newHabit.type)?.description}
                  </p>
                )}
              </div>
              
              <div>
                <p className="text-sm text-gray-700 mb-2 font-medium">Choose Display Color:</p>
                <div className="flex space-x-2">
                  {HABIT_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewHabit({ ...newHabit, color })}
                      className={`w-8 h-8 rounded-full border-2 ${
                        newHabit.color === color ? 'border-gray-600' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={addCustomHabit}
                  disabled={saving || !newHabit.name.trim() || !newHabit.target.trim()}
                  className="flex-1 flex items-center justify-center space-x-2 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>Add Habit</span>
                </button>
                <button
                  onClick={() => {
                    setShowAddCustom(false);
                    setNewHabit({ name: '', target: '', type: 'exercise', color: HABIT_COLORS[0] });
                  }}
                  className="px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Current Habits List - PROPER 3-FIELD STRUCTURE */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">
              Your Habits ({habits.length}/6)
            </label>
            {habits.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <div className="w-12 h-12 mx-auto mb-3 text-gray-300">
                  <Target className="w-full h-full" />
                </div>
                <p className="text-sm">No habits created yet.</p>
                <p className="text-xs">Use "Get Suggestions" or "Create Custom Habit" to start tracking!</p>
              </div>
            )}
            <div className="space-y-4">
              {habits.map((habit) => {
                const isEditing = editingHabits[habit.id];
                const editingData = isEditing || habit;
                
                return (
                  <div key={habit.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-900">Habit Details</h4>
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: editingData.color }}
                      />
                    </div>
                    
                    {/* Habit Name */}
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Habit Name</label>
                      <input
                        type="text"
                        value={editingData.name}
                        onChange={(e) => {
                          if (!isEditing) startEditingHabit(habit);
                          updateEditingHabit(habit.id, { name: e.target.value });
                        }}
                        className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                        placeholder="What you're tracking"
                      />
                    </div>
                    
                    {/* Annual Target */}
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Annual Target</label>
                      <input
                        type="text"
                        value={editingData.target || ''}
                        onChange={(e) => {
                          if (!isEditing) startEditingHabit(habit);
                          updateEditingHabit(habit.id, { target: e.target.value });
                        }}
                        className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                        placeholder="Your yearly objective (e.g., 12 books, 500 km, 75 kg)"
                      />
                    </div>
                    
                    {/* Tracking Method */}
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tracking Method</label>
                      <select
                        value={editingData.type}
                        onChange={(e) => {
                          if (!isEditing) startEditingHabit(habit);
                          updateEditingHabit(habit.id, { type: e.target.value as HabitType });
                        }}
                        className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                      >
                        {habitTypes.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        {habitTypes.find(t => t.value === editingData.type)?.description}
                      </p>
                    </div>

                    {/* Color Selection */}
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Display Color</label>
                      <div className="flex flex-wrap gap-3">
                        {HABIT_COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => {
                              if (!isEditing) startEditingHabit(habit);
                              updateEditingHabit(habit.id, { color });
                            }}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${
                              editingData.color === color ? 'border-gray-600 scale-110' : 'border-gray-200'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex justify-between items-center">
                      {isEditing && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => saveHabitChanges(habit.id)}
                            disabled={saving}
                            className="flex items-center space-x-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                          >
                            <Save className="w-4 h-4" />
                            <span className="text-sm font-medium">Save</span>
                          </button>
                          <button
                            onClick={() => cancelHabitChanges(habit.id)}
                            className="flex items-center space-x-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                          >
                            <X className="w-4 h-4" />
                            <span className="text-sm font-medium">Cancel</span>
                          </button>
                        </div>
                      )}
                      <div className={isEditing ? 'ml-auto' : ''}>
                        <button
                          onClick={() => removeHabit(habit.id)}
                          disabled={saving}
                          className="flex items-center space-x-1 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 border border-red-200"
                        >
                          <X className="w-4 h-4" />
                          <span className="text-sm font-medium">Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Personalized Suggestions Section - Moved to bottom */}
        {getPersonalizedSuggestions().length > 0 && (
          <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium text-blue-900 mb-1">Personalized Suggestions</h3>
                <p className="text-sm text-blue-700">
                  Get habit suggestions tailored for {currentUser.name.split(' ')[0]}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  ✓ Suggestions only - you confirm before adding
                </p>
              </div>
              <button
                onClick={showSuggestionDialog}
                disabled={habits.length >= 6}
                className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Zap className="w-4 h-4" />
                <span>Get Suggestions</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manage Past Entries Section */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <h3 className="text-base font-semibold text-gray-900 mb-3">Manage Past Entries</h3>
        <p className="text-sm text-gray-600 mb-4">Edit or delete habit entries from previous days (within 14 days).</p>
        
        <div className="space-y-4">
          {/* Date and Habit Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
              <input
                type="date"
                value={selectedDateForManagement}
                onChange={(e) => setSelectedDateForManagement(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Habit</label>
              <select
                value={selectedHabitIdForManagement}
                onChange={(e) => setSelectedHabitIdForManagement(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              >
                <option value="">Choose a habit</option>
                {habits.map(habit => (
                  <option key={habit.id} value={habit.id}>{habit.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Load Entry Button */}
          <button
            onClick={handleLoadEntry}
            disabled={saving || !selectedDateForManagement || !selectedHabitIdForManagement}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Info className="w-4 h-4" />
            )}
            <span>Load Entry</span>
          </button>

          {/* Error Display */}
          {entryManagementError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {entryManagementError}
            </div>
          )}

          {/* Loaded Entry Display */}
          {loadedCompletionForManagement && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">
                  Entry for {new Date(selectedDateForManagement).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </h4>
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: habits.find(h => h.id === selectedHabitIdForManagement)?.color }}
                  />
                  <span className="text-sm text-gray-600">
                    {habits.find(h => h.id === selectedHabitIdForManagement)?.name}
                  </span>
                </div>
              </div>

              {/* Entry Data */}
              <div className="mb-4">
                {habits.find(h => h.id === selectedHabitIdForManagement) && editFormData && 
                  renderEntryData(
                    habits.find(h => h.id === selectedHabitIdForManagement)!,
                    editFormData,
                    isEditingLoadedEntry
                  )
                }
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                {!isEditingLoadedEntry ? (
                  <>
                    <button
                      onClick={handleEditEntry}
                      disabled={saving || !isWithinFourteenDays(new Date(selectedDateForManagement))}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={handleDeleteEntry}
                      disabled={saving}
                      className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Delete
                    </button>
                    {!isWithinFourteenDays(new Date(selectedDateForManagement)) && (
                      <div className="text-xs text-gray-500 flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Entries older than {new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
                          month: 'long', 
                          day: 'numeric' 
                        })} cannot be edited
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center space-x-1"
                    >
                      {saving ? (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Save className="w-3 h-3" />
                      )}
                      <span>Save Changes</span>
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tracking Method Reference */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <h3 className="text-base font-semibold text-gray-900 mb-3">Available Tracking Methods</h3>
        <p className="text-sm text-gray-600 mb-3">Choose how you want to measure and log your habit progress:</p>
        <div className="grid grid-cols-1 gap-2">
          {habitTypes.map(type => (
            <div key={type.value} className="p-2 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900">{type.label}</h4>
              <p className="text-sm text-gray-600">{type.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HabitSettings;