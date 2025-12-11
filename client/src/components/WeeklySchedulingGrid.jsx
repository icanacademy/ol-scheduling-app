import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWeeklyStudents, getTimeSlots } from '../services/api';

function WeeklySchedulingGrid({ selectedDate }) {
  const [selectedStudents, setSelectedStudents] = useState({});
  
  // Get time slots
  const { data: timeSlots } = useQuery({
    queryKey: ['timeSlots'],
    queryFn: async () => {
      const response = await getTimeSlots();
      return response.data;
    },
  });

  // Get weekly student data
  const { data: weeklyData, isLoading } = useQuery({
    queryKey: ['weeklyStudents', selectedDate],
    queryFn: async () => {
      const response = await getWeeklyStudents(selectedDate);
      return response.data;
    },
    enabled: !!selectedDate,
  });


  // Helper functions
  const getDayName = (dateString) => {
    const date = new Date(dateString + 'T00:00:00.000Z');
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      timeZone: 'UTC'
    });
  };

  const getDateDisplay = (dateString) => {
    const date = new Date(dateString + 'T00:00:00.000Z');
    return date.toLocaleDateString('en-US', { 
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
  };

  const toggleStudentSelection = (date, timeSlotId, studentId) => {
    const key = `${date}-${timeSlotId}`;
    setSelectedStudents(prev => {
      const current = prev[key] || new Set();
      const newSet = new Set(current);
      
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      
      return {
        ...prev,
        [key]: newSet
      };
    });
  };

  const getStudentColor = (student) => {
    if (!student.color_keyword) return '#3b82f6';
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

  const isStudentSelected = (date, timeSlotId, studentId) => {
    const key = `${date}-${timeSlotId}`;
    const selectedSet = selectedStudents[key] || new Set();
    return selectedSet.has(studentId);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading weekly schedule...</div>;
  }

  if (!weeklyData) {
    return <div className="text-center py-8">No weekly data available</div>;
  }

  const { data: dailyData, weekRange } = weeklyData;
  const dates = Object.keys(dailyData).sort();

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Weekly Schedule</h2>
        <p className="text-gray-600">
          Week of {getDateDisplay(weekRange.startDate)} - {getDateDisplay(weekRange.endDate)}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            {/* Day headers */}
            <tr className="bg-gray-50 border-b-2 border-gray-300">
              <th className="px-3 py-3 text-left text-sm font-semibold text-gray-900 border-r-2 border-gray-300 sticky left-0 bg-gray-50 z-20">
                Time Slot
              </th>
              {dates.map((date) => (
                <th
                  key={date}
                  className="px-3 py-3 text-center text-sm font-semibold text-gray-900 border-r border-gray-200 min-w-[160px]"
                >
                  <div className="text-blue-700 font-bold">
                    {getDayName(date)}
                  </div>
                  <div className="text-gray-500 text-xs">
                    {getDateDisplay(date)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {dailyData[date].students.length} students
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {timeSlots?.map((slot, slotIndex) => (
              <tr key={slot.id} className="hover:bg-gray-50">
                {/* Time slot label */}
                <td className="px-3 py-2 text-sm font-medium text-gray-900 border-r-2 border-gray-300 sticky left-0 bg-white z-10">
                  <div className="text-xs">
                    {slot.name.replace(' to ', '-')}
                  </div>
                </td>
                
                {/* Student cells for each day */}
                {dates.map((date) => {
                  const dayData = dailyData[date];
                  const availableStudents = dayData.students.filter(student => 
                    student.availability?.includes(slot.id)
                  );

                  return (
                    <td
                      key={`${date}-${slot.id}`}
                      className="px-2 py-2 border border-gray-300 min-h-[60px] align-top"
                    >
                      <div className="space-y-1">
                        {availableStudents.map((student) => {
                          const isSelected = isStudentSelected(date, slot.id, student.id);
                          return (
                            <div
                              key={student.id}
                              onClick={() => toggleStudentSelection(date, slot.id, student.id)}
                              className={`text-xs p-1 rounded cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                              }`}
                              style={{
                                borderLeft: `3px solid ${getStudentColor(student)}`,
                              }}
                              title={`${student.name}${student.schedule_pattern ? ` (${student.schedule_pattern})` : ''}`}
                            >
                              <div className="font-medium truncate">
                                {student.name}
                              </div>
                              {student.schedule_pattern && (
                                <div className="text-xs opacity-75 truncate">
                                  {student.schedule_pattern}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        
                        {/* Empty state */}
                        {availableStudents.length === 0 && (
                          <div className="text-xs text-gray-400 italic py-2">
                            No students available
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-4 grid grid-cols-7 gap-4 text-sm">
        {dates.map((date) => {
          const dayData = dailyData[date];
          const selectedCount = Object.entries(selectedStudents)
            .filter(([key]) => key.startsWith(date))
            .reduce((count, [, studentSet]) => count + studentSet.size, 0);

          return (
            <div key={date} className="text-center p-2 bg-gray-50 rounded">
              <div className="font-medium text-gray-900">
                {getDayName(date)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {dayData.students.length} available
              </div>
              {selectedCount > 0 && (
                <div className="text-xs text-blue-600 font-medium">
                  {selectedCount} scheduled
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex gap-3 justify-center">
        <button
          onClick={() => setSelectedStudents({})}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
        >
          Clear All Selections
        </button>
        <button
          onClick={() => {
            // TODO: Implement batch scheduling
            console.log('Selected students:', selectedStudents);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Apply Schedule
        </button>
      </div>

    </div>
  );

}

export default WeeklySchedulingGrid;