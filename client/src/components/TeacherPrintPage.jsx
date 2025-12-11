import { useState, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import html2canvas from 'html2canvas';
import {
  getTeachers,
  getAssignmentsByDateRange,
  getTimeSlots
} from '../services/api';

function TeacherPrintPage({ selectedDate, selectedDay, isAllWeekMode = false }) {
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState('');
  const [viewMode, setViewMode] = useState('teacher'); // 'teacher' or 'time'
  const printRef = useRef(null);

  // Fetch teachers for the selected date (same as Teachers tab)
  const { data: teachers, isLoading: teachersLoading, error: teachersError } = useQuery({
    queryKey: ['teachers', selectedDate],
    queryFn: async () => {
      const response = await getTeachers(selectedDate);
      return response.data;
    },
    enabled: !!selectedDate,
  });

  // Fetch time slots for ordering
  const { data: timeSlots } = useQuery({
    queryKey: ['timeSlots'],
    queryFn: async () => {
      const response = await getTimeSlots();
      return response.data;
    },
  });

  // Fetch ALL assignments from the template week
  const { data: allAssignments } = useQuery({
    queryKey: ['allAssignments'],
    queryFn: async () => {
      // Fetch from the template week (where assignments are stored)
      const response = await getAssignmentsByDateRange('2024-01-01', 7);
      return response.data || [];
    },
  });

  // Get selected teacher data
  const selectedTeacher = useMemo(() => {
    if (!selectedTeacherId || !teachers) return null;
    return teachers.find(t => String(t.id) === String(selectedTeacherId));
  }, [selectedTeacherId, teachers]);

  // Get selected time slot data
  const selectedTimeSlot = useMemo(() => {
    if (!selectedTimeSlotId || !timeSlots) return null;
    return timeSlots.find(ts => String(ts.id) === String(selectedTimeSlotId));
  }, [selectedTimeSlotId, timeSlots]);

  // Filter assignments based on view mode
  const filteredAssignments = useMemo(() => {
    if (!allAssignments) return [];

    if (viewMode === 'teacher' && selectedTeacher) {
      return allAssignments.filter(assignment => {
        return assignment.teachers?.some(teacher => teacher.id === selectedTeacher.id);
      });
    } else if (viewMode === 'time' && selectedTimeSlot) {
      return allAssignments.filter(assignment => {
        return assignment.time_slot_id === selectedTimeSlot.id;
      });
    }

    return [];
  }, [allAssignments, selectedTeacher, selectedTimeSlot, viewMode]);

  // Helper function to convert date string to day name
  const dateToDay = (dateString) => {
    const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  // Group assignments by time slot and day for weekly view
  const weeklySchedule = useMemo(() => {
    if (!filteredAssignments || !timeSlots) return {};

    const schedule = {};
    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    // Determine which time slots to include based on view mode
    const timeSlotsToInclude = viewMode === 'time' && selectedTimeSlot 
      ? [selectedTimeSlot] 
      : timeSlots.sort((a, b) => a.display_order - b.display_order);
    
    // Initialize schedule structure
    timeSlotsToInclude.forEach(slot => {
      schedule[slot.id] = {
        timeSlot: slot,
        days: {}
      };
      weekDays.forEach(day => {
        schedule[slot.id].days[day] = [];
      });
    });

    // Fill in the assignments and handle consolidation based on view mode
    filteredAssignments.forEach(assignment => {
      const dayName = dateToDay(assignment.date);
      const timeSlotId = assignment.time_slot_id;
      
      if (schedule[timeSlotId] && schedule[timeSlotId].days[dayName]) {
        if (viewMode === 'time') {
          // In "By Time" mode, separate entries by teacher
          assignment.teachers?.forEach(teacher => {
            schedule[timeSlotId].days[dayName].push({
              subjects: [assignment.subject || ''],
              allStudents: assignment.students?.map(s => s.name) || [],
              allTeachers: [teacher.name],
              colors: [assignment.color_keyword || null]
            });
          });
        } else {
          // In "By Teacher" mode, consolidate as before
          let existingEntry = schedule[timeSlotId].days[dayName][0];
          
          if (!existingEntry) {
            // No existing entry, create new one
            schedule[timeSlotId].days[dayName].push({
              subjects: [assignment.subject || ''],
              allStudents: assignment.students?.map(s => s.name) || [],
              allTeachers: assignment.teachers?.map(t => t.name) || [],
              colors: [assignment.color_keyword || null]
            });
          } else {
            // Existing entry, consolidate data
            if (assignment.subject && !existingEntry.subjects.includes(assignment.subject)) {
              existingEntry.subjects.push(assignment.subject);
            }
            if (assignment.students) {
              assignment.students.forEach(student => {
                if (!existingEntry.allStudents.includes(student.name)) {
                  existingEntry.allStudents.push(student.name);
                }
              });
            }
            if (assignment.teachers) {
              assignment.teachers.forEach(teacher => {
                if (!existingEntry.allTeachers.includes(teacher.name)) {
                  existingEntry.allTeachers.push(teacher.name);
                }
              });
            }
            if (assignment.color_keyword && !existingEntry.colors.includes(assignment.color_keyword)) {
              existingEntry.colors.push(assignment.color_keyword);
            }
          }
        }
      }
    });

    return schedule;
  }, [filteredAssignments, timeSlots, viewMode, selectedTimeSlot]);


  // Get color class for assignments
  const getColorClass = (colorKeyword) => {
    if (!colorKeyword) return 'bg-gray-50';
    
    const colorMap = {
      red: 'bg-red-100 text-red-900',
      blue: 'bg-blue-100 text-blue-900',
      green: 'bg-green-100 text-green-900',
      yellow: 'bg-yellow-100 text-yellow-900',
      purple: 'bg-purple-100 text-purple-900',
      orange: 'bg-orange-100 text-orange-900',
      pink: 'bg-pink-100 text-pink-900',
    };
    return colorMap[colorKeyword] || 'bg-gray-50';
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadImage = async () => {
    if (!printRef.current) return;

    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const teacherName = selectedTeacher?.name || 'teacher';
        const dateStr = new Date().toISOString().split('T')[0];
        link.download = `${teacherName}_schedule_${dateStr}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error('Failed to download image:', error);
      alert('Failed to download image. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: letter;
            margin: 0.5in;
          }

          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          /* Hide the app header and navigation */
          body > div > div > header {
            display: none !important;
          }

          /* Hide the main wrapper background and padding */
          body > div > div > main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }

          /* Hide control panel */
          .print\\:hidden {
            display: none !important;
          }

          /* Make input/select look clean in print */
          input, select {
            border: none !important;
            background: transparent !important;
          }

          /* Ensure printable content takes proper space */
          .print-content {
            max-width: 100% !important;
            box-shadow: none !important;
            padding: 0 !important;
          }

          /* Remove hover effects in print */
          tr:hover {
            background: transparent !important;
          }
        }
      `}</style>

      {/* Control Panel - Hidden when printing */}
      <div className="print:hidden bg-white shadow-md p-6 mb-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Teacher Schedule Sheet</h1>

          {/* View Mode Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => {
                setViewMode('teacher');
                setSelectedTimeSlotId('');
              }}
              className={`px-4 py-2 rounded-lg font-medium ${
                viewMode === 'teacher'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              By Teacher
            </button>
            <button
              onClick={() => {
                setViewMode('time');
                setSelectedTeacherId('');
              }}
              className={`px-4 py-2 rounded-lg font-medium ${
                viewMode === 'time'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              By Time
            </button>
          </div>

          <div className="flex gap-4 items-end mb-4">

            {/* Teacher Selector */}
            {viewMode === 'teacher' && (
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Teacher
                </label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={teachersLoading}
                >
                  <option value="">
                    {teachersLoading ? 'Loading teachers...' : 
                     teachersError ? 'Error loading teachers' :
                     teachers?.length === 0 ? 'No teachers found' : 
                     '-- Choose a teacher --'}
                  </option>
                  {teachers?.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
                {teachersError && (
                  <p className="mt-1 text-sm text-red-600">
                    Error: {teachersError.message}
                  </p>
                )}
                {teachers?.length === 0 && !teachersLoading && (
                  <p className="mt-1 text-sm text-yellow-600">
                    No teachers found for {selectedDay}. Check the Teachers tab to add teachers.
                  </p>
                )}
              </div>
            )}

            {/* Time Slot Selector */}
            {viewMode === 'time' && (
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Time Slot
                </label>
                <select
                  value={selectedTimeSlotId}
                  onChange={(e) => setSelectedTimeSlotId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choose a time slot --</option>
                  {timeSlots?.sort((a, b) => a.display_order - b.display_order).map(slot => (
                    <option key={slot.id} value={slot.id}>
                      {slot.name} ({slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)})
                    </option>
                  ))}
                </select>
              </div>
            )}


            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                disabled={(viewMode === 'teacher' && !selectedTeacherId) || (viewMode === 'time' && !selectedTimeSlotId)}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Schedule
              </button>
              <button
                onClick={handleDownloadImage}
                disabled={(viewMode === 'teacher' && !selectedTeacherId) || (viewMode === 'time' && !selectedTimeSlotId)}
                className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download as Image
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Content */}
      {((viewMode === 'teacher' && selectedTeacherId && selectedTeacher) || 
        (viewMode === 'time' && selectedTimeSlotId && selectedTimeSlot)) && (
        <div ref={printRef} className="w-full max-w-5xl mx-auto bg-white p-3 print-content">
          {/* Header */}
          <div className="text-center mb-2">
            <h1 className="text-xl font-bold text-blue-900">ICAN Academy - Teacher Schedule Sheet</h1>
            <div className="w-full h-0.5 bg-blue-600 mt-1"></div>
          </div>

          {/* Information Section */}
          <div className="mb-2">
            <div className="border-2 border-gray-300">
              <h3 className="text-xs font-bold bg-blue-100 px-2 py-1 border-b-2 border-gray-300">
                {viewMode === 'teacher' ? 'Teacher Information' : 'Time Slot Information'}
              </h3>
              <div className="p-1.5">
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="h-5">
                      <td className="font-semibold w-24 align-top">
                        {viewMode === 'teacher' ? 'Name:' : 'Time Slot:'}
                      </td>
                      <td className="align-top">
                        {viewMode === 'teacher' ? selectedTeacher.name : 
                         `${selectedTimeSlot.name} (${selectedTimeSlot.start_time?.slice(0, 5)} - ${selectedTimeSlot.end_time?.slice(0, 5)})`}
                      </td>
                    </tr>
                    <tr className="h-5">
                      <td className="font-semibold align-top">Total Classes:</td>
                      <td className="align-top">{filteredAssignments.length}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Schedule Content */}
          <div className="border-2 border-gray-300">
            <div className="bg-blue-100 px-2 py-1 border-b-2 border-gray-300">
              <h3 className="text-xs font-bold">Weekly Schedule Grid</h3>
            </div>

            {filteredAssignments.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <div className="text-lg font-semibold mb-2">No Classes Found</div>
                <div>
                  {viewMode === 'teacher' ? 'This teacher is not currently assigned to any classes.' :
                   'No classes are scheduled at this time slot.'}
                </div>
              </div>
            ) : (
              /* Weekly Grid View */
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-1 py-0.5 font-semibold w-[12%]">Time</th>
                    <th className="border border-gray-300 px-1 py-0.5 font-semibold">Mon</th>
                    <th className="border border-gray-300 px-1 py-0.5 font-semibold">Tue</th>
                    <th className="border border-gray-300 px-1 py-0.5 font-semibold">Wed</th>
                    <th className="border border-gray-300 px-1 py-0.5 font-semibold">Thu</th>
                    <th className="border border-gray-300 px-1 py-0.5 font-semibold">Fri</th>
                    <th className="border border-gray-300 px-1 py-0.5 font-semibold">Sat</th>
                    <th className="border border-gray-300 px-1 py-0.5 font-semibold">Sun</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(weeklySchedule).map((timeSlotData, idx) => (
                    <tr key={idx}>
                      <td className="border border-gray-300 px-1 py-0.5 font-semibold bg-gray-50 text-center">
                        <div className="text-sm">
                          {timeSlotData.timeSlot?.start_time?.slice(0, 5)}-{timeSlotData.timeSlot?.end_time?.slice(0, 5)}
                        </div>
                      </td>
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                        <td key={day} className="border border-gray-300 px-1 py-0.5 align-top">
                          {timeSlotData.days[day].map((consolidatedEntry, entryIdx) => (
                            <div key={entryIdx} className={`p-1 rounded text-xs ${getColorClass(consolidatedEntry.colors[0])}`}>
                              <div className="font-semibold">{consolidatedEntry.subjects.join(', ')}</div>
                              <div className="text-xs">{consolidatedEntry.allStudents.join(', ')}</div>
                              {viewMode === 'time' && (
                                <div className="text-xs font-medium">{consolidatedEntry.allTeachers.join(', ')}</div>
                              )}
                            </div>
                          ))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="mt-2 pt-1.5 border-t border-gray-300 text-center">
            <p className="text-xs text-gray-500">Generated: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {((viewMode === 'teacher' && !selectedTeacherId) || 
        (viewMode === 'time' && !selectedTimeSlotId)) && (
        <div className="max-w-4xl mx-auto text-center py-20">
          <div className="text-gray-400 mb-4">
            <svg className="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-2xl font-semibold text-gray-700 mb-2">
            {viewMode === 'teacher' ? 'Select a teacher' : 'Select a time slot'}
          </h3>
          <p className="text-gray-500">
            {viewMode === 'teacher' ? 'Choose a teacher to view their schedule' : 'Choose a time slot to see all teachers with classes at that time'}
          </p>
        </div>
      )}
    </div>
  );
}

export default TeacherPrintPage;