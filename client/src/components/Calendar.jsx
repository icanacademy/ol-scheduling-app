import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTeachers, getStudents, getAssignments } from '../services/api';

function Calendar({ selectedDate, onDateChange }) {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));
  const [isOpen, setIsOpen] = useState(false);

  // Fetch data indicators for the current month
  const { data: dateIndicators } = useQuery({
    queryKey: ['dateIndicators', currentMonth.getFullYear(), currentMonth.getMonth()],
    queryFn: async () => {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const indicators = {};

      // Check each day in the month
      for (let day = 1; day <= lastDay.getDate(); day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        try {
          const [teachersRes, studentsRes, assignmentsRes] = await Promise.all([
            getTeachers(dateStr),
            getStudents(dateStr),
            getAssignments(dateStr)
          ]);

          indicators[dateStr] = {
            hasTeachers: teachersRes.data.length > 0,
            hasStudents: studentsRes.data.length > 0,
            hasAssignments: assignmentsRes.data.length > 0
          };
        } catch (error) {
          // Silently fail for individual dates
          indicators[dateStr] = {
            hasTeachers: false,
            hasStudents: false,
            hasAssignments: false
          };
        }
      }

      return indicators;
    },
    staleTime: 60000, // Cache for 1 minute
  });

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  const formatDate = (year, month, day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const handleDateClick = (day) => {
    if (day) {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const dateStr = formatDate(year, month, day);
      onDateChange(dateStr);
      setIsOpen(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="relative">
      {/* Date Input */}
      <div className="relative">
        <input
          type="text"
          value={new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
          onClick={() => setIsOpen(!isOpen)}
          readOnly
          className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer bg-white min-w-[200px]"
        />
      </div>

      {/* Calendar Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-xl border-2 border-gray-200 p-4 z-50 min-w-[320px]">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handlePrevMonth}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ‹
              </button>
              <div className="font-semibold text-gray-900">{monthName}</div>
              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ›
              </button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-semibold text-gray-600 py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="p-2" />;
                }

                const dateStr = formatDate(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === new Date().toISOString().split('T')[0];
                const indicators = dateIndicators?.[dateStr] || {};

                return (
                  <button
                    key={day}
                    onClick={() => handleDateClick(day)}
                    className={`
                      relative p-2 text-sm rounded-lg hover:bg-blue-50 transition-colors
                      ${isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                      ${isToday && !isSelected ? 'bg-blue-100 font-semibold' : ''}
                    `}
                  >
                    {day}

                    {/* Data Indicators */}
                    {(indicators.hasTeachers || indicators.hasStudents || indicators.hasAssignments) && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                        {indicators.hasTeachers && (
                          <div className="w-1 h-1 rounded-full bg-blue-500" title="Has teachers" />
                        )}
                        {indicators.hasStudents && (
                          <div className="w-1 h-1 rounded-full bg-green-500" title="Has students" />
                        )}
                        {indicators.hasAssignments && (
                          <div className="w-1 h-1 rounded-full bg-purple-500" title="Has assignments" />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-600 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Teachers</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>Students</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Assignments</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Calendar;
