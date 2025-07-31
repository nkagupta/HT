import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit, Save, X, Trash, Calendar, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User, Habit, HabitCompletion, HabitType, getDateKey, isWithinFourteenDays, HABIT_COLORS } from '../utils/types';
import HabitInput from './HabitInput';

interface HabitSettingsProps {
  currentUser: User;
  onUnsavedChangesChange: (hasChanges: boolean) => void;
  onDataRefresh: () => void;
}

const HabitSettings: React.FC<HabitSettingsProps> = ({
  currentUser,
  onUnsavedChangesChange,
  onDataRefresh
}) => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    type: 'book' as HabitType,
    color: HABIT_COLORS[0],
    target: ''
  });

  // Entry management states
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [loadedEntry, setLoadedEntry] = useState<HabitCompletion | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});

  // Export states
  const [exporting, setExporting] = useState(false);

  const habitTypes: { value: HabitType; label: string; description: string }[] = [
    { value: 'book', label: '📚 Book Reading', description: 'Track pages read daily' },
    { value: 'running', label: '🏃 Running', description: 'Track kilometers covered' },
    { value: 'ai_learning', label: '🤖 AI Learning', description: 'Track AI topics studied' },
    { value: 'job_search', label: '💼 Job Search', description: 'Track job applications and activities' },
    { value: 'swimming', label: '🏊 Swimming', description: 'Track hours in the pool' },
    { value: 'weight', label: '⚖️ Weight Tracking', description: 'Track weight and exercise' },
    { value: 'exercise', label: '💪 Exercise', description: 'Track workout minutes' },
    { value: 'instagram', label: '📱 Instagram Growth', description: 'Track follower count' }
  ];

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSaving(true);
    try {
      const { error } = await supabase
        .from('habits')
        .insert([{
          user_id: currentUser.id,
          name: formData.name,
          type: formData.type,
          color: formData.color,
          target: formData.target || null
        }]);

      if (error) throw error;

      setFormData({
        name: '',
        type: 'book',
        color: HABIT_COLORS[0],
        target: ''
      });
      setShowAddForm(false);
      loadHabits();
      onDataRefresh();
    } catch (error) {
      console.error('Error creating habit:', error);
    } finally {
      setSaving(false);
    }
  };

  const deleteHabit = async (habitId: string) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this habit? This will also delete all associated completion data.');
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId);

      if (error) throw error;
      
      loadHabits();
      onDataRefresh();
    } catch (error) {
      console.error('Error deleting habit:', error);
    }
  };

  // Entry Management Functions
  const handleLoadEntry = async () => {
    if (!selectedHabit || !selectedDate) return;

    try {
      const { data, error } = await supabase
        .from('habit_completions')
        .select('*')
        .eq('habit_id', selectedHabit.id)
        .eq('date', selectedDate)
        .eq('user_id', currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      setLoadedEntry(data || null);
    } catch (error) {
      console.error('Error loading entry:', error);
      setLoadedEntry(null);
    }
  };

  const handleEditEntry = () => {
    if (loadedEntry) {
      setEditData(loadedEntry.data);
      setIsEditing(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!loadedEntry) return;

    try {
      const { error } = await supabase
        .from('habit_completions')
        .update({ data: editData })
        .eq('id', loadedEntry.id);

      if (error) throw error;

      const updatedEntry = { ...loadedEntry, data: editData };
      setLoadedEntry(updatedEntry);
      setIsEditing(false);
      onDataRefresh();
    } catch (error) {
      console.error('Error updating entry:', error);
    }
  };

  const handleDeleteEntry = async () => {
    if (!loadedEntry || !selectedHabit) return;

    const entryDate = new Date(selectedDate);
    const canDelete = isWithinFourteenDays(entryDate);
    
    const confirmMessage = canDelete 
      ? 'Are you sure you want to delete this entry?'
      : 'This entry is older than 14 days. Are you sure you want to delete it? This action cannot be undone.';
    
    if (!window.confirm(confirmMessage)) return;

    try {
      // Use habit_id, date, and user_id for deletion to handle multiple updates properly
      const { error } = await supabase
        .from('habit_completions')
        .delete()
        .eq('habit_id', selectedHabit.id)
        .eq('date', selectedDate)
        .eq('user_id', currentUser.id);

      if (error) throw error;

      setLoadedEntry(null);
      setIsEditing(false);
      onDataRefresh();
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  // Export Function
  const exportUserData = async () => {
    setExporting(true);
    try {
      const [habitsResult, completionsResult, booksResult] = await Promise.all([
        supabase.from('habits').select('*').eq('user_id', currentUser.id),
        supabase.from('habit_completions').select('*').eq('user_id', currentUser.id),
        supabase.from('books').select('*').eq('user_id', currentUser.id)
      ]);

      const exportData = {
        user: currentUser,
        habits: habitsResult.data || [],
        completions: completionsResult.data || [],
        books: booksResult.data || [],
        exported_at: new Date().toISOString(),
        exported_by: currentUser.name
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const exportFileDefaultName = `habitflow-${currentUser.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Error exporting data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const renderEntryData = () => {
    if (!loadedEntry || !selectedHabit) return null;

    const canEdit = isWithinFourteenDays(new Date(selectedDate));
    const canDelete = isWithinFourteenDays(new Date(selectedDate));

    if (isEditing && canEdit) {
      return (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">Edit Entry</h4>
          <HabitInput
            habit={selectedHabit}
            date={new Date(selectedDate)}
            completion={editData}
            onUpdate={setEditData}
          />
          <div className="flex space-x-2 mt-4">
            <button
              onClick={handleSaveEdit}
              className="flex items-center space-x-1 px-3 py-2 bg-gradient-to-r from-green-600 to-olive-600 text-white rounded-lg hover:from-green-700 hover:to-olive-700 text-sm"
            >
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center space-x-1 px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Entry Details</h4>
          <div className="flex space-x-2">
            {canEdit && (
              <button
                onClick={handleEditEntry}
                className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Edit className="w-4 h-4" />
                <span>Edit</span>
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleDeleteEntry}
                className="flex items-center space-x-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                <Trash className="w-4 h-4" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>
        
        <div className="space-y-2 text-sm">
          {selectedHabit.type === 'book' && (
            <>
              {loadedEntry.data.book_title && <p><strong>Book:</strong> {loadedEntry.data.book_title}</p>}
              <p><strong>Pages Read:</strong> {loadedEntry.data.pages_read || 0}</p>
              {loadedEntry.data.book_finished && <p><strong>Status:</strong> Book Completed! 🎉</p>}
            </>
          )}
          {selectedHabit.type === 'running' && (
            <p><strong>Distance:</strong> {loadedEntry.data.kilometers || 0} km</p>
          )}
          {selectedHabit.type === 'ai_learning' && (
            <>
              {loadedEntry.data.topic && <p><strong>Topic:</strong> {loadedEntry.data.topic}</p>}
              <p><strong>Status:</strong> {loadedEntry.data.completed ? 'Completed ✅' : 'In Progress'}</p>
            </>
          )}
          {selectedHabit.type === 'job_search' && (
            <div>
              <p><strong>Activities:</strong></p>
              <ul className="ml-4 mt-1">
                {loadedEntry.data.applied_for_job && <li>• Applied for job</li>}
                {loadedEntry.data.sought_reference && <li>• Sought reference</li>}
                {loadedEntry.data.updated_cv && <li>• Updated CV</li>}
              </ul>
            </div>
          )}
          {selectedHabit.type === 'swimming' && (
            <p><strong>Time:</strong> {loadedEntry.data.hours || 0} hours</p>
          )}
          {selectedHabit.type === 'weight' && (
            <>
              {loadedEntry.data.weight_kg > 0 && <p><strong>Weight:</strong> {loadedEntry.data.weight_kg} kg</p>}
              {loadedEntry.data.minutes > 0 && <p><strong>Exercise:</strong> {loadedEntry.data.minutes} minutes</p>}
            </>
          )}
          {selectedHabit.type === 'exercise' && (
            <p><strong>Duration:</strong> {loadedEntry.data.minutes || 0} minutes</p>
          )}
          {selectedHabit.type === 'instagram' && (
            <p><strong>Followers:</strong> {loadedEntry.data.followers || 0}</p>
          )}
        </div>

        {!canEdit && !canDelete && (
          <p className="text-xs text-gray-500 mt-3">
            Entries older than 14 days have limited editing options.
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Habit Management */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">My Habits</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-olive-600 text-white rounded-lg hover:from-green-700 hover:to-olive-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Habit</span>
          </button>
        </div>

        {/* Add Habit Form */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className="bg-gray-50 p-6 rounded-lg mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Habit</h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Habit Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="e.g., Morning Reading"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Habit Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as HabitType })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  {habitTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  {habitTypes.find(t => t.value === formData.type)?.description}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Annual Target (Optional)</label>
                <input
                  type="text"
                  value={formData.target}
                  onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="e.g., 3650 pages, 500 km, 50 topics"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <div className="flex space-x-2">
                  {HABIT_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full border-2 ${
                        formData.color === color ? 'border-black ring-2 ring-blue-500' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-600 to-olive-600 text-white rounded-lg hover:from-green-700 hover:to-olive-700 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>{saving ? 'Creating...' : 'Create Habit'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Habits List */}
        <div className="space-y-4">
          {habits.length === 0 ? (
            <div className="text-center py-8">
              <Settings className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Habits Yet</h3>
              <p className="text-gray-600">Get started by adding your first habit above.</p>
            </div>
          ) : (
            habits.map(habit => (
              <div key={habit.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: habit.color }}
                    />
                    <div>
                      <h3 className="font-medium text-gray-900">{habit.name}</h3>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <span className="capitalize">{habit.type.replace('_', ' ')}</span>
                        {habit.target && (
                          <>
                            <span>•</span>
                            <span>Target: {habit.target}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteHabit(habit.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete habit"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Entry Management */}
      {habits.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Manage Entries</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Habit</label>
              <select
                value={selectedHabit?.id || ''}
                onChange={(e) => {
                  const habit = habits.find(h => h.id === e.target.value);
                  setSelectedHabit(habit || null);
                  setLoadedEntry(null);
                  setIsEditing(false);
                }}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="">Choose a habit...</option>
                {habits.map(habit => (
                  <option key={habit.id} value={habit.id}>
                    {habit.name} ({habit.type.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setLoadedEntry(null);
                  setIsEditing(false);
                }}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {selectedHabit && selectedDate && (
            <div className="space-y-4">
              <button
                onClick={handleLoadEntry}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                <span>Load Entry</span>
              </button>

              {loadedEntry === null && selectedHabit && selectedDate && (
                <p className="text-gray-500 text-sm">
                  No entry found for {selectedHabit.name} on {selectedDate}. Click "Load Entry" to check again.
                </p>
              )}

              {loadedEntry && renderEntryData()}
            </div>
          )}
        </div>
      )}

      {/* Data Download - Moved to bottom */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6">Data Download</h2>
        
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
            <Download className="w-5 h-5 text-purple-600" />
            <span>Export Your Complete Data</span>
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Download a complete backup of all your habit data including habits, completions, and book records.
          </p>
          
          <button
            onClick={exportUserData}
            disabled={exporting}
            className="w-full flex items-center justify-center space-x-3 p-4 bg-gradient-to-r from-purple-600 to-purple-600 text-white rounded-lg hover:from-purple-700 hover:to-purple-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            <span>{exporting ? 'Downloading...' : 'Download My Data'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default HabitSettings;