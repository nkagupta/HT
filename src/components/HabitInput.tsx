import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Habit, HabitCompletionData, AI_TOPICS } from '../utils/types';

interface HabitInputProps {
  habit: Habit;
  date: Date;
  completion?: HabitCompletionData;
  onUpdate: (data: HabitCompletionData) => void;
  disabled?: boolean;
}

const HabitInput: React.FC<HabitInputProps> = ({
  habit,
  date,
  completion,
  onUpdate,
  disabled = false
}) => {
  const isWeightDay = date.getDay() === 0; // Sunday for weight tracking

  const renderInput = () => {
    switch (habit.type) {
      case 'book':
        return (
          <div className="space-y-0.5">
            <input
              type="text"
              value={(completion as any)?.book_title || ''}
              onChange={(e) => onUpdate({
                pages_read: (completion as any)?.pages_read || 0,
                book_title: e.target.value,
                book_finished: (completion as any)?.book_finished
              })}
              className="w-full p-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none touch-manipulation"
              placeholder="Book Title"
              disabled={disabled}
            />
            <input
              type="number"
              min="0"
              value={(completion as any)?.pages_read || ''}
              onChange={(e) => onUpdate({
                pages_read: parseInt(e.target.value) || 0,
                book_title: (completion as any)?.book_title || '',
                book_finished: (completion as any)?.book_finished
              })}
              className="w-full p-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none touch-manipulation"
              placeholder="Pages"
              disabled={disabled}
            />
            <div className="flex items-center space-x-0.5">
              <input
                type="checkbox"
                checked={(completion as any)?.book_finished || false}
                onChange={(e) => onUpdate({
                  pages_read: (completion as any)?.pages_read || 0,
                  book_title: (completion as any)?.book_title || '',
                  book_finished: e.target.checked
                })}
                className="w-3 h-3 touch-manipulation"
                disabled={disabled}
              />
              <span className="text-xs text-gray-600">Done</span>
            </div>
          </div>
        );

      case 'running':
        return (
          <input
            type="number"
            min="0"
            step="0.1"
            value={(completion as any)?.kilometers || ''}
            onChange={(e) => onUpdate({ kilometers: parseFloat(e.target.value) || 0 })}
            className="w-full p-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none touch-manipulation"
            placeholder="km"
            disabled={disabled}
          />
        );

      case 'ai_learning':
        return (
          <div className="space-y-0.5">
            <select
              value={(completion as any)?.topic || ''}
              onChange={(e) => onUpdate({
                topic: e.target.value,
                completed: (completion as any)?.completed || false
              })}
              className="w-full p-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none touch-manipulation"
              disabled={disabled}
            >
              <option value="">Select topic</option>
              {AI_TOPICS.map(topic => (
                <option key={topic} value={topic}>{topic}</option>
              ))}
            </select>
            <div className="flex items-center space-x-0.5">
              <input
                type="checkbox"
                checked={(completion as any)?.completed || false}
                onChange={(e) => onUpdate({
                  topic: (completion as any)?.topic || '',
                  completed: e.target.checked
                })}
                className="w-3 h-3 touch-manipulation"
                disabled={disabled}
              />
              <span className="text-xs text-gray-600">Done</span>
            </div>
          </div>
        );

      case 'job_search':
        return (
          <div className="space-y-0.5 text-xs">
            <label className="flex items-center space-x-0.5">
              <input
                type="checkbox"
                checked={(completion as any)?.applied_for_job || false}
                onChange={(e) => onUpdate({
                  applied_for_job: e.target.checked,
                  sought_reference: (completion as any)?.sought_reference || false,
                  updated_cv: (completion as any)?.updated_cv || false
                })}
                className="w-3 h-3 touch-manipulation"
                disabled={disabled}
              />
              <span>Job</span>
            </label>
            <label className="flex items-center space-x-0.5">
              <input
                type="checkbox"
                checked={(completion as any)?.sought_reference || false}
                onChange={(e) => onUpdate({
                  applied_for_job: (completion as any)?.applied_for_job || false,
                  sought_reference: e.target.checked,
                  updated_cv: (completion as any)?.updated_cv || false
                })}
                className="w-3 h-3 touch-manipulation"
                disabled={disabled}
              />
              <span>Ref</span>
            </label>
            <label className="flex items-center space-x-0.5">
              <input
                type="checkbox"
                checked={(completion as any)?.updated_cv || false}
                onChange={(e) => onUpdate({
                  applied_for_job: (completion as any)?.applied_for_job || false,
                  sought_reference: (completion as any)?.sought_reference || false,
                  updated_cv: e.target.checked
                })}
                className="w-3 h-3 touch-manipulation"
                disabled={disabled}
              />
              <span>CV</span>
            </label>
          </div>
        );

      case 'swimming':
        return (
          <input
            type="number"
            min="0"
            step="0.5"
            value={(completion as any)?.hours || ''}
            onChange={(e) => onUpdate({ hours: parseFloat(e.target.value) || 0 })}
            className="w-full p-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none touch-manipulation"
            placeholder="hours"
            disabled={disabled}
          />
        );

      case 'weight':
        if (!isWeightDay) {
          return (
            <div className="space-y-0.5">
              <div className="text-xs text-gray-400 text-center py-1">
                Weight: Sundays only
              </div>
              <input
                type="number"
                min="0"
                value={(completion as any)?.minutes || ''}
                onChange={(e) => onUpdate({ 
                  weight_kg: (completion as any)?.weight_kg || 0,
                  minutes: parseInt(e.target.value) || 0 
                })}
                className="w-full p-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none touch-manipulation"
                placeholder="Exercise (min)"
                disabled={disabled}
              />
            </div>
          );
        }
        return (
          <div className="space-y-0.5">
            <input
              type="number"
              min="0"
              step="0.1"
              value={(completion as any)?.weight_kg || ''}
              onChange={(e) => onUpdate({ 
                weight_kg: parseFloat(e.target.value) || 0,
                minutes: (completion as any)?.minutes || 0
              })}
              className="w-full p-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none touch-manipulation"
              placeholder="Weight (kg)"
              disabled={disabled}
            />
            <input
              type="number"
              min="0"
              value={(completion as any)?.minutes || ''}
              onChange={(e) => onUpdate({ 
                weight_kg: (completion as any)?.weight_kg || 0,
                minutes: parseInt(e.target.value) || 0 
              })}
              className="w-full p-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none touch-manipulation"
              placeholder="Exercise (min)"
              disabled={disabled}
            />
          </div>
        );

      case 'exercise':
        return (
          <input
            type="number"
            min="0"
            value={(completion as any)?.minutes || ''}
            onChange={(e) => onUpdate({ minutes: parseInt(e.target.value) || 0 })}
            className="w-full p-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none touch-manipulation"
            placeholder="min"
            disabled={disabled}
          />
        );

      case 'instagram':
        return (
          <input
            type="number"
            min="0"
            value={(completion as any)?.followers || ''}
            onChange={(e) => onUpdate({ followers: parseInt(e.target.value) || 0 })}
            className="w-full p-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none touch-manipulation"
            placeholder="Followers"
            disabled={disabled}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div 
      className={`p-1.5 rounded-md border transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      style={{ borderColor: habit.color + '40', backgroundColor: habit.color + '10' }}
    >
      {renderInput()}
    </div>
  );
};

export default HabitInput;