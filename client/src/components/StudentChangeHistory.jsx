import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStudentChangeHistory, createChangeHistory, deleteChangeHistory } from '../services/api';

function StudentChangeHistory({ student, isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingChange, setEditingChange] = useState(null);
  const [newChange, setNewChange] = useState({
    change_type: 'teacher_change',
    change_date: new Date().toISOString().split('T')[0],
    implementation_date: new Date().toISOString().split('T')[0],
    change_description: '',
    reason: '',
    notes: ''
  });

  // Fetch change history
  const { data: changeHistory, isLoading, error } = useQuery({
    queryKey: ['studentChangeHistory', student?.id],
    queryFn: async () => {
      const response = await getStudentChangeHistory(student.id);
      console.log('API Response:', response);
      console.log('Response data:', response.data);
      return response.data; // Extract data from axios response
    },
    enabled: !!student?.id && isOpen
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createChangeHistory,
    onSuccess: () => {
      queryClient.invalidateQueries(['studentChangeHistory', student.id]);
      setShowAddForm(false);
      setNewChange({
        change_type: 'teacher_change',
        change_date: new Date().toISOString().split('T')[0],
        implementation_date: new Date().toISOString().split('T')[0],
        change_description: '',
        reason: '',
        notes: ''
      });
    },
    onError: (error) => {
      alert('Failed to add change history: ' + error.message);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteChangeHistory,
    onSuccess: () => {
      queryClient.invalidateQueries(['studentChangeHistory', student.id]);
    },
    onError: (error) => {
      alert('Failed to delete change history: ' + error.message);
    }
  });

  const handleAddChange = async () => {
    if (!newChange.change_description) {
      alert('Please enter a change description');
      return;
    }

    await createMutation.mutateAsync({
      ...newChange,
      student_id: student.id
    });
  };

  const handleDelete = async (id, changeDescription) => {
    const confirmed = confirm(
      `Are you sure you want to delete this change history entry?\n\n"${changeDescription}"\n\nThis action cannot be undone.`
    );
    
    if (confirmed) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete change history:', error);
        alert('Failed to delete change history: ' + error.message);
      }
    }
  };

  const handleDeleteAll = async () => {
    if (!changeHistory || !Array.isArray(changeHistory) || changeHistory.length === 0) {
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to delete ALL ${changeHistory.length} change history records for ${student?.name}?\n\nThis action cannot be undone and will permanently remove all change history for this student.`
    );
    
    if (confirmed) {
      try {
        // Delete all records one by one
        for (const change of changeHistory) {
          await deleteMutation.mutateAsync(change.id);
        }
        alert('All change history records have been deleted successfully.');
      } catch (error) {
        console.error('Failed to delete all change history:', error);
        alert('Failed to delete all change history: ' + error.message);
      }
    }
  };

  const formatChangeType = (type) => {
    const typeMap = {
      'teacher_change': 'Teacher Change',
      'time_change': 'Time Change',
      'day_change': 'Day Change',
      'subject_change': 'Subject Change',
      'teacher_and_time_change': 'Teacher & Time Change',
      'other': 'Other'
    };
    return typeMap[type] || type;
  };

  const getChangeTypeColor = (type) => {
    const colorMap = {
      'teacher_change': 'bg-blue-100 text-blue-800',
      'time_change': 'bg-green-100 text-green-800',
      'day_change': 'bg-purple-100 text-purple-800',
      'subject_change': 'bg-yellow-100 text-yellow-800',
      'teacher_and_time_change': 'bg-orange-100 text-orange-800',
      'other': 'bg-gray-100 text-gray-800'
    };
    return colorMap[type] || 'bg-gray-100 text-gray-800';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Change History</h2>
              <p className="text-sm text-gray-600 mt-1">
                {student?.name} {student?.english_name && `(${student.english_name})`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Action Buttons */}
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {showAddForm ? 'Cancel' : '+ Add Change Record'}
            </button>
            
            {changeHistory && Array.isArray(changeHistory) && changeHistory.length > 0 && (
              <button
                onClick={handleDeleteAll}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Delete All History
              </button>
            )}
          </div>

          {/* Add Change Form */}
          {showAddForm && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Add New Change Record</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Change Type *
                  </label>
                  <select
                    value={newChange.change_type}
                    onChange={(e) => setNewChange({ ...newChange, change_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="teacher_change">Teacher Change</option>
                    <option value="time_change">Time Change</option>
                    <option value="day_change">Day Change</option>
                    <option value="subject_change">Subject Change</option>
                    <option value="teacher_and_time_change">Teacher & Time Change</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Change Decision Date *
                  </label>
                  <input
                    type="date"
                    value={newChange.change_date}
                    onChange={(e) => setNewChange({ ...newChange, change_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">When the change was decided</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Implementation Date *
                  </label>
                  <input
                    type="date"
                    value={newChange.implementation_date}
                    onChange={(e) => setNewChange({ ...newChange, implementation_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">When the change takes effect</p>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Change Description *
                </label>
                <input
                  type="text"
                  value={newChange.change_description}
                  onChange={(e) => setNewChange({ ...newChange, change_description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Changed from Teacher A to Teacher B"
                />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason
                </label>
                <input
                  type="text"
                  value={newChange.reason}
                  onChange={(e) => setNewChange({ ...newChange, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Schedule conflict, Student request"
                />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Notes
                </label>
                <textarea
                  value={newChange.notes}
                  onChange={(e) => setNewChange({ ...newChange, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Any additional information..."
                />
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleAddChange}
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Adding...' : 'Add Record'}
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Change History List */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Change History</h3>
            {/* Debug info */}
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-gray-400 mb-2">
                Debug: changeHistory = {JSON.stringify(changeHistory)} | Type: {typeof changeHistory} | IsArray: {Array.isArray(changeHistory)}
              </div>
            )}
            {error ? (
              <div className="text-center py-8 text-red-500">
                Error loading change history: {error.message}
              </div>
            ) : isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading change history...</div>
            ) : !Array.isArray(changeHistory) || changeHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No change history recorded</div>
            ) : (
              <div className="space-y-4">
                {changeHistory.map((change) => (
                  <div
                    key={change.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getChangeTypeColor(change.change_type)}`}>
                            {formatChangeType(change.change_type)}
                          </span>
                          <div className="text-sm text-gray-600">
                            <div>Decision: {new Date(change.change_date).toLocaleDateString()}</div>
                            {change.implementation_date && change.implementation_date !== change.change_date && (
                              <div>Implemented: {new Date(change.implementation_date).toLocaleDateString()}</div>
                            )}
                          </div>
                          {change.recorded_by !== 'system' && (
                            <span className="text-xs text-gray-500">
                              by {change.recorded_by}
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-gray-900 mb-1">
                          {change.change_description}
                        </p>
                        {change.reason && (
                          <p className="text-sm text-gray-600 mb-1">
                            <strong>Reason:</strong> {change.reason}
                          </p>
                        )}
                        {change.notes && (
                          <p className="text-sm text-gray-500">
                            <strong>Notes:</strong> {change.notes}
                          </p>
                        )}
                        
                        {/* Show detailed change info if available */}
                        {(change.old_teacher_names?.length > 0 || change.new_teacher_names?.length > 0) && (
                          <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded p-2">
                            {change.old_teacher_names?.length > 0 && (
                              <div>Old Teachers: {change.old_teacher_names.join(', ')}</div>
                            )}
                            {change.new_teacher_names?.length > 0 && (
                              <div>New Teachers: {change.new_teacher_names.join(', ')}</div>
                            )}
                            {change.old_time_slot && (
                              <div>Old Time: Slot {change.old_time_slot}</div>
                            )}
                            {change.new_time_slot && (
                              <div>New Time: Slot {change.new_time_slot}</div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleDelete(change.id, change.change_description)}
                          disabled={deleteMutation.isPending}
                          className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded hover:bg-red-50 transition-colors"
                          title="Delete this record"
                        >
                          {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudentChangeHistory;