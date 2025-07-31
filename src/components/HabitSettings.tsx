import React, { useState, useEffect } from 'react';
import { Habit } from '../utils/types';
import { supabase } from '../lib/supabase';
import { Trash2, Edit2, Save, X, Plus, Book } from 'lucide-react';

interface HabitSettingsProps {
  habits: Habit[];
  onHabitsUpdate: () => void;
  userId: string;
}

interface Book {
  id: string;
  user_id: string;
  title: string;
  total_pages: number;
  finished_date: string | null;
  created_at: string;
  updated_at: string;
}

const HabitSettings: React.FC<HabitSettingsProps> = ({ habits, onHabitsUpdate, userId }) => {
  const [editingHabit, setEditingHabit] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Habit>>({});
  const [books, setBooks] = useState<Book[]>([]);
  const [newBook, setNewBook] = useState({ title: '', total_pages: '' });
  const [isAddingBook, setIsAddingBook] = useState(false);

  const habitTypes = [
    'book', 'running', 'ai_learning', 'job_search', 
    'swimming', 'weight', 'exercise'
  ];

  const colorOptions = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
  ];

  useEffect(() => {
    fetchBooks();
  }, [userId]);

  const fetchBooks = async () => {
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBooks(data || []);
    } catch (error) {
      console.error('Error fetching books:', error);
    }
  };

  const handleDeleteHabit = async (habitId: string) => {
    if (!confirm('Are you sure you want to delete this habit? This will also delete all related data.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId);

      if (error) throw error;

      onHabitsUpdate();
    } catch (error) {
      console.error('Error deleting habit:', error);
      alert('Failed to delete habit');
    }
  };

  const handleEditHabit = (habit: Habit) => {
    setEditingHabit(habit.id);
    setEditForm({
      name: habit.name,
      type: habit.type,
      target: habit.target,
      color: habit.color
    });
  };

  const handleSaveEdit = async () => {
    if (!editingHabit) return;

    try {
      const { error } = await supabase
        .from('habits')
        .update({
          name: editForm.name,
          type: editForm.type,
          target: editForm.target,
          color: editForm.color,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingHabit);

      if (error) throw error;

      setEditingHabit(null);
      setEditForm({});
      onHabitsUpdate();
    } catch (error) {
      console.error('Error updating habit:', error);
      alert('Failed to update habit');
    }
  };

  const handleCancelEdit = () => {
    setEditingHabit(null);
    setEditForm({});
  };

  const handleAddBook = async () => {
    if (!newBook.title.trim() || !newBook.total_pages) {
      alert('Please fill in all book details');
      return;
    }

    const totalPages = parseInt(newBook.total_pages);
    if (isNaN(totalPages) || totalPages <= 0) {
      alert('Please enter a valid number of pages');
      return;
    }

    try {
      const { error } = await supabase
        .from('books')
        .insert({
          user_id: userId,
          title: newBook.title.trim(),
          total_pages: totalPages
        });

      if (error) throw error;

      setNewBook({ title: '', total_pages: '' });
      setIsAddingBook(false);
      fetchBooks();
    } catch (error) {
      console.error('Error adding book:', error);
      alert('Failed to add book');
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    if (!confirm('Are you sure you want to delete this book?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', bookId)
        .eq('user_id', userId);

      if (error) throw error;
      fetchBooks();
    } catch (error) {
      console.error('Error deleting book:', error);
      alert('Failed to delete book');
    }
  };

  const resetMobileViewport = () => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      setTimeout(() => {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
      }, 100);
    }
  };

  return (
    <div className="space-y-6">
      {/* My Habits Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">My Habits</h2>
        
        {habits.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No habits found. Add some habits to get started!</p>
        ) : (
          <div className="space-y-4">
            {habits.map((habit) => (
              <div key={habit.id} className="border border-gray-200 rounded-lg p-4">
                {editingHabit === habit.id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Habit Name
                        </label>
                        <input
                          type="text"
                          value={editForm.name || ''}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          onFocus={resetMobileViewport}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Yearly Target
                        </label>
                        <input
                          type="text"
                          value={editForm.target || ''}
                          onChange={(e) => setEditForm({ ...editForm, target: e.target.value })}
                          placeholder="e.g., 12 books, 500 km"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          onFocus={resetMobileViewport}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tracking Method
                        </label>
                        <select
                          value={editForm.type || ''}
                          onChange={(e) => setEditForm({ ...editForm, type: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {habitTypes.map((type) => (
                            <option key={type} value={type}>
                              {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Color
                        </label>
                        <div className="flex gap-2 flex-wrap">
                          {colorOptions.map((color) => (
                            <button
                              key={color}
                              onClick={() => setEditForm({ ...editForm, color })}
                              className={`w-8 h-8 rounded-full border-2 ${
                                editForm.color === color ? 'border-gray-600' : 'border-gray-300'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={handleSaveEdit}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: habit.color }}
                      />
                      <div>
                        <h3 className="font-medium text-gray-800">{habit.name}</h3>
                        <p className="text-sm text-gray-600">
                          {habit.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          {habit.target && ` • Target: ${habit.target}`}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditHabit(habit)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                        title="Edit habit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteHabit(habit.id)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md"
                        title="Delete habit"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Book Management Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <Book className="w-5 h-5" />
            My Books
          </h2>
          <button
            onClick={() => setIsAddingBook(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Book
          </button>
        </div>

        {isAddingBook && (
          <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Book Title
                </label>
                <input
                  type="text"
                  value={newBook.title}
                  onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                  placeholder="Enter book title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onFocus={resetMobileViewport}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Pages
                </label>
                <input
                  type="number"
                  value={newBook.total_pages}
                  onChange={(e) => setNewBook({ ...newBook, total_pages: e.target.value })}
                  placeholder="Total pages"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onFocus={resetMobileViewport}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleAddBook}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Add Book
              </button>
              <button
                onClick={() => {
                  setIsAddingBook(false);
                  setNewBook({ title: '', total_pages: '' });
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {books.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No books added yet. Add books to track your reading progress!</p>
        ) : (
          <div className="space-y-3">
            {books.map((book) => (
              <div key={book.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-800">{book.title}</h3>
                  <p className="text-sm text-gray-600">{book.total_pages} pages</p>
                  {book.finished_date && (
                    <p className="text-sm text-green-600">
                      Completed on {new Date(book.finished_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteBook(book.id)}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md"
                  title="Delete book"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HabitSettings;