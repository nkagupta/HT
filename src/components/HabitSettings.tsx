import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit, Save, X, Trash, Calendar, ChevronDown, ChevronUp, Download, Upload, Users, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User, Habit, HabitCompletion, HabitType, getDateKey, isWithinFourteenDays, HABIT_COLORS } from '../utils/types';
import HabitInput from './HabitInput';

interface HabitSettingsProps {
  currentUser: User;
  viewingUser: User;
  availableUsers: User[];
  isViewingOwnData: boolean;
  onUnsavedChangesChange: (hasChanges: boolean) => void;
  onDataRefresh: () => void;
  onUserSwitch: (user: User) => void;
}

const HabitSettings: React.FC<HabitSettingsProps> = ({
  currentUser,
  viewingUser,
  availableUsers,
  isViewingOwnData,
  onUnsavedChangesChange,
  onDataRefresh,
  onUserSwitch
}) => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDataSection, setShowDataSection] = useState(false);
  const [showUserSelector, setShowUserSelector] = useState(false);
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

  // Import/Export states
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const importFileRef = React.useRef<HTMLInputElement>(null);

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
  }, [viewingUser.id]);

  const loadHabits = async () => {
    try {
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', viewingUser.id)
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
    if (!isViewingOwnData) return;

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
    if (!isViewingOwnData) return;
    
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
        .eq('user_id', viewingUser.id)
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
    if (!loadedEntry || !isViewingOwnData) return;

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
    if (!loadedEntry || !selectedHabit || !isViewingOwnData) return;

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
        .eq('user_id', viewingUser.id);

      if (error) throw error;

      setLoadedEntry(null);
      setIsEditing(false);
      onDataRefresh();
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  // Import/Export Functions
  const exportUserData = async (userId: string, userName: string) => {
    setExporting(true);
    try {
      const [habitsResult, completionsResult, booksResult] = await Promise.all([
        supabase.from('habits').select('*').eq('user_id', userId),
        supabase.from('habit_completions').select('*').eq('user_id', userId),
        supabase.from('books').select('*').eq('user_id', userId)
      ]);

      const exportData = {
        user: availableUsers.find(u => u.id === userId),
        habits: habitsResult.data || [],
        completions: completionsResult.data || [],
        books: booksResult.data || [],
        exported_at: new Date().toISOString(),
        exported_by: currentUser.name
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const exportFileDefaultName = `habitflow-${userName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
      
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

  const importData = async (file: File) => {
    if (!isViewingOwnData) {
      alert('You can only import data to your own account.');
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.habits || !data.completions || !data.books) {
        throw new Error('Invalid data format. Please ensure the file contains habits, completions, and books data.');
      }

      let importedCount = 0;

      if (data.habits.length > 0) {
        await supabase.from('habits').upsert(
          data.habits.map((habit: any) => ({ ...habit, user_id: currentUser.id })),
          { onConflict: 'id' }
        );
        importedCount += data.habits.length;
      }

      if (data.books.length > 0) {
        await supabase.from('books').upsert(
          data.books.map((book: any) => ({ ...book, user_id: currentUser.id })),
          { onConflict: 'id' }
        );
        importedCount += data.books.length;
      }

      if (data.completions.length > 0) {
        await supabase.from('habit_completions').upsert(
          data.completions.map((completion: any) => ({ ...completion, user_id: currentUser.id })),
          { onConflict: 'habit_id,date' }
        );
        importedCount += data.completions.length;
      }

      alert(`Successfully imported ${importedCount} records from ${data.exported_by || 'exported file'}!`);
      loadHabits();
      onDataRefresh();
      
      if (importFileRef.current) {
        importFileRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Error importing data:', error);
      alert(`Error importing data: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) importData(file);
  };

  const renderEntryData = () => {
    if (!loadedEntry || !selectedHabit) return null;

    const canEdit = isWithinFourteenDays(new Date(selectedDate)) && isViewingOwnData;
    const canDelete = isWithinFourteenDays(new Date(selectedDate)) && isViewingOwnData;

    if (isEditing && canEdit) {
      return (
        <div className="bg-gray-50 p-4 rounded-lg border-2 border-black">
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
              className="flex items-center space-x-1 px-3 py-2 bg-gradient-to-r from-green-600 to-olive-600 text-white rounded-lg hover:from-green-700 hover:to-olive-700 border-2 border-black text-sm"
            >
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center space-x-1 px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 border-2 border-black text-sm"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-gray-50 p-4 rounded-lg border-2 border-black">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Entry Details</h4>
          <div className="flex space-x-2">
            {canEdit && (
              <button
                onClick={handleEditEntry}
                className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 border-2 border-black text-sm"
              >
                <Edit className="w-4 h-4" />
                <span>Edit</span>
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleDeleteEntry}
                className="flex items-center space-x-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 border-2 border-black text-sm"
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
            {!isViewingOwnData 
              ? 'You can only edit your own entries.' 
              : 'Entries older than 14 days have limited editing options.'}
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
      {/* User Selector */}
      <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-black">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">User Data Viewer</h2>
          <Users className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowUserSelector(!showUserSelector)}
            className="w-full flex items-center justify-between p-4 text-left text-gray-700 hover:bg-green-50 rounded-lg transition-colors border-2 border-black hover:border-green-600"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-olive-600 rounded-full flex items-center justify-center text-white font-bold">
                {viewingUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold">Currently Viewing: {viewingUser.name}</div>
                <div className="text-sm text-gray-500">
                  {isViewingOwnData ? 'Your data (can edit)' : 'Read-only view'}
                </div>
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 transition-transform ${showUserSelector ? 'rotate-180' : ''}`} />
          </button>
          
          {showUserSelector && (
            <div className="mt-2 max-h-48 overflow-y-auto bg-gray-50 rounded-lg border-2 border-black">
              {availableUsers.map(user => (
                <button
                  key={user.id}
                  onClick={() => {
                    onUserSwitch(user);
                    setShowUserSelector(false);
                  }}
                  className={`w-full text-left p-4 hover:bg-green-100 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    viewingUser.id === user.id ? 'bg-green-100 font-medium' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-olive-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-gray-500">
                        {user.id === currentUser.id ? 'Your account' : 'Friend\'s data'}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Data Management Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-black">
        <button
          onClick={() => setShowDataSection(!showDataSection)}
          className="w-full flex items-center justify-between mb-4"
        >
          <h2 className="text-lg font-bold text-gray-900">Data Management</h2>
          <ChevronRight className={`w-5 h-5 transition-transform ${showDataSection ? 'rotate-90' : ''}`} />
        </button>
        
        {showDataSection && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {/* Export Section */}
              <div className="bg-purple-50 p-4 rounded-lg border-2 border-black">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                  <Download className="w-5 h-5 text-purple-600" />
                  <span>Export Data</span>
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Download habit data for any user. You can export anyone's data for backup or analysis.
                </p>
                
                <div className="space-y-2">
                  {availableUsers.map(user => (
                    <button
                      key={user.id}
                      onClick={() => exportUserData(user.id, user.name)}
                      disabled={exporting}
                      className="w-full flex items-center justify-between p-3 bg-white hover:bg-purple-100 rounded-lg transition-colors border-2 border-black hover:border-purple-600 disabled:opacity-50"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{user.name}</span>
                        {user.id === currentUser.id && (
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">You</span>
                        )}
                      </div>
                      <Download className="w-4 h-4 text-purple-600" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Import Section */}
              <div className="bg-amber-50 p-4 rounded-lg border-2 border-black">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                  <Upload className="w-5 h-5 text-amber-600" />
                  <span>Import Data</span>
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Upload habit data to your account. You can only import data to your own account for security.
                </p>
                
                {isViewingOwnData ? (
                  <button
                    onClick={() => importFileRef.current?.click()}
                    disabled={importing}
                    className="w-full flex items-center justify-center space-x-3 p-4 bg-gradient-to-r from-amber-600 to-amber-600 text-white rounded-lg hover:from-amber-700 hover:to-amber-700 transition-colors border-2 border-black disabled:opacity-50"
                  >
                    <Upload className="w-5 h-5" />
                    <span>{importing ? 'Importing...' : 'Choose File to Import'}</span>
                  </button>
                ) : (
                  <div className="text-center p-4 bg-gray-100 rounded-lg border-2 border-gray-300">
                    <p className="text-gray-600">Switch to your own account to import data</p>
                    <button
                      onClick={() => onUserSwitch(currentUser)}
                      className="mt-2 px-4 py-2 bg-gradient-to-r from-green-600 to-olive-600 text-white rounded-lg hover:from-green-700 hover:to-olive-700 transition-colors border-2 border-black text-sm"
                    >
                      View My Data
                    </button>
                  </div>
                )}
                
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Habit Management */}
      <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-black">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">
            {isViewingOwnData ? 'My Habits' : `${viewingUser.name}'s Habits`}
          </h2>
          {isViewingOwnData && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-olive-600 text-white rounded-lg hover:from-green-700 hover:to-olive-700 transition-colors border-2 border-black"
            >
              <Plus className="w-4 h-4" />
              <span>Add Habit</span>
            </button>
          )}
        </div>

        {!isViewingOwnData && (
          <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200 mb-6">
            <p className="text-blue-800 text-sm">
              You're viewing {viewingUser.name}'s habits in read-only mode. Switch to your account to manage your own habits.
            </p>
          </div>
        )}

        {/* Add Habit Form */}
        {showAddForm && isViewingOwnData && (
          <form onSubmit={handleSubmit} className="bg-gray-50 p-6 rounded-lg border-2 border-black mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Habit</h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Habit Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 border-2 border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="e.g., Morning Reading"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Habit Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as HabitType })}
                  className="w-full p-3 border-2 border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                  className="w-full p-3 border-2 border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-600 to-olive-600 text-white rounded-lg hover:from-green-700 hover:to-olive-700 transition-colors disabled:opacity-50 border-2 border-black"
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
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors border-2 border-black"
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {isViewingOwnData ? 'No Habits Yet' : 'No Habits Found'}
              </h3>
              <p className="text-gray-600">
                {isViewingOwnData 
                  ? 'Get started by adding your first habit above.' 
                  : `${viewingUser.name} hasn't created any habits yet.`}
              </p>
            </div>
          ) : (
            habits.map(habit => (
              <div key={habit.id} className="p-4 border-2 border-black rounded-lg hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full border-2 border-black"
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
                  {isViewingOwnData && (
                    <button
                      onClick={() => deleteHabit(habit.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border-2 border-black hover:border-red-600"
                      title="Delete habit"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Entry Management */}
      {habits.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-black">
          <h2 className="text-lg font-bold text-gray-900 mb-6">
            {isViewingOwnData ? 'Manage Entries' : 'View Entries'}
          </h2>
          
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
                className="w-full p-3 border-2 border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                className="w-full p-3 border-2 border-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {selectedHabit && selectedDate && (
            <div className="space-y-4">
              <button
                onClick={handleLoadEntry}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors border-2 border-black"
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
    </div>
  );
};

export default HabitSettings;