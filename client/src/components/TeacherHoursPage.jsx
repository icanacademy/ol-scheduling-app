import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getTeachers, getAssignments, getAssignmentsByDateRange, getTimeSlots } from '../services/api';
import { weekDays, dayToDate, dateToDay } from '../utils/dayMapping';
import AssignmentModal from './AssignmentModal';

function TeacherHoursPage({ selectedDate, selectedDay, isAllWeekMode = false }) {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);

  // Fetch time slots
  const { data: timeSlots, isLoading: timeSlotsLoading } = useQuery({
    queryKey: ['timeSlots'],
    queryFn: async () => {
      const response = await getTimeSlots();
      return response.data;
    },
  });

  // Fetch teachers for the selected date (same as Teachers tab)
  const { data: teachersForDate, isLoading: teachersLoading } = useQuery({
    queryKey: ['teachers', selectedDate],
    queryFn: async () => {
      const response = await getTeachers(selectedDate);
      return response.data || [];
    },
    enabled: !!selectedDate,
  });

  // Fetch teachers for ALL 7 days (All Week mode)
  const { data: allWeekTeachers, isLoading: allWeekTeachersLoading } = useQuery({
    queryKey: ['teachers', 'all-week-hours'],
    queryFn: async () => {
      const teachersByDay = {};
      for (const day of weekDays) {
        const date = dayToDate(day);
        const response = await getTeachers(date);
        teachersByDay[day] = response.data || [];
      }
      return teachersByDay;
    },
    enabled: isAllWeekMode,
  });

  // Create availability lookup: teacherName -> day -> availability[]
  const teacherAvailabilityByDay = useMemo(() => {
    if (!isAllWeekMode || !allWeekTeachers) return {};
    const lookup = {};

    Object.entries(allWeekTeachers).forEach(([day, dayTeachers]) => {
      dayTeachers.forEach(teacher => {
        if (!lookup[teacher.name]) {
          lookup[teacher.name] = {};
        }
        lookup[teacher.name][day] = teacher.availability || [];
      });
    });

    return lookup;
  }, [isAllWeekMode, allWeekTeachers]);

  // Get teachers list - use date-specific data for single day, aggregate for all week
  const teachers = useMemo(() => {
    if (isAllWeekMode) {
      if (!allWeekTeachers) return [];
      const uniqueTeachers = new Map();
      // Collect all unique teachers from all days
      Object.values(allWeekTeachers).forEach(dayTeachers => {
        dayTeachers.forEach(teacher => {
          if (!uniqueTeachers.has(teacher.name)) {
            uniqueTeachers.set(teacher.name, teacher);
          }
        });
      });
      return Array.from(uniqueTeachers.values()).sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Single day mode - use teachers directly from the API (same as Teachers tab)
      if (!teachersForDate) return [];
      return [...teachersForDate].sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [isAllWeekMode, teachersForDate, allWeekTeachers]);

  // Fetch assignments (single day or all week)
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['assignments', isAllWeekMode ? 'all-week' : selectedDate],
    queryFn: async () => {
      if (isAllWeekMode) {
        const response = await getAssignmentsByDateRange('2024-01-01', 7);
        return response.data || [];
      } else {
        if (!selectedDate) return [];
        const response = await getAssignments(selectedDate);
        return response.data || [];
      }
    },
    enabled: !!selectedDate || isAllWeekMode,
  });

  // Create assignment lookup: (teacherName, timeSlotId) -> assignments
  const assignmentMap = useMemo(() => {
    if (!assignments) return {};
    const map = {};
    assignments.forEach(assignment => {
      assignment.teachers?.forEach(teacher => {
        const key = `${teacher.name}-${assignment.time_slot_id}`;
        if (!map[key]) {
          map[key] = [];
        }
        map[key].push(assignment);
      });
    });
    return map;
  }, [assignments]);

  // Day abbreviations for display
  const dayAbbrev = {
    'Monday': 'Mon',
    'Tuesday': 'Tue',
    'Wednesday': 'Wed',
    'Thursday': 'Thu',
    'Friday': 'Fri',
    'Saturday': 'Sat',
    'Sunday': 'Sun'
  };

  // For All Week mode: track class days, free days, and off days per (teacher, timeSlot)
  const weeklyStats = useMemo(() => {
    if (!isAllWeekMode || !assignments) return {};
    const stats = {};

    // First, collect all class days from assignments
    const classDaysMap = {}; // key -> Set of day names
    assignments.forEach(assignment => {
      assignment.teachers?.forEach(teacher => {
        const key = `${teacher.name}-${assignment.time_slot_id}`;
        if (!classDaysMap[key]) {
          classDaysMap[key] = new Set();
        }
        const dayName = dateToDay(assignment.date);
        if (dayName) {
          classDaysMap[key].add(dayName);
        }
      });
    });

    // Now calculate stats for each teacher at each time slot
    teachers.forEach(teacher => {
      timeSlots?.forEach(slot => {
        const key = `${teacher.name}-${slot.id}`;
        const classDays = [];
        const freeDays = [];
        const offDays = [];

        weekDays.forEach(day => {
          const availability = teacherAvailabilityByDay[teacher.name]?.[day] || [];
          const isAvailable = availability.includes(slot.id);
          const hasClass = classDaysMap[key]?.has(day) || false;

          if (hasClass) {
            classDays.push(day);
          } else if (isAvailable) {
            freeDays.push(day);
          } else {
            offDays.push(day);
          }
        });

        stats[key] = { classDays, freeDays, offDays };
      });
    });

    return stats;
  }, [isAllWeekMode, assignments, teachers, timeSlots, teacherAvailabilityByDay]);

  // Get cell status for a teacher at a time slot
  const getCellStatus = (teacher, timeSlotId) => {
    const key = `${teacher.name}-${timeSlotId}`;
    const teacherAssignments = assignmentMap[key] || [];

    if (isAllWeekMode) {
      const stats = weeklyStats[key];
      if (!stats) {
        return { status: 'unavailable', display: '—' };
      }

      const { classDays, freeDays, offDays } = stats;

      // If teacher is off all week at this time
      if (offDays.length === 7) {
        return { status: 'unavailable', display: '—' };
      }

      return {
        status: 'weekly',
        classDays,
        freeDays,
        offDays
      };
    }

    // Single day mode
    const isAvailable = teacher.availability?.includes(timeSlotId);

    if (!isAvailable) {
      return { status: 'unavailable', display: '—' };
    }

    if (teacherAssignments.length > 0) {
      const assignment = teacherAssignments[0];
      const studentCount = assignment.students?.length || 0;
      const subject = assignment.subject || 'Class';
      return {
        status: 'busy',
        display: subject,
        subDisplay: `(${studentCount} student${studentCount !== 1 ? 's' : ''})`,
        assignment
      };
    }

    return { status: 'free', display: 'Free' };
  };

  // Handle click on Free cell
  const handleFreeClick = (teacher, timeSlotId) => {
    if (isAllWeekMode) return; // Disable click in All Week mode
    setSelectedCell({
      teacherId: teacher.id,
      teacherName: teacher.name,
      timeSlotId
    });
    setIsModalOpen(true);
  };

  // Handle modal close
  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedCell(null);
  };

  // Handle assignment saved
  const handleAssignmentSaved = () => {
    queryClient.invalidateQueries(['assignments']);
    handleModalClose();
  };

  // Get cell styling based on status
  const getCellStyles = (status) => {
    switch (status) {
      case 'free':
        return 'bg-green-100 text-green-700 cursor-pointer hover:bg-green-200';
      case 'busy':
        return 'bg-blue-200 text-blue-800';
      case 'weekly':
        return 'bg-white';
      case 'unavailable':
      default:
        return 'bg-gray-100 text-gray-400';
    }
  };

  const isLoading = timeSlotsLoading || teachersLoading || assignmentsLoading || allWeekTeachersLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading teacher hours...</div>
      </div>
    );
  }

  if (!teachers || teachers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">No teachers found for {selectedDay || 'this date'}.</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800">Teacher Working Hours</h2>
        <p className="text-sm text-gray-600">
          {isAllWeekMode
            ? 'Showing aggregated availability for the entire week'
            : `Showing availability for ${selectedDay}`}
        </p>
        <div className="flex gap-4 mt-2 text-xs flex-wrap">
          {isAllWeekMode ? (
            <>
              <span className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-[10px] font-medium">Mon</span>
                Has Class
              </span>
              <span className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 bg-green-500 text-white rounded text-[10px] font-medium">Tue</span>
                Free (available, no class)
              </span>
              <span className="flex items-center gap-1">
                <span className="text-gray-400 text-[10px]">Off: Wed</span>
                Not available
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded bg-green-100 border border-green-300"></span>
                Free (click to assign)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded bg-blue-200 border border-blue-300"></span>
                Has Class
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded bg-gray-100 border border-gray-300"></span>
                Unavailable
              </span>
            </>
          )}
        </div>
      </div>

      <style>{`
        .shadow-r {
          box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
        }
        .shadow-b {
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
      `}</style>

      <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto border border-gray-300 rounded-lg">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200">
              <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700 border-r border-gray-300 sticky left-0 top-0 bg-gray-200 z-20 shadow-r shadow-b min-w-[120px]">
                Time Slot
              </th>
              {teachers.map((teacher) => (
                <th
                  key={teacher.id}
                  className="px-3 py-2 text-center text-sm font-semibold text-gray-700 border-r border-gray-300 sticky top-0 bg-gray-200 z-10 shadow-b min-w-[100px] max-w-[120px]"
                >
                  <div className="truncate" title={teacher.name}>
                    {teacher.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots?.map((slot, rowIndex) => (
              <tr key={slot.id} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2 text-sm font-medium text-gray-700 border-r border-b border-gray-300 sticky left-0 z-10 shadow-r bg-inherit">
                  <div className="text-xs whitespace-nowrap">
                    {slot.name}
                  </div>
                </td>
                {teachers.map((teacher) => {
                  const cell = getCellStatus(teacher, slot.id);
                  const isClickable = cell.status === 'free' && !isAllWeekMode;

                  return (
                    <td
                      key={`${teacher.id}-${slot.id}`}
                      className={`px-2 py-2 text-center text-xs border-r border-b border-gray-300 transition-colors ${getCellStyles(cell.status)} ${isClickable ? '' : 'cursor-default'}`}
                      onClick={isClickable ? () => handleFreeClick(teacher, slot.id) : undefined}
                      title={cell.status === 'busy' ? `${cell.display} ${cell.subDisplay}` : cell.display}
                    >
                      {/* All Week mode - show Class/Free/Off badges */}
                      {cell.status === 'weekly' && (
                        <div className="space-y-1">
                          {/* Class days - Blue badges */}
                          {cell.classDays.length > 0 && (
                            <div className="flex flex-wrap gap-0.5 justify-center">
                              {cell.classDays.map(day => (
                                <span
                                  key={day}
                                  className="px-1 py-0.5 bg-blue-500 text-white rounded text-[9px] font-medium"
                                  title={`Has class on ${day}`}
                                >
                                  {dayAbbrev[day]}
                                </span>
                              ))}
                            </div>
                          )}
                          {/* Free days - Green badges */}
                          {cell.freeDays.length > 0 && (
                            <div className="flex flex-wrap gap-0.5 justify-center">
                              {cell.freeDays.map(day => (
                                <span
                                  key={day}
                                  className="px-1 py-0.5 bg-green-500 text-white rounded text-[9px] font-medium"
                                  title={`Free on ${day}`}
                                >
                                  {dayAbbrev[day]}
                                </span>
                              ))}
                            </div>
                          )}
                          {/* Off days - Gray text (only show if there are some) */}
                          {cell.offDays.length > 0 && cell.offDays.length < 7 && (
                            <div className="text-[9px] text-gray-400">
                              Off: {cell.offDays.map(d => dayAbbrev[d]).join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Single day mode - Free */}
                      {cell.status === 'free' && (
                        <div className="font-medium">{cell.display}</div>
                      )}
                      {/* Single day mode - Busy */}
                      {cell.status === 'busy' && (
                        <>
                          <div className="font-medium">{cell.display}</div>
                          {cell.subDisplay && (
                            <div className="text-xs opacity-75">{cell.subDisplay}</div>
                          )}
                        </>
                      )}
                      {/* Unavailable */}
                      {cell.status === 'unavailable' && (
                        <div className="font-medium">{cell.display}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Total Teachers:</span>
            <span className="ml-2 font-medium">{teachers.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Time Slots:</span>
            <span className="ml-2 font-medium">{timeSlots?.length || 0}</span>
          </div>
          <div>
            <span className="text-gray-500">Total Classes:</span>
            <span className="ml-2 font-medium">{assignments?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {isModalOpen && selectedCell && (
        <AssignmentModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSave={handleAssignmentSaved}
          selectedDate={selectedDate}
          timeSlotId={selectedCell.timeSlotId}
          autoSelectTeacherName={selectedCell.teacherName}
          timeSlots={timeSlots}
        />
      )}
    </div>
  );
}

export default TeacherHoursPage;
