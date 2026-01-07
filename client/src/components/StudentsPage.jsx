import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStudents, getTimeSlots, deleteStudent, updateStudent, deleteAllStudents, previewStudentsFromNotion, createStudent, getAssignments } from '../services/api';
import { dayToDate, weekDays, dateToDay } from '../utils/dayMapping';
import StudentFormModal from './StudentFormModal';
import NotionImportModal from './NotionImportModal';
import StudentChangeHistory from './StudentChangeHistory';

function StudentsPage({ selectedDate, isAllWeekMode = false }) {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [dayFilter, setDayFilter] = useState('all');
  const [showChangeHistory, setShowChangeHistory] = useState(false);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState(null);

  // Fetch students for the selected date
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['students', selectedDate],
    queryFn: async () => {
      const response = await getStudents(selectedDate);
      return response.data;
    },
    enabled: !!selectedDate,
  });

  // Fetch assignments for the selected date to determine student status
  const { data: assignments } = useQuery({
    queryKey: ['assignments', selectedDate],
    queryFn: async () => {
      const response = await getAssignments(selectedDate);
      return response.data;
    },
    enabled: !!selectedDate,
  });

  // Fetch assignments for all week days to show class days
  const { data: weekAssignments } = useQuery({
    queryKey: ['weekAssignments'],
    queryFn: async () => {
      const allAssignments = {};
      for (const day of weekDays) {
        const date = dayToDate(day);
        if (date) {
          const response = await getAssignments(date);
          allAssignments[day] = response.data;
        }
      }
      return allAssignments;
    },
    enabled: true,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch time slots for display
  const { data: timeSlots } = useQuery({
    queryKey: ['timeSlots'],
    queryFn: async () => {
      const response = await getTimeSlots();
      return response.data;
    },
  });

  // Update availability mutation
  const updateAvailabilityMutation = useMutation({
    mutationFn: ({ id, data }) => updateStudent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['students']);
    },
    onError: (error) => {
      console.error('Update error:', error);
      alert('Failed to update student availability');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteStudent,
    onSuccess: () => {
      queryClient.invalidateQueries(['students']);
    },
  });


  // Delete all mutation
  const deleteAllMutation = useMutation({
    mutationFn: (date) => deleteAllStudents(date),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['students']);
      alert(response.data.message || 'Students deleted successfully!');
    },
    onError: (error) => {
      console.error('Delete all error:', error);
      alert('Failed to delete all students: ' + (error.response?.data?.message || error.message));
    },
  });

  const handleAdd = () => {
    setEditingStudent(null);
    setIsModalOpen(true);
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
    setIsModalOpen(true);
  };

  const handleDelete = async (student) => {
    if (confirm(`Are you sure you want to delete ${student.name}?`)) {
      try {
        await deleteMutation.mutateAsync(student.id);
      } catch {
        alert('Failed to delete student');
      }
    }
  };

  const handleDeleteAll = async () => {
    const studentCount = students?.length || 0;

    if (studentCount === 0) {
      alert('No students to delete');
      return;
    }

    const confirmed = confirm(
      `⚠️ WARNING: Delete ALL ${studentCount} student(s) for ${selectedDate}?\n\nThis will remove all students for this date only.\n\nA backup will be created automatically before deletion.`
    );

    if (confirmed) {
      try {
        await deleteAllMutation.mutateAsync(selectedDate);
      } catch (error) {
        console.error('Failed to delete all students:', error);
      }
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingStudent(null);
  };

  const handleSave = () => {
    queryClient.invalidateQueries(['students']);
    handleModalClose();
  };

  // Notion import handlers
  const handlePreviewFromNotion = async (date) => {
    const response = await previewStudentsFromNotion(date);
    // Handle both formats: array directly or object with students array
    if (Array.isArray(response.data)) {
      return response.data;
    } else if (response.data && response.data.students) {
      return response.data.students;
    } else {
      console.error('Unexpected response format:', response.data);
      return [];
    }
  };

  const handleImportFromNotion = async (students) => {
    // Process each student for their selected days
    for (const student of students) {
      if (!student.selectedDays || student.selectedDays.length === 0) {
        continue; // Skip students with no selected days
      }

      // Import the student for each selected day
      // Note: We no longer check for duplicate names - the backend handles this via notion_page_id
      for (const day of student.selectedDays) {
        const targetDate = dayToDate(day);
        if (targetDate) {
          try {
            // Create a copy of student data for this specific day
            // Map camelCase fields from Notion to snake_case for the API
            const studentData = {
              ...student,
              date: targetDate,
              korean_name: student.koreanName || '',
              notion_page_id: student.notionPageId || null,
              // Remove selectedDays and koreanName from the data sent to server
              selectedDays: undefined,
              koreanName: undefined,
              notionPageId: undefined
            };
            delete studentData.selectedDays;
            delete studentData.koreanName;
            delete studentData.notionPageId;

            await createStudent(studentData);
          } catch (error) {
            console.error(`Failed to import ${student.name} for ${day}:`, error);
          }
        }
      }
    }
  };

  // Toggle availability for a specific time slot
  const handleToggleAvailability = async (student, timeSlotId) => {
    
    if (isAllWeekMode) {
      // When in All Week mode, just update the current (Monday) record
      // This is a simplified approach to avoid server overload
      const currentAvailability = student.availability || [];
      const newAvailability = currentAvailability.includes(timeSlotId)
        ? currentAvailability.filter(id => id !== timeSlotId)
        : [...currentAvailability, timeSlotId].sort();

      try {
        await updateAvailabilityMutation.mutateAsync({
          id: student.id,
          data: {
            name: student.name,
            english_name: student.english_name,
            korean_name: student.korean_name,
            availability: newAvailability,
            color_keyword: student.color_keyword,
            weakness_level: student.weakness_level,
            teacher_notes: student.teacher_notes,
            grade: student.grade,
            first_start_date: student.first_start_date,
            schedule_days: student.schedule_days,
            schedule_pattern: student.schedule_pattern,
          },
        });
        
        
      } catch (error) {
        console.error('Failed to toggle availability in All Week mode:', error);
        alert('Failed to update student availability: ' + (error.response?.data?.message || error.message));
      }
    } else {
      // Single day mode - original logic
      const currentAvailability = student.availability || [];
      const newAvailability = currentAvailability.includes(timeSlotId)
        ? currentAvailability.filter(id => id !== timeSlotId)
        : [...currentAvailability, timeSlotId].sort();

      try {
        const updateData = {
          name: student.name,
          english_name: student.english_name,
          korean_name: student.korean_name,
          availability: newAvailability,
          color_keyword: student.color_keyword,
          weakness_level: student.weakness_level,
          teacher_notes: student.teacher_notes,
          grade: student.grade,
          first_start_date: student.first_start_date,
          schedule_days: student.schedule_days,
          schedule_pattern: student.schedule_pattern,
        };

        await updateAvailabilityMutation.mutateAsync({
          id: student.id,
          data: updateData,
        });
      } catch (error) {
        console.error('Failed to toggle availability in Single day mode:', error);
        alert('Failed to update student availability: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  // Helper function to get student's class days
  const getStudentClassDays = (studentId) => {
    if (!weekAssignments) return [];
    
    const classDays = [];
    for (const [day, dayAssignments] of Object.entries(weekAssignments)) {
      const hasClass = dayAssignments?.some(assignment => 
        assignment.students?.some(s => s.id === studentId)
      );
      if (hasClass) {
        classDays.push(day);
      }
    }
    return classDays;
  };

  // Helper function to determine student status (checks entire week, not just selected day)
  const getStudentStatus = (student) => {
    if (!student.availability || student.availability.length === 0) {
      return 'stopped';
    }

    // Check weekAssignments (all days) instead of just selectedDate assignments
    if (!weekAssignments) {
      return 'need-teachers';
    }

    // Check if student has any assignments across the entire week
    for (const day of Object.keys(weekAssignments)) {
      const dayAssignments = weekAssignments[day] || [];
      const studentAssignments = dayAssignments.filter(assignment =>
        assignment.students?.some(s => s.id === student.id)
      );
      if (studentAssignments.length > 0) {
        return 'assigned';
      }
    }

    return 'need-teachers';
  };

  // Filter students by search term and selected day with sorting
  const filteredStudents = useMemo(() => {
    if (!students) return [];

    // Filter by search term and selected day (no deduplication - allow same names)
    const filtered = students.filter((student) => {
      // Search filter
      const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.english_name?.toLowerCase().includes(searchTerm.toLowerCase());

      // Day filter
      if (dayFilter === 'all') return matchesSearch;

      // Check if student has scheduled classes on this day (from actual assignments)
      let hasClassOnDay = false;
      if (weekAssignments && weekAssignments[dayFilter]) {
        hasClassOnDay = weekAssignments[dayFilter].some(assignment =>
          assignment.students?.some(s => s.id === student.id)
        );
      }

      // Also check schedule_days as fallback
      const studentDays = student.schedule_days || [];
      return matchesSearch && (hasClassOnDay || studentDays.includes(dayFilter));
    });

    // Sort students: active (need-teachers, assigned) first, then stopped
    return filtered.sort((a, b) => {
      const statusA = getStudentStatus(a);
      const statusB = getStudentStatus(b);
      
      // Define sort order: 'need-teachers' and 'assigned' come before 'stopped'
      const sortOrder = {
        'need-teachers': 1,
        'assigned': 1,
        'stopped': 2
      };
      
      const orderA = sortOrder[statusA] || 2;
      const orderB = sortOrder[statusB] || 2;
      
      // If different status groups, sort by status
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // If same status group, sort alphabetically by name
      return a.name.localeCompare(b.name);
    });
  }, [students, searchTerm, dayFilter, assignments, weekAssignments]); // Added assignments and weekAssignments dependencies

  // Get current day name
  const getCurrentDayName = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const date = new Date(selectedDate);
    return days[date.getDay()];
  };

  if (studentsLoading) {
    return <div className="text-center py-8">Loading students...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Students Management</h2>
          <div className="flex gap-3">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold shadow-md hover:shadow-lg transition-all"
            >
              Import from Notion
            </button>
            <button
              onClick={handleDeleteAll}
              disabled={deleteAllMutation.isPending || !students || students.length === 0}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md hover:shadow-lg transition-all"
            >
              Delete All Students
            </button>
            <button
              onClick={handleAdd}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-md hover:shadow-lg transition-all"
            >
              + Add Student
            </button>
          </div>
        </div>

        {/* All Week Mode Notice */}
        {isAllWeekMode && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center mb-2">
              <span className="text-blue-600 text-lg mr-2">ℹ️</span>
              <h3 className="text-lg font-semibold text-blue-800">All Week Mode</h3>
            </div>
            <p className="text-sm text-blue-700">
              You are viewing students in All Week mode. Changes to availability will update the reference record.
            </p>
          </div>
        )}

        {/* Search and Filters */}
        <div className="mb-4 space-y-3">
          <input
            type="text"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-5 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
          />

          {/* Day Filter Dropdown */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Filter by schedule day:</span>
            <select
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Days</option>
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
              <option value="Saturday">Saturday</option>
              <option value="Sunday">Sunday</option>
            </select>
          </div>
        </div>

        {/* Students Grid */}
        <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-900 sticky left-0 top-0 bg-gray-200 z-20">
                  Student Name
                </th>
                {timeSlots?.map((slot, index) => {
                  // Determine background color based on position
                  const bgColor = Math.floor(index / 2) % 2 === 0 ? 'bg-gray-200' : 'bg-gray-300';

                  return (
                    <th key={slot.id} className={`border border-gray-300 px-2 py-3 text-center text-xs font-semibold text-gray-900 min-w-[80px] sticky top-0 z-10 ${bgColor}`}>
                      {slot.name.replace(' to ', '-')}
                    </th>
                  );
                })}
                <th className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-900 sticky right-0 top-0 bg-gray-200 z-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={timeSlots?.length + 2 || 3} className="px-4 py-8 text-center text-gray-500">
                    No students found
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  // Get color for this student
                  const getStudentColor = () => {
                    if (!student.color_keyword) return '#3b82f6'; // default blue
                    const colorMap = {
                      red: '#ef4444',
                      blue: '#3b82f6',
                      green: '#10b981',
                      yellow: '#eab308',
                      purple: '#a855f7',
                      orange: '#f97316',
                      pink: '#ec4899',
                    };
                    return colorMap[student.color_keyword] || '#3b82f6';
                  };

                  return (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td
                        className="border border-gray-300 px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white hover:bg-blue-100 z-10 cursor-pointer"
                        onClick={() => handleEdit(student)}
                        title="Click to edit student"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium">{student.name}</div>
                              {student.korean_name && (
                                <div className="text-xs text-gray-500">{student.korean_name}</div>
                              )}
                            </div>
                            {(() => {
                              const status = getStudentStatus(student);
                              const statusConfig = {
                                'need-teachers': {
                                  bg: 'bg-yellow-100',
                                  text: 'text-yellow-800',
                                  border: 'border-yellow-300',
                                  label: 'Need teachers'
                                },
                                'assigned': {
                                  bg: 'bg-blue-100',
                                  text: 'text-blue-800',
                                  border: 'border-blue-300',
                                  label: 'Assigned'
                                },
                                'stopped': {
                                  bg: 'bg-gray-100',
                                  text: 'text-gray-800',
                                  border: 'border-gray-300',
                                  label: 'Stopped'
                                }
                              };
                              const config = statusConfig[status] || statusConfig['need-teachers'];
                              return (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
                                  {config.label}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="mt-2 space-y-1">
                            {/* Class Days (derived from actual assignments in Schedule tab) */}
                            {(() => {
                              const classDays = getStudentClassDays(student.id);
                              return (
                                <div>
                                  <div className="text-xs text-gray-600 mb-1">Class Days:</div>
                                  <div className="flex gap-1">
                                    {weekDays.map(day => {
                                      const hasClass = classDays.includes(day);
                                      const dayAbbr = day.substring(0, 3);

                                      return (
                                        <span
                                          key={day}
                                          className={`inline-flex items-center justify-center w-8 h-5 rounded text-xs font-medium ${
                                            hasClass
                                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                              : 'bg-gray-50 text-gray-400 border border-gray-200'
                                          }`}
                                          title={hasClass ? `Has class on ${day}` : `No class on ${day}`}
                                        >
                                          {dayAbbr}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                          {student.grade && (
                            <div className="text-xs text-purple-600 mt-1 font-medium">
                              Grade: {student.grade}
                            </div>
                          )}
                          {student.first_start_date && (
                            <div className="text-xs text-green-600 mt-1">
                              Started: {new Date(student.first_start_date).toLocaleDateString()}
                            </div>
                          )}
                          {/* Class days as text (sorted Mon-Sun) */}
                          {(() => {
                            const classDays = getStudentClassDays(student.id);
                            if (classDays.length > 0) {
                              const sortedDays = [...classDays].sort((a, b) => weekDays.indexOf(a) - weekDays.indexOf(b));
                              return (
                                <div className="text-xs text-blue-600 mt-1">
                                  {sortedDays.join(', ')}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                      {timeSlots?.map((slot, index) => {
                        const isAvailable = student.availability?.includes(slot.id);

                        // Determine background color based on position
                        const bgColor = Math.floor(index / 2) % 2 === 0 ? '#eff6ff' : '#f3f4f6'; // blue-50 or gray-50

                        return (
                          <td
                            key={slot.id}
                            className="px-2 py-1 text-center border border-gray-300 cursor-pointer"
                            style={{
                              backgroundColor: isAvailable ? getStudentColor() : bgColor,
                            }}
                            onClick={() => handleToggleAvailability(student, slot.id)}
                            title={isAvailable ? 'Available - Click to remove' : 'Not available - Click to add'}
                          >
                            {isAvailable && (
                              <div style={{ fontSize: '16px', fontWeight: 900, color: '#ffffff' }}>✓</div>
                            )}
                          </td>
                        );
                      })}
                      <td className="border border-gray-300 px-4 py-3 text-center sticky right-0 bg-white hover:bg-gray-50 z-10">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedStudentForHistory(student);
                              setShowChangeHistory(true);
                            }}
                            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            History
                          </button>
                          <button
                            onClick={() => handleDelete(student)}
                            disabled={deleteMutation.isPending}
                            className="px-3 py-1 text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-sm text-gray-600 flex justify-between">
          <span>
            Showing: {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
            {dayFilter !== 'all' && ` for ${dayFilter}`}
          </span>
          <span>
            Total: {students?.length || 0} student{(students?.length || 0) !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {isModalOpen && (
        <StudentFormModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSave={handleSave}
          student={editingStudent}
          selectedDate={selectedDate}
        />
      )}

      {isImportModalOpen && (
        <NotionImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          type="students"
          selectedDate={selectedDate}
          onPreview={handlePreviewFromNotion}
          onImport={handleImportFromNotion}
        />
      )}

      {showChangeHistory && (
        <StudentChangeHistory
          student={selectedStudentForHistory}
          isOpen={showChangeHistory}
          onClose={() => {
            setShowChangeHistory(false);
            setSelectedStudentForHistory(null);
          }}
        />
      )}

    </div>
  );
}

export default StudentsPage;
