import React, { useState, useEffect } from 'react';
import { Save, Plus, X, Zap, CheckCircle, AlertCircle, Info, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User, Habit, HabitType, HABIT_COLORS } from '../utils/types';

interface HabitSettingsProps {
  currentUser: User;
}

interface DefaultHabitSuggestion {
  name: string;
  type: HabitType;
  target: string;
  color: string;
}

interface ConfirmationState {
  isOpen: boolean;
  suggestions: DefaultHabitSuggestion[];
  editingIndex: number | null;
}

const HabitSettings: React.FC<HabitSettingsProps> = ({ currentUser }) => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  
  // New confirmation system state
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>({
    isOpen: false,
    suggestions: [],
    editingIndex: null
  });
  
  // Standardized 3-field habit creation
  const [newHabit, setNewHabit] = useState({ 
    name: '', 
    target: '',
    type: 'exercise' as HabitType, 
    color: HABIT_COLORS[0]
  });
  const [showAddCustom, setShowAddCustom] = useState(false);

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

  // Get default habit suggestions for user
  const getDefaultSuggestions = (): DefaultHabitSuggestion[] => {
    const defaultHabits: { [key: string]: DefaultHabitSuggestion[] } = {
      'Anuj Nawal': [
        { name: 'Read 6 Books', type: 'book', target: '6 books', color: HABIT_COLORS[0] },
        { name: 'Gym 12 Times/Month', type: 'exercise', target: '144 sessions', color: HABIT_COLORS[1] },
        { name: 'Learn AI', type: 'ai_learning', target: '96 topics', color: HABIT_COLORS[2] }
      ],
      'Suraj Rarath': [
        { name: 'Half Marathon Training', type: 'running', target: '1200 km', color: HABIT_COLORS[0] },
        { name: 'Swimming Practice', type: 'swimming', target: '240 hours', color: HABIT_COLORS[1] },
        { name: 'Read 6 Books', type: 'book', target: '6 books', color: HABIT_COLORS[2] }
      ],
      'Krishna Amar': [
        { name: 'Run 500km/Year', type: 'running', target: '500 km', color: HABIT_COLORS[0] },
        { name: 'Read 10 Books', type: 'book', target: '10 books', color: HABIT_COLORS[1] },
        { name: 'Weight Loss (10kg)', type: 'weight', target: '75 kg', color: HABIT_COLORS[2] }
      ],
      'Ritwik Garg': [
        { name: 'Job Search', type: 'job_search', target: '240 activities', color: HABIT_COLORS[0] },
        { name: 'Learn AI', type: 'ai_learning', target: '96 topics', color: HABIT_COLORS[1] },
        { name: 'Instagram Growth', type: 'instagram', target: '5000 followers', color: HABIT_COLORS[2] }
      ]
    };

    // Try exact match first, then partial match
    let suggestions = defaultHabits[currentUser.name] || [];
    
    if (suggestions.length === 0) {
      const nameKey = Object.keys(defaultHabits).find(key => 
        currentUser.name.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(currentUser.name.toLowerCase())
      );
      if (nameKey) {
        suggestions = defaultHabits[nameKey];
      }
    }

    // Filter out habits that already exist
    const existingHabitNames = habits.map(h => h.name.toLowerCase());
    return suggestions.filter(suggestion => 
      !existingHabitNames.includes(suggestion.name.toLowerCase())
    );
  };

  // Show default habit confirmation dialog
  const showDefaultConfirmation = () => {
    const suggestions = getDefaultSuggestions();
    
    if (suggestions.length === 0) {
      showNotification('info', `No default habits available for "${currentUser.name}". All suggestions may already exist.`);
      return;
    }

    setConfirmationState({
      isOpen: true,
      suggestions,
      editingIndex: null
    });
  };

  // Update suggestion in confirmation dialog
  const updateSuggestion = (index: number, updates: Partial<DefaultHabitSuggestion>) => {
    setConfirmationState(prev => ({
      ...prev,
      suggestions: prev.suggestions.map((suggestion, i) => 
        i === index ? { ...suggestion, ...updates } : suggestion
      )
    }));
  };

  // Confirm and save suggested habits
  const confirmDefaultHabits = async () => {
    setSaving(true);
    try {
      const habitsToAdd = confirmationState.suggestions.map(suggestion => ({
        user_id: currentUser.id,
        name: suggestion.name,
        type: suggestion.type,
        color: suggestion.color,
        target: suggestion.target
      }));

      const { data, error } = await supabase
        .from('habits')
        .insert(habitsToAdd)
        .select();

      if (error) throw error;

      setHabits([...habits, ...(data || [])]);
      setConfirmationState({ isOpen: false, suggestions: [], editingIndex: null });
      showNotification('success', `Successfully added ${habitsToAdd.length} habit${habitsToAdd.length > 1 ? 's' : ''}!`);
      
    } catch (error) {
      console.error('Error adding default habits:', error);
      showNotification('error', 'Failed to add habits. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const addHabit = async () => {
    if (!newHabit.name.trim() || habits.length >= 6) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('habits')
        .insert([{
          user_id: currentUser.id,
          name: newHabit.name.trim(),
          type: newHabit.type,
          color: newHabit.color,
          target: newHabit.target.trim() || null
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

  const updateHabit = async (habitId: string, updates: Partial<Habit>) => {
    if (!updates.name?.trim() && updates.name !== undefined) {
      showNotification('error', 'Habit name cannot be empty.');
      return;
    }
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('habits')
        .update(updates)
        .eq('id', habitId);

      if (error) throw error;

      setHabits(habits.map(h => h.id === habitId ? { ...h, ...updates } : h));
      showNotification('success', 'Habit updated successfully!');
    } catch (error) {
      console.error('Error updating habit:', error);
      showNotification('error', 'Failed to update habit. Please try again.');
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

      {/* Default Habits Confirmation Dialog */}
      {confirmationState.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Default Habits</h3>
              <p className="text-sm text-gray-600 mt-1">
                Review and customize these suggested habits before adding them to your account.
              </p>
            </div>
            
            <div className="p-4 space-y-4">
              {confirmationState.suggestions.map((suggestion, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg">
                  <div className="space-y-3">
                    {/* Habit Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Habit Name
                      </label>
                      <input
                        type="text"
                        value={suggestion.name}
                        onChange={(e) => updateSuggestion(index, { name: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="Enter habit name"
                      />
                    </div>
                    
                    {/* Target */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Annual Target
                      </label>
                      <input
                        type="text"
                        value={suggestion.target}
                        onChange={(e) => updateSuggestion(index, { target: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="Enter yearly target"
                      />
                    </div>
                    
                    {/* Tracking Method */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tracking Method
                      </label>
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
                    </div>
                    
                    {/* Color Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Color
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
                onClick={() => setConfirmationState({ isOpen: false, suggestions: [], editingIndex: null })}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDefaultHabits}
                disabled={saving || confirmationState.suggestions.some(s => !s.name.trim())}
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
        
        {/* Suggested Habits Section */}
        <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-medium text-blue-900 mb-1">Suggested Habits</h3>
              <p className="text-sm text-blue-700">
                Get personalized habit suggestions for {currentUser.name.split(' ')[0]}
              </p>
            </div>
            <button
              onClick={showDefaultConfirmation}
              disabled={habits.length >= 6}
              className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="w-4 h-4" />
              <span>Get Suggestions</span>
            </button>
          </div>
        </div>
        
        {/* Add Custom Habit Button */}
        {!showAddCustom && habits.length < 6 && (
          <div className="mb-4">
            <button
              onClick={() => setShowAddCustom(true)}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Custom Habit</span>
            </button>
          </div>
        )}

        {/* Custom Habit Form */}
        {showAddCustom && (
          <div className="mb-4 p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
            <h3 className="text-base font-medium text-gray-900 mb-3">Create Custom Habit</h3>
            <p className="text-sm text-gray-600 mb-4">Design your own habit with these three essential fields:</p>
            
            <div className="space-y-3">
              {/* Field 1: Habit Name */}
              <input
                type="text"
                value={newHabit.name}
                onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="1. Habit Name (e.g., Morning Meditation, Daily Reading)"
              />
              
              {/* Field 2: Annual Target */}
              <input
                type="text"
                value={newHabit.target}
                onChange={(e) => setNewHabit({ ...newHabit, target: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="2. Annual Target (e.g., 10 books, 500 km, 75 kg)"
              />
              
              {/* Field 3: Tracking Method */}
              <select
                value={newHabit.type}
                onChange={(e) => setNewHabit({ ...newHabit, type: e.target.value as HabitType })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="" disabled>3. Select Tracking Method</option>
                {habitTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              
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
                  onClick={addHabit}
                  disabled={saving || !newHabit.name.trim()}
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
                <p className="text-xs">Use "Get Suggestions" or "Add Custom Habit" to start tracking!</p>
              </div>
            )}
            <div className="space-y-4">
              {habits.map((habit) => (
                <div key={habit.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">Standardized 3-Field Habit:</h4>
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: habit.color }}
                    />
                  </div>
                  
                  {/* Field 1: Habit Name */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">1. Habit Name</label>
                    <input
                      type="text"
                      value={habit.name}
                      onChange={(e) => {
                        updateHabit(habit.id, { name: e.target.value });
                      }}
                      className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="Enter habit name"
                    />
                  </div>
                  
                  {/* Field 2: Annual Target */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">2. Annual Target</label>
                    <input
                      type="text"
                      value={habit.target || ''}
                      onChange={(e) => {
                        updateHabit(habit.id, { target: e.target.value || null });
                      }}
                      className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="Enter yearly target (e.g., 10 books, 500 km, 75 kg)"
                    />
                  </div>
                  
                  {/* Field 3: Tracking Method */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">3. Tracking Method</label>
                    <select
                      value={habit.type}
                      onChange={(e) => {
                        updateHabit(habit.id, { type: e.target.value as HabitType });
                      }}
                      className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      {habitTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {habitTypes.find(t => t.value === habit.type)?.description}
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
                            updateHabit(habit.id, { color });
                          }}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${
                            habit.color === color ? 'border-gray-600 scale-110' : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Delete Button */}
                  <div className="flex justify-end">
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
              ))}
            </div>
          </div>
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