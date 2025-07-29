import React, { useState, useEffect } from 'react';
import { Save, Plus, X, Palette, Zap, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User, Habit, HabitType, HABIT_COLORS } from '../utils/types';

interface HabitSettingsProps {
  currentUser: User;
}

const HabitSettings: React.FC<HabitSettingsProps> = ({ currentUser }) => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingDefaults, setAddingDefaults] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [newHabit, setNewHabit] = useState({ 
    name: '', 
    target: '',
    type: 'exercise' as HabitType, 
    color: HABIT_COLORS[0],
    custom_fields: [] as CustomField[]
  });
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [showCustomFields, setShowCustomFields] = useState(false);

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
    } finally {
      setLoading(false);
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
      setNewHabit({ name: '', type: 'exercise', color: HABIT_COLORS[0] });
      setNewHabit({ name: '', target: '', type: 'exercise', color: HABIT_COLORS[0], custom_fields: [] });
      setShowAddCustom(false);
      showNotification('success', 'Habit added successfully!');
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error adding habit:', error);
      showNotification('error', 'Failed to add habit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeHabit = async (habitId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId);

      if (error) throw error;

      setHabits(habits.filter(h => h.id !== habitId));
      showNotification('success', 'Habit removed successfully!');
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error removing habit:', error);
      showNotification('error', 'Failed to remove habit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateHabit = async (habitId: string, updates: Partial<Habit>) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('habits')
        .update(updates)
        .eq('id', habitId);

      if (error) throw error;

      setHabits(habits.map(h => h.id === habitId ? { ...h, ...updates } : h));
      setHasUnsavedChanges(false);
      showNotification('success', 'Habit updated successfully!');
    } catch (error) {
      console.error('Error updating habit:', error);
      showNotification('error', 'Failed to update habit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveAllChanges = async () => {
    if (!hasUnsavedChanges) return;
    
    setSaving(true);
    try {
      // Save all pending changes
      showNotification('success', 'All changes saved successfully!');
      setHasUnsavedChanges(false);
    } catch (error) {
      showNotification('error', 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const addDefaultHabits = async () => {
    setAddingDefaults(true);
    try {
      const defaultHabits: { [key: string]: Array<{ name: string; type: HabitType; color: string; target: string }> } = {
        'Anuj Nawal': [
          { name: 'Read 6 Books', type: 'book', color: HABIT_COLORS[0], target: '6 books' },
          { name: 'Gym 12 Times/Month', type: 'exercise', color: HABIT_COLORS[1], target: '144 sessions' },
          { name: 'Learn AI', type: 'ai_learning', color: HABIT_COLORS[2], target: '96 topics' }
        ],
        'Suraj Rarath': [
          { name: 'Half Marathon Training', type: 'running', color: HABIT_COLORS[0], target: '1200 km' },
          { name: 'Swimming Practice', type: 'swimming', color: HABIT_COLORS[1], target: '240 hours' },
          { name: 'Read 6 Books', type: 'book', color: HABIT_COLORS[2], target: '6 books' }
        ],
        'Krishna Amar': [
          { name: 'Run 500km/Year', type: 'running', color: HABIT_COLORS[0], target: '500 km' },
          { name: 'Read 10 Books', type: 'book', color: HABIT_COLORS[1], target: '10 books' },
          { name: 'Weight Loss (10kg)', type: 'weight', color: HABIT_COLORS[2], target: '75 kg' }
        ],
        'Ritwik Garg': [
          { name: 'Job Search', type: 'job_search', color: HABIT_COLORS[0], target: '240 activities' },
          { name: 'Learn AI', type: 'ai_learning', color: HABIT_COLORS[1], target: '96 topics' },
          { name: 'Instagram Growth', type: 'instagram', color: HABIT_COLORS[2], target: '5000 followers' }
        ],
        // Legacy support for shorter names
        'Anuj': [
          { name: 'Read 6 Books', type: 'book', color: HABIT_COLORS[0], target: '6 books' },
          { name: 'Gym 12 Times/Month', type: 'exercise', color: HABIT_COLORS[1], target: '144 sessions' },
          { name: 'Learn AI', type: 'ai_learning', color: HABIT_COLORS[2], target: '96 topics' }
        ],
        'Suraj': [
          { name: 'Half Marathon Training', type: 'running', color: HABIT_COLORS[0], target: '1200 km' },
          { name: 'Swimming Practice', type: 'swimming', color: HABIT_COLORS[1], target: '240 hours' },
          { name: 'Read 6 Books', type: 'book', color: HABIT_COLORS[2], target: '6 books' }
        ],
        'Amar': [
          { name: 'Run 500km/Year', type: 'running', color: HABIT_COLORS[0], target: '500 km' },
          { name: 'Read 10 Books', type: 'book', color: HABIT_COLORS[1], target: '10 books' },
          { name: 'Weight Loss (10kg)', type: 'weight', color: HABIT_COLORS[2], target: '75 kg' }
        ],
        'Krishna': [
          { name: 'Run 500km/Year', type: 'running', color: HABIT_COLORS[0], target: '500 km' },
          { name: 'Read 10 Books', type: 'book', color: HABIT_COLORS[1], target: '10 books' },
          { name: 'Weight Loss (10kg)', type: 'weight', color: HABIT_COLORS[2], target: '75 kg' }
        ],
        'Ritwik': [
          { name: 'Job Search', type: 'job_search', color: HABIT_COLORS[0], target: '240 activities' },
          { name: 'Learn AI', type: 'ai_learning', color: HABIT_COLORS[1], target: '96 topics' },
          { name: 'Instagram Growth', type: 'instagram', color: HABIT_COLORS[2], target: '5000 followers' }
        ]
      };

      // Try exact match first, then try partial match
      let habitsToAdd = defaultHabits[currentUser.name] || [];
      
      // If no exact match, try to find a partial match
      if (habitsToAdd.length === 0) {
        const nameKey = Object.keys(defaultHabits).find(key => 
          currentUser.name.toLowerCase().includes(key.toLowerCase()) || 
          key.toLowerCase().includes(currentUser.name.toLowerCase())
        );
        if (nameKey) {
          habitsToAdd = defaultHabits[nameKey];
        }
      }

      if (habitsToAdd.length === 0) {
        showNotification('info', `No default habits found for "${currentUser.name}". Please add habits manually.`);
        return;
      }

      // Filter out habits that already exist
      const existingHabitNames = habits.map(h => h.name.toLowerCase());
      const newHabits = habitsToAdd.filter(habit => 
        !existingHabitNames.includes(habit.name.toLowerCase())
      );

      if (newHabits.length === 0) {
        showNotification('info', 'All default habits already exist for your account!');
        return;
      }

      // Add the new habits
      const { data, error } = await supabase
        .from('habits')
        .insert(
          newHabits.map(habit => ({
            user_id: currentUser.id,
            name: habit.name,
            type: habit.type,
            color: habit.color,
            target: habit.target
          }))
        )
        .select();

      if (error) throw error;

      // Update local state
      setHabits([...habits, ...(data || [])]);
      showNotification('success', `Successfully added ${newHabits.length} default habit${newHabits.length > 1 ? 's' : ''} to your account!`);
      setHasUnsavedChanges(false);
      
    } catch (error) {
      console.error('Error adding default habits:', error);
      showNotification('error', 'Failed to add default habits. Please try again.');
    } finally {
      setAddingDefaults(false);
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

      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Habit Settings</h2>
          <button
            onClick={saveAllChanges}
            disabled={!hasUnsavedChanges || saving}
            className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
              hasUnsavedChanges
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save</span>
          </button>
        </div>
        
        {/* Add Default Habits Button */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-medium text-blue-900 mb-1">Default Habits</h3>
              <p className="text-sm text-blue-700">
                Add personalized habits for {currentUser.name.split(' ')[0]}
              </p>
            </div>
            <button
              onClick={addDefaultHabits}
              disabled={addingDefaults || habits.length >= 6}
              className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {addingDefaults ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              <span>{addingDefaults ? 'Adding...' : 'Add Defaults'}</span>
            </button>
          </div>
        </div>
        
        {/* Add Custom Habit Button */}
        {!showAddCustom && habits.length < 6 && (
          <div className="mb-4">
            <button
              onClick={() => setShowAddCustom(true)}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors touch-manipulation"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Custom Habit</span>
            </button>
          </div>
        )}

        {/* Custom Habit Form */}
        {showAddCustom && (
          <div className="mb-4 p-3 border-2 border-blue-200 rounded-lg bg-blue-50">
            <h3 className="text-base font-medium text-gray-900 mb-3">Add Custom Habit</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={newHabit.name}
                onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none touch-manipulation"
                placeholder="Enter habit name (e.g., Morning Meditation)"
              />
              <input
                type="text"
                value={newHabit.target}
                onChange={(e) => setNewHabit({ ...newHabit, target: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none touch-manipulation"
                placeholder="Enter yearly target (e.g., 10 books, 500 km, 75 kg)"
              />
              <select
                value={newHabit.type}
                onChange={(e) => setNewHabit({ ...newHabit, type: e.target.value as HabitType })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none touch-manipulation"
              >
                {habitTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <div>
                <p className="text-sm text-gray-600 mb-2">Choose color:</p>
                <div className="flex space-x-2">
                  {HABIT_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewHabit({ ...newHabit, color })}
                      className={`w-8 h-8 rounded-full border-2 touch-manipulation ${
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
                  className="flex-1 flex items-center justify-center space-x-2 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
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
                    setShowCustomFields(false);
                    setNewHabit({ name: '', target: '', type: 'exercise', color: HABIT_COLORS[0], custom_fields: [] });
                  }}
                  className="px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowCustomFields(!showCustomFields)}
                  className={`px-4 py-3 rounded-lg transition-colors touch-manipulation ${
                    showCustomFields 
                      ? 'bg-blue-100 text-blue-600' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Custom Fields"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Custom Fields Section */}
            {showCustomFields && (
              <div className="mt-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-900">Custom Tracking Fields</h4>
                  <button
                    onClick={addCustomField}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + Add Field
                  </button>
                </div>
                
                <div className="space-y-3">
                  {newHabit.custom_fields.map((field) => (
                    <div key={field.id} className="p-3 border border-gray-200 rounded-lg bg-white">
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                          type="text"
                          value={field.name}
                          onChange={(e) => updateCustomField(field.id, { name: e.target.value })}
                          className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          placeholder="Field name"
                        />
                        <select
                          value={field.type}
                          onChange={(e) => updateCustomField(field.id, { type: e.target.value as any })}
                          className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="checkbox">Checkbox</option>
                          <option value="select">Dropdown</option>
                        </select>
                      </div>
                      
                      <input
                        type="text"
                        value={field.placeholder || ''}
                        onChange={(e) => updateCustomField(field.id, { placeholder: e.target.value })}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none mb-2"
                        placeholder="Placeholder text"
                      />
                      
                      {field.type === 'select' && (
                        <input
                          type="text"
                          value={(field.options || []).join(', ')}
                          onChange={(e) => updateCustomField(field.id, { 
                            options: e.target.value.split(',').map(opt => opt.trim()).filter(opt => opt) 
                          })}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none mb-2"
                          placeholder="Options (comma separated)"
                        />
                      )}
                      
                      <div className="flex items-center justify-between">
                        <label className="flex items-center text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={field.required || false}
                            onChange={(e) => updateCustomField(field.id, { required: e.target.checked })}
                            className="mr-1 w-3 h-3"
                          />
                          Required
                        </label>
                        <button
                          onClick={() => removeCustomField(field.id)}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {newHabit.custom_fields.length === 0 && (
                    <div className="text-xs text-gray-500 text-center py-2">
                      No custom fields added. Click "Add Field" to create custom tracking inputs.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">
              Your Habits ({habits.length}/6)
            </label>
            <div className="space-y-4">
              {habits.map((habit) => (
                <div key={habit.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  {/* Habit Name */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Habit Name</label>
                    <input
                      type="text"
                      value={habit.name}
                      onChange={(e) => {
                        updateHabit(habit.id, { name: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none touch-manipulation"
                      placeholder="Enter habit name"
                    />
                  </div>
                  
                  {/* Tracking Method */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tracking Method</label>
                    <select
                      value={habit.type}
                      onChange={(e) => {
                        updateHabit(habit.id, { type: e.target.value as HabitType });
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none touch-manipulation"
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
                  
                  {/* Habit Target */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Yearly Target</label>
                    <input
                      type="text"
                      value={habit.target || ''}
                      onChange={(e) => {
                        updateHabit(habit.id, { target: e.target.value || null });
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none touch-manipulation"
                      placeholder="Enter yearly target (e.g., 10 books, 500 km, 75 kg)"
                    />
                  </div>
                  
                  {/* Color Selection */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                    <div className="flex flex-wrap gap-3">
                      {HABIT_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => {
                            updateHabit(habit.id, { color });
                            setHasUnsavedChanges(true);
                          }}
                          className={`w-10 h-10 rounded-full border-2 touch-manipulation transition-all ${
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
                      className="flex items-center space-x-1 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 touch-manipulation border border-red-200"
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

      {/* Habit Type Descriptions */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <h3 className="text-base font-semibold text-gray-900 mb-3">Habit Types</h3>
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