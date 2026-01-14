import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTeachers, getStudents, deleteAssignment } from '../services/api';
import AssignmentModal from './AssignmentModal';

function SchedulingGrid({ timeSlots, assignments, selectedDate, onRefetch, isReadOnly = false }) {
  const [selectedCell, setSelectedCell] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Delete assignment mutation
  const deleteMutation = useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries(['assignments']);
      onRefetch && onRefetch();
    },
    onError: (error) => {
      console.error('Delete assignment error:', error);
      alert('Failed to delete assignment');
    },
  });

  // Fetch teachers and students for availability checking
  const { data: teachers } = useQuery({
    queryKey: ['teachers', selectedDate],
    queryFn: async () => {
      const response = await getTeachers(selectedDate);
      return response.data;
    },
    enabled: !!selectedDate,
  });

  const { data: students } = useQuery({
    queryKey: ['students', selectedDate],
    queryFn: async () => {
      const response = await getStudents(selectedDate);
      return response.data;
    },
    enabled: !!selectedDate,
  });

  // Create a map of assignments by time_slot_id for quick lookup
  const assignmentMap = useMemo(() => {
    const map = {};
    assignments.forEach((assignment) => {
      const key = assignment.time_slot_id;
      if (!map[key]) map[key] = [];
      map[key].push(assignment);
    });
    return map;
  }, [assignments]);

  // Get all unique teachers (deduplicated by name)
  const allTeachers = useMemo(() => {
    if (teachers && teachers.length > 0) {
      // Create a map to deduplicate teachers by name
      const uniqueTeachers = new Map();
      teachers.forEach(teacher => {
        if (!uniqueTeachers.has(teacher.name)) {
          uniqueTeachers.set(teacher.name, teacher);
        }
      });
      return Array.from(uniqueTeachers.keys()).sort();
    }
    // Fallback to assigned teachers if no teacher data available
    const teacherSet = new Set();
    assignments.forEach((assignment) => {
      assignment.teachers?.forEach((teacher) => {
        teacherSet.add(teacher.name);
      });
    });
    return Array.from(teacherSet).sort();
  }, [teachers, assignments]);

  // Create a map from teacher name to their availability array
  const teacherAvailabilityMap = useMemo(() => {
    const map = new Map();
    if (teachers && teachers.length > 0) {
      teachers.forEach(teacher => {
        if (!map.has(teacher.name)) {
          map.set(teacher.name, teacher.availability || []);
        }
      });
    }
    return map;
  }, [teachers]);

  // Helper function to check if a teacher is available at a given time slot
  const isTeacherAvailable = (teacherName, timeSlotId) => {
    const availability = teacherAvailabilityMap.get(teacherName);
    if (!availability || availability.length === 0) {
      return false;
    }
    return availability.includes(timeSlotId);
  };

  const handleCellClick = (timeSlotId) => {
    if (isReadOnly) {
      // Don't allow editing in read-only mode (individual day views)
      return;
    }
    
    const existingAssignments = assignmentMap[timeSlotId] || [];

    setSelectedCell({
      timeSlotId,
      roomId: null, // No room needed for online classes
      assignment: existingAssignments[0] || null, // Take first assignment if any
    });
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedCell(null);
  };

  const handleSave = () => {
    onRefetch();
    handleModalClose();
  };

  const handleDeleteAssignment = async (e, assignmentId) => {
    e.stopPropagation(); // Prevent cell click
    if (confirm('Are you sure you want to delete this class?')) {
      try {
        await deleteMutation.mutateAsync(assignmentId);
      } catch (error) {
        console.error('Failed to delete assignment:', error);
      }
    }
  };

  // Helper function to get column background color
  const getColumnBgColor = (index) => {
    // Alternate between blue and gray for each pair of time slots
    return Math.floor(index / 2) % 2 === 0 ? 'bg-blue-50' : 'bg-gray-100';
  };

  // Helper function to get colors for assignment based on assignment color or students
  const getAssignmentColors = (assignment) => {
    // Use assignment color first if available, then fall back to student color
    const colorKeyword = assignment.color_keyword || 
                        (assignment.students && assignment.students.length > 0 ? assignment.students[0].color_keyword : null);
    
    if (colorKeyword) {
      const colorMap = {
        red: { bg: 'bg-red-300', text: 'text-red-900', border: 'border-red-400', subject: 'text-red-700' },
        blue: { bg: 'bg-blue-300', text: 'text-blue-900', border: 'border-blue-400', subject: 'text-blue-700' },
        green: { bg: 'bg-green-300', text: 'text-green-900', border: 'border-green-400', subject: 'text-green-700' },
        yellow: { bg: 'bg-yellow-300', text: 'text-yellow-900', border: 'border-yellow-400', subject: 'text-yellow-700' },
        purple: { bg: 'bg-purple-300', text: 'text-purple-900', border: 'border-purple-400', subject: 'text-purple-700' },
        orange: { bg: 'bg-orange-300', text: 'text-orange-900', border: 'border-orange-400', subject: 'text-orange-700' },
        pink: { bg: 'bg-pink-300', text: 'text-pink-900', border: 'border-pink-400', subject: 'text-pink-700' },
      };
      return colorMap[colorKeyword] || colorMap.blue;
    }
    
    // Default to blue if no color available
    return { bg: 'bg-blue-300', text: 'text-blue-900', border: 'border-blue-400', subject: 'text-blue-700' };
  };


  return (
    <>
      <style>{`
        .shadow-r {
          box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
        }
        .shadow-b {
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
      `}</style>
      <div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-sm sticky left-0 top-0 bg-gray-200 z-20 shadow-r shadow-b">
                Classes
              </th>
              {timeSlots.map((slot, index) => {
                const bgColor = Math.floor(index / 2) % 2 === 0 ? 'bg-gray-200' : 'bg-gray-300';

                return (
                  <th
                    key={slot.id}
                    className={`border border-gray-300 px-2 py-3 text-center font-semibold text-sm min-w-[200px] sticky top-0 z-10 shadow-b ${bgColor}`}
                  >
                    {slot.name}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {allTeachers.length === 0 ? (
              /* Fallback when no teachers at all */
              <tr>
                <td className="border border-gray-300 p-3 font-semibold text-sm bg-gray-50 sticky left-0 z-10">
                  No Teachers Available
                  <div className="text-xs text-gray-500 mt-1 font-normal">
                    Please add teachers first
                  </div>
                </td>
                {timeSlots.map((slot, index) => {
                  const bgColor = getColumnBgColor(index);

                  return (
                    <td
                      key={slot.id}
                      className={`border border-gray-300 p-2 ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:bg-opacity-80'} transition-colors ${bgColor} align-top`}
                      onClick={() => handleCellClick(slot.id)}
                      title={isReadOnly ? 'View-only mode. Use All Week view to edit.' : ''}
                    >
                      <div className="text-gray-500 italic text-center py-4 text-sm">
                        Add teachers first
                      </div>
                    </td>
                  );
                })}
              </tr>
            ) : (
              /* Row for each teacher (all teachers show by default) */
              allTeachers.map((teacherName) => (
                <tr key={teacherName}>
                  <td className="border border-gray-300 p-3 font-semibold text-sm bg-gray-50 sticky left-0 z-10 shadow-r">
                    {teacherName}
                  </td>
                  {timeSlots.map((slot, index) => {
                    const slotAssignments = assignmentMap[slot.id] || [];
                    const teacherAssignments = slotAssignments.filter(assignment => 
                      assignment.teachers?.some(t => t.name === teacherName)
                    );
                    const bgColor = getColumnBgColor(index);

                    return (
                      <td
                        key={slot.id}
                        className={`border border-gray-300 p-2 ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:bg-opacity-80'} transition-colors ${bgColor} align-top`}
                        onClick={() => handleCellClick(slot.id)}
                        title={isReadOnly ? 'View-only mode. Use All Week view to edit.' : ''}
                      >
                        <div className="space-y-2 min-h-[80px]">
                          {teacherAssignments.length === 0 ? (
                            isTeacherAvailable(teacherName, slot.id) ? (
                              <div className="text-green-600 font-medium text-center py-2 text-xs">
                                Free
                              </div>
                            ) : (
                              <div className="text-gray-300 text-center py-2 text-xs">
                                -
                              </div>
                            )
                          ) : (
                            teacherAssignments.map((assignment, idx) => {
                              const colors = getAssignmentColors(assignment);
                              return (
                                <div key={idx} className={`${colors.bg} ${colors.text} rounded-lg p-3 shadow-md border ${colors.border} relative group`}>
                                  {/* Delete button */}
                                  {!isReadOnly && (
                                    <button
                                      onClick={(e) => handleDeleteAssignment(e, assignment.id)}
                                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-sm font-bold shadow-md z-10"
                                      title="Delete this class"
                                    >
                                      ×
                                    </button>
                                  )}
                                  
                                  {/* Subject */}
                                  {assignment.subject && (
                                    <div className={`text-xs font-semibold ${colors.subject} mb-1`}>
                                      {assignment.subject}
                                    </div>
                                  )}
                                  
                                  {/* Students */}
                                  {assignment.students?.length > 0 && (
                                    <div className="text-xs">
                                      <div className="font-medium mb-1">
                                        {assignment.students.length} student{assignment.students.length !== 1 ? 's' : ''}
                                      </div>
                                      <div className="opacity-80">
                                        {assignment.students.slice(0, 3).map(s => s.name).join(', ')}
                                        {assignment.students.length > 3 && ` +${assignment.students.length - 3} more`}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && selectedCell && (
        <AssignmentModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSave={handleSave}
          selectedDate={selectedDate}
          timeSlotId={selectedCell.timeSlotId}
          roomId={null}
          existingAssignment={selectedCell.assignment}
          timeSlots={timeSlots}
        />
      )}
    </>
  );
}

export default SchedulingGrid;
