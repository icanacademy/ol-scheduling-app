import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createNote, updateNote } from '../services/api';

function NoteFormModal({ isOpen, onClose, onSave, note }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [errors, setErrors] = useState({});

  // Set initial values when note changes (edit mode)
  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setDescription(note.description || '');
      setPriority(note.priority || 'normal');
    } else {
      setTitle('');
      setDescription('');
      setPriority('normal');
    }
    setErrors({});
  }, [note, isOpen]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createNote,
    onSuccess: () => {
      onSave();
    },
    onError: (error) => {
      alert('Failed to create note: ' + (error.response?.data?.message || error.message));
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateNote(id, data),
    onSuccess: () => {
      onSave();
    },
    onError: (error) => {
      alert('Failed to update note: ' + (error.response?.data?.message || error.message));
    },
  });

  // Validation
  const validate = () => {
    const newErrors = {};
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const data = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
    };

    if (note) {
      updateMutation.mutate({ id: note.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">
            {note ? 'Edit Note' : 'Add New Note'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Change schedule for John"
              autoFocus
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Add more details (optional)"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <div className="flex gap-3">
              {[
                { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800 border-green-300' },
                { value: 'normal', label: 'Normal', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
                { value: 'high', label: 'High', color: 'bg-red-100 text-red-800 border-red-300' },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
                    priority === p.value
                      ? `${p.color} ring-2 ring-offset-1 ring-blue-500`
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : note ? 'Update Note' : 'Add Note'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NoteFormModal;
