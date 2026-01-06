import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createStudent, updateStudent } from '../services/api';

function StudentFormModal({ isOpen, onClose, onSave, student, selectedDate }) {
  const [name, setName] = useState('');
  const [koreanName, setKoreanName] = useState('');
  const [grade, setGrade] = useState('');
  const [colorKeyword, setColorKeyword] = useState('');
  const [firstStartDate, setFirstStartDate] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (student) {
      setName(student.name);
      setKoreanName(student.korean_name || '');
      setGrade(student.grade || '');
      setColorKeyword(student.color_keyword || 'blue');
      setFirstStartDate(student.first_start_date || '');
    } else {
      setName('');
      setKoreanName('');
      setGrade('');
      setColorKeyword('blue');
      setFirstStartDate('');
    }
    setErrors({});
  }, [student]);

  const createMutation = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      onSave();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateStudent(id, data),
    onSuccess: () => {
      onSave();
    },
  });

  const validate = () => {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
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
      korean_name: koreanName.trim() || null,
      grade: grade.trim() || null,
      english_name: null,
      color_keyword: colorKeyword || null,
      weakness_level: null,
      teacher_notes: null,
      first_start_date: firstStartDate || null,
      date: selectedDate,
    };

    console.log('=== SAVING STUDENT DATA ===');
    console.log('Student name:', student ? student.name : 'New student');
    console.log('Student ID being updated:', student ? student.id : 'N/A');
    console.log('First Start Date being saved:', firstStartDate);
    console.log('Complete data being saved:', data);
    console.log('===========================');

    try {
      if (student) {
        await updateMutation.mutateAsync({ id: student.id, data });
      } else {
        await createMutation.mutateAsync(data);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save student');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {student ? 'Edit Student' : 'Add New Student'}
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
              Student Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter student name"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Korean Name */}
          <div>
            <label htmlFor="koreanName" className="block text-sm font-semibold mb-2">
              Korean Name
            </label>
            <input
              id="koreanName"
              type="text"
              value={koreanName}
              onChange={(e) => setKoreanName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter Korean name"
            />
          </div>

          {/* Grade Level */}
          <div>
            <label htmlFor="grade" className="block text-sm font-semibold mb-2">
              Grade Level
            </label>
            <select
              id="grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Grade Level</option>
              <option value="Preschool">Preschool</option>
              <option value="Kindergarten">Kindergarten</option>
              <option value="1st Grade">1st Grade</option>
              <option value="2nd Grade">2nd Grade</option>
              <option value="3rd Grade">3rd Grade</option>
              <option value="4th Grade">4th Grade</option>
              <option value="5th Grade">5th Grade</option>
              <option value="6th Grade">6th Grade</option>
              <option value="7th Grade">7th Grade</option>
              <option value="8th Grade">8th Grade</option>
              <option value="9th Grade">9th Grade</option>
              <option value="10th Grade">10th Grade</option>
              <option value="11th Grade">11th Grade</option>
              <option value="12th Grade">12th Grade</option>
              <option value="Adult">Adult</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Student's current grade level
            </p>
          </div>

          {/* First Start Date */}
          <div>
            <label htmlFor="firstStartDate" className="block text-sm font-semibold mb-2">
              First Start Date
            </label>
            <input
              id="firstStartDate"
              type="date"
              value={firstStartDate}
              onChange={(e) => setFirstStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              When did this student first start lessons?
            </p>
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
              <option value="blue">Blue (Default)</option>
              <option value="red">Red</option>
              <option value="green">Green</option>
              <option value="yellow">Yellow</option>
              <option value="purple">Purple</option>
              <option value="orange">Orange</option>
              <option value="pink">Pink</option>
            </select>
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
              : student
              ? 'Update Student'
              : 'Add Student'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default StudentFormModal;
