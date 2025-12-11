import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteAssignment } from '../services/api';
import { weekDays, dayToDate, dateToDay } from '../utils/dayMapping';

function WeeklyGrid({ timeSlots, assignments, teachers, students, onCellClick, onRefetch }) {
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

  const handleDeleteClassGroup = async (e, classGroup) => {
    e.stopPropagation(); // Prevent cell click
    const dayCount = classGroup.days.length;
    const dayText = dayCount === 1 ? classGroup.days[0] : `${dayCount} days (${classGroup.days.join(', ')})`;
    
    if (confirm(`Are you sure you want to delete this class for ${dayText}?`)) {
      try {
        // Delete all assignments in the class group
        for (const assignment of classGroup.assignments) {
          await deleteMutation.mutateAsync(assignment.id);
        }
      } catch (error) {
        console.error('Failed to delete class group:', error);
        alert('Failed to delete class. Please try again.');
      }
    }
  };

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

  // Group assignments by teacher, time slot, and student combination
  const groupedAssignments = useMemo(() => {
    const groups = {};
    
    assignments.forEach((assignment) => {
      assignment.teachers?.forEach((teacher) => {
        const key = `${teacher.name}-${assignment.time_slot_id}`;
        if (!groups[key]) {
          groups[key] = {
            teacher_name: teacher.name,
            time_slot_id: assignment.time_slot_id,
            classes: [] // Store classes grouped by student combination
          };
        }
        
        const dayName = dateToDay(assignment.date);
        const studentNames = assignment.students?.map(s => s.name).sort().join(', ') || '';
        const subject = assignment.subject || '';
        
        // Find existing class group for the same student combination AND subject
        let classGroup = groups[key].classes.find(c => 
          c.studentNames === studentNames && c.subject === subject
        );
        if (!classGroup) {
          classGroup = {
            days: [],
            students: assignment.students || [],
            studentNames: studentNames,
            subject: subject,
            assignments: []
          };
          groups[key].classes.push(classGroup);
        }
        
        // Add this day and assignment to the class group
        if (dayName && !classGroup.days.includes(dayName)) {
          classGroup.days.push(dayName);
        }
        classGroup.assignments.push(assignment);
      });
    });
    
    // Sort days in each class group
    Object.values(groups).forEach(group => {
      group.classes.forEach(classGroup => {
        classGroup.days.sort((a, b) => weekDays.indexOf(a) - weekDays.indexOf(b));
      });
    });
    
    return groups;
  }, [assignments]);

  // Helper to format day ranges
  const formatDays = (days) => {
    if (days.length === 0) return '';
    if (days.length === 1) return days[0];
    if (days.length === 7) return 'Every day';
    
    // Check for consecutive days
    const dayIndices = days.map(d => weekDays.indexOf(d));
    const isConsecutive = dayIndices.every((val, i) => i === 0 || val === dayIndices[i-1] + 1);
    
    if (isConsecutive && days.length > 2) {
      return `${days[0]} - ${days[days.length - 1]}`;
    }
    
    // Abbreviate day names for display
    const abbrevDays = days.map(d => d.substring(0, 3));
    return abbrevDays.join(', ');
  };

  // Helper to get color based on days
  const getDayColor = (days) => {
    if (days.length === 7) return 'bg-purple-100 text-purple-800';
    if (days.length >= 5) return 'bg-blue-100 text-blue-800';
    if (days.length >= 3) return 'bg-green-100 text-green-800';
    if (days.length === 2) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  // Helper to get vivid background colors for class containers based on assignment color or student color
  const getContainerColor = (classGroup) => {
    // Use assignment color first if available, then fall back to student color
    const assignmentColor = classGroup.assignments && classGroup.assignments.length > 0 ? classGroup.assignments[0].color_keyword : null;
    const studentColor = classGroup.students && classGroup.students.length > 0 ? classGroup.students[0].color_keyword : null;
    const colorKeyword = assignmentColor || studentColor;
    
    // Debug logging removed
    
    if (colorKeyword) {
      const colorMap = {
        red: 'bg-red-300 text-red-900',
        blue: 'bg-blue-300 text-blue-900',
        green: 'bg-green-300 text-green-900',
        yellow: 'bg-yellow-300 text-yellow-900',
        purple: 'bg-purple-300 text-purple-900',
        orange: 'bg-orange-300 text-orange-900',
        pink: 'bg-pink-300 text-pink-900',
      };
      return colorMap[colorKeyword] || 'bg-blue-300 text-blue-900';
    }
    
    // Fallback to blue if no color available
    return 'bg-blue-300 text-blue-900';
  };

  // Helper to get subject text color based on assignment color or student color
  const getSubjectColor = (classGroup) => {
    // Use assignment color first if available, then fall back to student color
    const colorKeyword = (classGroup.assignments && classGroup.assignments.length > 0 ? classGroup.assignments[0].color_keyword : null) ||
                        (classGroup.students && classGroup.students.length > 0 ? classGroup.students[0].color_keyword : null);
    
    if (colorKeyword) {
      const colorMap = {
        red: 'text-red-700',
        blue: 'text-blue-700',
        green: 'text-green-700',
        yellow: 'text-yellow-700',
        purple: 'text-purple-700',
        orange: 'text-orange-700',
        pink: 'text-pink-700',
      };
      return colorMap[colorKeyword] || 'text-blue-700';
    }
    
    // Fallback to blue if no color available
    return 'text-blue-700';
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
            <th className="border border-gray-300 px-4 py-3 text-left font-semibold sticky left-0 top-0 bg-gray-200 z-20 shadow-r">
              Classes
            </th>
            {timeSlots.map((slot) => (
              <th key={slot.id} className="border border-gray-300 px-2 py-3 text-center font-semibold min-w-[200px] sticky top-0 bg-gray-200 z-10 shadow-b">
                {slot.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allTeachers.length === 0 ? (
            /* Fallback when no teachers at all */
            <tr>
              <td className="border border-gray-300 p-3 font-semibold bg-gray-50 sticky left-0 z-10">
                No Teachers Available
                <div className="text-xs text-gray-500 mt-1 font-normal">
                  Please add teachers first
                </div>
              </td>
              {timeSlots.map((slot) => (
                <td
                  key={slot.id}
                  className="border border-gray-300 p-3 text-center text-gray-500 italic"
                >
                  Add teachers first
                </td>
              ))}
            </tr>
          ) : (
            /* Row for each teacher (all teachers show by default) */
            allTeachers.map((teacherName) => (
              <tr key={teacherName}>
                <td className="border border-gray-300 p-3 font-semibold bg-gray-50 sticky left-0 z-10 shadow-r">
                  {teacherName}
                </td>
                {timeSlots.map((slot) => {
                  const key = `${teacherName}-${slot.id}`;
                  const group = groupedAssignments[key];
                  
                  return (
                    <td
                      key={slot.id}
                      className="border border-gray-300 p-3 cursor-pointer hover:bg-gray-50 align-top"
                      onClick={() => {
                        if (onCellClick) {
                          onCellClick(slot.id, teacherName, group);
                        }
                      }}
                    >
                      {!group || group.classes.length === 0 ? (
                        <div className="text-gray-400 italic text-center py-4 text-sm">
                          No classes
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Show each different class */}
                          {group.classes.map((classGroup, idx) => (
                            <div key={idx} className={`border border-white border-opacity-50 rounded-lg p-2 shadow-md ${getContainerColor(classGroup)} relative group`}>
                              {/* Delete button */}
                              {classGroup.assignments && classGroup.assignments.length > 0 && (
                                <button
                                  onClick={(e) => handleDeleteClassGroup(e, classGroup)}
                                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-sm font-bold shadow-md z-10"
                                  title="Delete this class"
                                >
                                  ×
                                </button>
                              )}
                              
                              {/* Day indicator */}
                              <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium mb-2 ${getDayColor(classGroup.days)}`}>
                                {formatDays(classGroup.days)}
                              </div>
                              
                              {/* Subject */}
                              {classGroup.subject && (
                                <div className={`text-xs font-semibold ${getSubjectColor(classGroup)} mb-1`}>
                                  {classGroup.subject}
                                </div>
                              )}
                              
                              {/* Students */}
                              {classGroup.students.length > 0 && (
                                <div className="text-xs">
                                  <div className="font-medium text-gray-700 mb-1">
                                    {classGroup.students.length} student{classGroup.students.length !== 1 ? 's' : ''}:
                                  </div>
                                  <div className="text-gray-600">
                                    {classGroup.students.slice(0, 3).map(s => s.name).join(', ')}
                                    {classGroup.students.length > 3 && ` +${classGroup.students.length - 3}`}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    </>
  );
}

export default WeeklyGrid;