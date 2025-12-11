function ClassActionModal({ isOpen, onClose, onEdit, onCreate, onDelete, existingClass, timeSlotName }) {
  if (!isOpen) return null;

  const handleEditClass = (classGroup) => {
    // Pass the first assignment from this class group to edit
    onEdit(classGroup.assignments[0]);
  };

  const handleDeleteClass = async (classGroup) => {
    const studentNames = classGroup.students.map(s => s.name).join(', ');
    const confirmed = confirm(
      `Are you sure you want to delete this class?\n\n` +
      `Days: ${classGroup.days.join(', ')}\n` +
      `Students: ${studentNames}`
    );
    
    if (confirmed && onDelete) {
      // Delete all assignments in this class group
      for (const assignment of classGroup.assignments) {
        await onDelete(assignment.id);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Manage Classes at {timeSlotName || existingClass?.time || 'this time slot'}
        </h2>
        
        {existingClass?.classes && existingClass.classes.length > 0 ? (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Existing Classes:</h3>
            <div className="space-y-3">
              {existingClass.classes.map((classGroup, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          {classGroup.days.join(', ')}
                        </span>
                        <span className="text-sm text-gray-600">
                          {classGroup.students.length} student{classGroup.students.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 mb-2">
                        <strong>Students:</strong> {classGroup.students.map(s => s.name).join(', ')}
                      </div>
                      {classGroup.assignments[0]?.notes && (
                        <div className="text-sm text-gray-600">
                          <strong>Notes:</strong> {classGroup.assignments[0].notes}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleEditClass(classGroup)}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        title="Edit this class"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClass(classGroup)}
                        className="px-2 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                        title="Delete this class"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600 text-center">No existing classes at this time slot.</p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={onCreate}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-left"
          >
            <div className="font-semibold">Create New Class</div>
            <div className="text-sm opacity-90">Add a new class at this time slot</div>
          </button>

          <button
            onClick={onClose}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClassActionModal;