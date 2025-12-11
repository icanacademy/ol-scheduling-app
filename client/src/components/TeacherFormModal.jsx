import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createTeacher, updateTeacher } from '../services/api';

function TeacherFormModal({ isOpen, onClose, onSave, teacher, timeSlots, selectedDate }) {
  const [name, setName] = useState('');
  const [availability, setAvailability] = useState([]);
  const [colorKeyword, setColorKeyword] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (teacher) {
      setName(teacher.name);
      setAvailability(teacher.availability || []);
      setColorKeyword(teacher.color_keyword || 'green');
    } else {
      setName('');
      setAvailability([]);
      setColorKeyword('green');
    }
    setErrors({});
  }, [teacher]);

  const createMutation = useMutation({
    mutationFn: createTeacher,
    onSuccess: () => {
      onSave();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateTeacher(id, data),
    onSuccess: () => {
      onSave();
    },
  });

  const handleTimeSlotToggle = (timeSlotId) => {
    setAvailability((prev) => {
      if (prev.includes(timeSlotId)) {
        return prev.filter((id) => id !== timeSlotId);
      } else {
        return [...prev, timeSlotId].sort();
      }
    });
  };

  const validate = () => {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (availability.length === 0) {
      newErrors.availability = 'Please select at least one time slot';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const data = {
      name: name.trim(),
      availability,
      color_keyword: colorKeyword || null,
      date: selectedDate,
    };

    try {
      if (teacher) {
        await updateMutation.mutateAsync({ id: teacher.id, data });
      } else {
        await createMutation.mutateAsync(data);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save teacher');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {teacher ? 'Edit Teacher' : 'Add New Teacher'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              &times;
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-semibold mb-2">
              Teacher Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter teacher name"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Color Keyword */}
          <div>
            <label htmlFor="colorKeyword" className="block text-sm font-semibold mb-2">
              Color Keyword
            </label>
            <select
              id="colorKeyword"
              value={colorKeyword}
              onChange={(e) => setColorKeyword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="green">Green (Default)</option>
              <option value="red">Red</option>
              <option value="blue">Blue</option>
              <option value="yellow">Yellow</option>
              <option value="purple">Purple</option>
              <option value="orange">Orange</option>
              <option value="pink">Pink</option>
            </select>
          </div>

          {/* Availability */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Availability * (Select time slots)
            </label>
            <div className="grid grid-cols-2 gap-3 border border-gray-200 rounded-md p-4">
              {timeSlots.map((slot) => (
                <label
                  key={slot.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={availability.includes(slot.id)}
                    onChange={() => handleTimeSlotToggle(slot.id)}
                    className="rounded"
                  />
                  <span className="text-sm">
                    {slot.name}
                    <span className="text-xs text-gray-500 ml-1">
                      ({slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)})
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {errors.availability && (
              <p className="mt-1 text-sm text-red-600">{errors.availability}</p>
            )}
            <p className="mt-2 text-xs text-gray-600">
              {availability.length} time slot{availability.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        </form>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending || updateMutation.isPending
              ? 'Saving...'
              : teacher
              ? 'Update Teacher'
              : 'Add Teacher'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TeacherFormModal;
