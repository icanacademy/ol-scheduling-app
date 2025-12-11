import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAssignments, getTimeSlots, deleteAllAssignments, copyDay, getAssignmentsByDateRange, getTeachers, getStudents, deleteAssignment } from '../services/api';
import SchedulingGrid from './SchedulingGrid';
import WeeklyGrid from './WeeklyGrid';
import AssignmentModal from './AssignmentModal';
import ClassActionModal from './ClassActionModal';
import { dayToDate, weekDays, dateToDay } from '../utils/dayMapping';

function Dashboard({ selectedDay }) {
  const queryClient = useQueryClient();
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [targetDay, setTargetDay] = useState('');
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  // Fetch time slots
  const { data: timeSlots, isLoading: timeSlotsLoading } = useQuery({
    queryKey: ['timeSlots'],
    queryFn: async () => {
      const response = await getTimeSlots();
      return response.data;
    },
  });


  // Convert day to date for API calls
  const selectedDate = selectedDay === 'All Week' ? null : dayToDate(selectedDay);
  
  // Fetch assignments for selected day or week
  const { data: assignments, isLoading: assignmentsLoading, refetch } = useQuery({
    queryKey: ['assignments', selectedDay],
    queryFn: async () => {
      if (selectedDay === 'All Week') {
        // Fetch entire week
        const response = await getAssignmentsByDateRange('2024-01-01', 7);
        return response.data;
      } else {
        // Fetch single day
        const response = await getAssignments(selectedDate);
        return response.data;
      }
    },
    enabled: !!selectedDay,
    staleTime: 0, // Always consider data stale to force fresh fetches
    cacheTime: 0, // Don't cache data
  });
  
  // Fetch teachers - for All Week view, get from any day; for single day, get specific day
  const { data: teachers } = useQuery({
    queryKey: ['teachers', selectedDay === 'All Week' ? 'Monday' : selectedDate],
    queryFn: async () => {
      const targetDate = selectedDay === 'All Week' ? dayToDate('Monday') : selectedDate;
      const response = await getTeachers(targetDate);
      return response.data;
    },
    enabled: !!selectedDay,
  });
  
  // Fetch students (only for single day view)
  const { data: students } = useQuery({
    queryKey: ['students', selectedDate],
    queryFn: async () => {
      const response = await getStudents(selectedDate);
      return response.data;
    },
    enabled: !!selectedDate,
  });

  // Delete all assignments mutation
  const deleteAllMutation = useMutation({
    mutationFn: (date) => deleteAllAssignments(date),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['assignments']);
      alert(response.data.message || 'Assignments deleted successfully!');
    },
    onError: (error) => {
      console.error('Delete all error:', error);
      alert('Failed to delete assignments: ' + (error.response?.data?.message || error.message));
    },
  });

  // Copy day mutation
  const copyDayMutation = useMutation({
    mutationFn: copyDay,
    onSuccess: (response) => {
      queryClient.invalidateQueries(['assignments']);
      queryClient.invalidateQueries(['teachers']);
      queryClient.invalidateQueries(['students']);
      setIsCopyModalOpen(false);
      setTargetDay('');
      alert(`Successfully copied ${response.data.count} assignment(s), ${response.data.teachersCount} teacher(s), and ${response.data.studentsCount} student(s)!`);
    },
    onError: (error) => {
      console.error('Copy day error:', error);
      alert('Failed to copy day: ' + (error.response?.data?.message || error.message));
    },
  });

  // Delete assignment mutation
  const deleteAssignmentMutation = useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries(['assignments']);
      setIsActionModalOpen(false);
      setSelectedCell(null);
    },
    onError: (error) => {
      console.error('Delete assignment error:', error);
      alert('Failed to delete assignment: ' + (error.response?.data?.message || error.message));
    },
  });

  const handleDeleteAll = async () => {
    const assignmentCount = assignments?.length || 0;

    if (selectedDay === 'All Week') {
      // Delete all days
      const confirmed = confirm(
        `⚠️ WARNING: Delete ALL ${assignmentCount} assignment(s) for the ENTIRE WEEK?\n\nThis will remove all assignments for Monday through Sunday.\n\nA backup will be created automatically before deletion.`
      );

      if (confirmed) {
        try {
          // Delete each day
          for (const day of weekDays) {
            const date = dayToDate(day);
            if (date) {
              await deleteAllMutation.mutateAsync(date);
            }
          }
        } catch (error) {
          console.error('Failed to delete all assignments:', error);
        }
      }
    } else {
      const confirmed = confirm(
        `⚠️ WARNING: Delete ALL ${assignmentCount} assignment(s) for ${selectedDay}?\n\nThis will remove all assignments for this day only.\n\nA backup will be created automatically before deletion.`
      );

      if (confirmed) {
        try {
          await deleteAllMutation.mutateAsync(selectedDate);
        } catch (error) {
          console.error('Failed to delete all assignments:', error);
        }
      }
    }
  };

  // Handle cell click for weekly grid
  const handleWeeklyCellClick = (timeSlotId, teacherName, existingGroup) => {
    const cellData = {
      timeSlotId,
      roomId: null,
      assignment: existingGroup && existingGroup.classes && existingGroup.classes.length > 0 
        ? existingGroup.classes[0].assignments[0] 
        : null, // Use first assignment of first class if exists
      teacherName,
      existingGroup,
      isAllWeek: true // Flag to indicate this is from All Week view
    };
    
    setSelectedCell(cellData);
    
    // If there's an existing assignment, show the action modal
    if (existingGroup && existingGroup.classes && existingGroup.classes.length > 0) {
      setIsActionModalOpen(true);
    } else {
      // No existing assignment, go straight to create
      setIsAssignmentModalOpen(true);
    }
  };

  const handleAssignmentModalClose = () => {
    setIsAssignmentModalOpen(false);
    setSelectedCell(null);
  };

  const handleAssignmentSave = async () => {
    try {
      // Remove all cached assignment data to force fresh fetch
      queryClient.removeQueries(['assignments']);
      queryClient.removeQueries(['teachers']);
      queryClient.removeQueries(['students']);
      
      // Small delay to ensure server has processed changes
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Force fresh fetch
      await refetch();
      
    } catch (error) {
      console.error('Error refreshing data after save:', error);
    }
    
    handleAssignmentModalClose();
  };

  const handleActionModalClose = () => {
    setIsActionModalOpen(false);
    setSelectedCell(null);
  };

  const handleEditExisting = (selectedAssignment) => {
    setIsActionModalOpen(false);
    
    // Find the class group that contains this assignment
    const classGroup = selectedCell.existingGroup?.classes?.find(group => 
      group.assignments.some(assignment => assignment.id === selectedAssignment.id)
    );
    
    // Update selected cell with the specific assignment to edit and its class group info
    setSelectedCell({
      ...selectedCell,
      assignment: selectedAssignment,
      classGroupDays: classGroup?.days || [dateToDay(selectedAssignment.date)].filter(Boolean)
    });
    setIsAssignmentModalOpen(true);
  };

  const handleDeleteAssignment = async (assignmentId) => {
    try {
      await deleteAssignmentMutation.mutateAsync(assignmentId);
    } catch (error) {
      console.error('Failed to delete assignment:', error);
    }
  };

  const handleCreateNew = () => {
    setIsActionModalOpen(false);
    // Clear the existing assignment to create new
    setSelectedCell({
      ...selectedCell,
      assignment: null
    });
    setIsAssignmentModalOpen(true);
  };

  const handleCopyDay = async (e) => {
    e.preventDefault();

    if (!targetDay) {
      alert('Please select a target day');
      return;
    }

    if (selectedDay === targetDay) {
      alert('Source and target days cannot be the same');
      return;
    }
    
    const targetDate = dayToDate(targetDay);

    // Check how many assignments, teachers, and students exist on the target date
    try {
      const response = await getAssignments(targetDate);
      const existingCount = response.data.length;

      let confirmMessage = `Copy everything from ${selectedDay} to ${targetDay}?\n\n`;
      confirmMessage += `This will copy all teachers, students, and assignments from ${selectedDay} to ${targetDay}.\n\n`;

      if (existingCount > 0) {
        confirmMessage += `⚠️ WARNING: The target date already has ${existingCount} assignment(s).\n`;
        confirmMessage += `All data on ${targetDay} will be DELETED and REPLACED.\n\n`;
        confirmMessage += `Continue?`;
      }

      const confirmed = confirm(confirmMessage);

      if (confirmed) {
        await copyDayMutation.mutateAsync({
          sourceDate: selectedDate,
          targetDate: targetDate
        });
      }
    } catch (error) {
      console.error('Failed to check or copy day:', error);
      alert('Failed to copy day: ' + (error.response?.data?.message || error.message));
    }
  };

  if (timeSlotsLoading || assignmentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading schedule...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {selectedDay === 'All Week' ? 'Weekly Schedule' : `${selectedDay} Schedule`}
            </h2>
            {selectedDay !== 'All Week' && (
              <p className="text-sm text-gray-600 mt-1">View-only mode. Use All Week view to create or edit classes.</p>
            )}
          </div>

          <div className="flex gap-3">
            {selectedDay !== 'All Week' && (
              <button
                onClick={() => setIsCopyModalOpen(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-md hover:shadow-lg transition-all"
              >
                Copy This Day
              </button>
            )}
            <button
              onClick={handleDeleteAll}
              disabled={deleteAllMutation.isPending}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md hover:shadow-lg transition-all"
            >
              Delete All Assignments
            </button>
          </div>
        </div>
        
        {selectedDay === 'All Week' ? (
          <WeeklyGrid
            timeSlots={timeSlots || []}
            assignments={assignments || []}
            teachers={teachers || []}
            students={students || []}
            onCellClick={handleWeeklyCellClick}
            onRefetch={refetch}
          />
        ) : (
          <SchedulingGrid
            timeSlots={timeSlots || []}
            assignments={assignments || []}
            selectedDate={selectedDate}
            onRefetch={refetch}
            isReadOnly={true} // Individual days are view-only
          />
        )}
      </div>

      {/* Copy Week Modal */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Copy Day Schedule</h2>
                <button
                  onClick={() => {
                    setIsCopyModalOpen(false);
                    setTargetDay('');
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleCopyDay} className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    This will copy all teachers, students, and assignments from <strong>{selectedDay}</strong> to another day.
                  </p>
                </div>

                <div>
                  <label htmlFor="targetDay" className="block text-sm font-semibold mb-2">
                    Target Day *
                  </label>
                  <select
                    id="targetDay"
                    value={targetDay}
                    onChange={(e) => setTargetDay(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a day</option>
                    {weekDays.filter(day => day !== selectedDay).map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCopyModalOpen(false);
                      setTargetDay('');
                    }}
                    className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={copyDayMutation.isPending}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
                  >
                    {copyDayMutation.isPending ? 'Copying...' : 'Copy Day'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal for All Week view */}
      {isAssignmentModalOpen && selectedCell && (
        <AssignmentModal
          isOpen={isAssignmentModalOpen}
          onClose={handleAssignmentModalClose}
          onSave={handleAssignmentSave}
          selectedDate={dayToDate('Monday')} // Use Monday as reference for All Week
          timeSlotId={selectedCell.timeSlotId}
          roomId={null}
          existingAssignment={selectedCell.assignment}
          timeSlots={timeSlots}
          isAllWeekMode={selectedCell.isAllWeek} // Pass the All Week flag
          classGroupDays={selectedCell.classGroupDays} // Pass the class group days
          autoSelectTeacherName={selectedCell.teacherName} // Pass the teacher name from the clicked row
        />
      )}

      {/* Class Action Modal */}
      {isActionModalOpen && selectedCell && (
        <ClassActionModal
          isOpen={isActionModalOpen}
          onClose={handleActionModalClose}
          onEdit={handleEditExisting}
          onCreate={handleCreateNew}
          onDelete={handleDeleteAssignment}
          existingClass={{
            time: selectedCell.timeSlotId,
            days: selectedCell.existingGroup?.days ? selectedCell.existingGroup.days.join(', ') : 'some days',
            classes: selectedCell.existingGroup?.classes || []
          }}
          timeSlotName={timeSlots?.find(ts => ts.id === selectedCell.timeSlotId)?.name}
        />
      )}
    </div>
  );
}

export default Dashboard;
