import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import html2canvas from 'html2canvas';
import {
  getAllUniqueStudents,
  getStudents,
  getStudentById,
  updateStudent,
  getAssignmentsByDateRange,
  getTimeSlots,
  getRooms,
  getAllNotionStudents
} from '../services/api';

function StudentPrintPage() {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const printRef = useRef(null);
  const queryClient = useQueryClient();

  // Get today's date for fetching student data (same approach as Students tab)
  const getCurrentDate = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  // Fetch all unique students for the dropdown
  const { data: allUniqueStudents } = useQuery({
    queryKey: ['allUniqueStudents'],
    queryFn: async () => {
      const response = await getAllUniqueStudents();
      return response.data;
    },
  });

  // Fetch students for current date (to get the specific student data with status)
  const { data: allStudentsForDate } = useQuery({
    queryKey: ['students', getCurrentDate()],
    queryFn: async () => {
      const response = await getStudents(getCurrentDate());
      return response.data;
    },
  });

  // Fetch Notion students to get Notion IDs
  const { data: allNotionStudents } = useQuery({
    queryKey: ['notionStudents'],
    queryFn: async () => {
      const response = await getAllNotionStudents();
      return response.data;
    },
  });

  // Use unique students for the dropdown
  const students = useMemo(() => {
    if (!allUniqueStudents) return [];
    return allUniqueStudents.sort((a, b) => a.name.localeCompare(b.name));
  }, [allUniqueStudents]);

  const loadingStudents = !allUniqueStudents;

  // Fetch the specific student by ID to get the most recent data
  const { data: specificStudentData } = useQuery({
    queryKey: ['specificStudent', selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return null;
      const response = await getStudentById(selectedStudentId);
      return response.data;
    },
    enabled: !!selectedStudentId
  });

  // Get the specific student data - prefer specific fetch, then date-specific, then unique
  const studentData = useMemo(() => {
    if (!selectedStudentId) return null;
    
    console.log('=== STUDENT DATA LOOKUP ===');
    console.log('Looking for student ID:', selectedStudentId);
    
    // First try the specific student data fetch (most recent)
    let student = specificStudentData;
    if (student) {
      console.log('Found specific student data:', student.name);
    } else {
      // Fallback to date-specific list
      if (allStudentsForDate) {
        student = allStudentsForDate.find(s => String(s.id) === String(selectedStudentId));
        console.log('Found in date-specific list:', student ? student.name : 'Not found');
      }
      
      // Final fallback to unique student
      if (!student && allUniqueStudents) {
        student = allUniqueStudents.find(s => String(s.id) === String(selectedStudentId));
        console.log('Found in unique list:', student ? student.name : 'Not found');
        
        // If using unique student, they don't have current availability, so default to empty
        if (student && !student.availability) {
          student = { ...student, availability: [] };
        }
      }
    }
    
    // Try to match with Notion student data to get Notion ID
    if (student && allNotionStudents) {
      const notionStudent = allNotionStudents.find(ns => {
        // Try to match by name (case-insensitive)
        const nameMatch = ns.name?.toLowerCase() === student.name?.toLowerCase();
        const englishNameMatch = ns.englishName?.toLowerCase() === student.english_name?.toLowerCase();
        return nameMatch || englishNameMatch;
      });
      
      if (notionStudent) {
        student = { 
          ...student, 
          notion_id: notionStudent.notionId,
          notion_student_id: notionStudent.studentId,
          notion_gender: notionStudent.gender,
          notion_start_date: notionStudent.startDate
        };
        console.log('Found matching Notion student, added notion_id:', notionStudent.notionId);
        console.log('Found Notion Student ID:', notionStudent.studentId);
        console.log('Found Notion Gender:', notionStudent.gender);
        console.log('Found Notion Start Date:', notionStudent.startDate);
        console.log('Complete Notion student data:', notionStudent);
      } else {
        console.log('No matching Notion student found');
        console.log('Available Notion students:', allNotionStudents?.map(ns => ({ name: ns.name, englishName: ns.englishName, studentId: ns.studentId, gender: ns.gender, startDate: ns.startDate })));
      }
    }
    
    console.log('Final student data:', student);
    if (student) {
      console.log('Student availability:', student.availability);
      console.log('Notion ID:', student.notion_id || 'Not found');
      console.log('First Start Date:', student.first_start_date);
      console.log('Program Start Date:', student.program_start_date);
      console.log('Notion Start Date:', student.notion_start_date);
    }
    console.log('===========================');
    
    return student || null;
  }, [specificStudentData, allStudentsForDate, allUniqueStudents, allNotionStudents, selectedStudentId]);

  // Mutation to update student fields
  const updateFieldMutation = useMutation({
    mutationFn: async ({ studentId, field, value }) => {
      // Update the student with the new field value
      const updatedData = { [field]: value };
      return await updateStudent(studentId, updatedData);
    },
    onSuccess: () => {
      // Invalidate and refetch student data
      queryClient.invalidateQueries(['student', selectedStudentId]);
    },
  });

  // Fetch time slots
  const { data: timeSlots } = useQuery({
    queryKey: ['timeSlots'],
    queryFn: async () => {
      const response = await getTimeSlots();
      return response.data;
    },
  });

  // Fetch rooms
  const { data: rooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const response = await getRooms();
      return response.data;
    },
  });

  // Fetch ALL assignments and filter for this specific student
  const { data: allAssignments } = useQuery({
    queryKey: ['allAssignments'],
    queryFn: async () => {
      console.log('=== FETCHING ALL ASSIGNMENTS ===');
      
      // Fetch from the template week (where assignments are stored)
      const response = await getAssignmentsByDateRange('2024-01-01', 7);
      const assignments = response.data || [];
      
      console.log('Total assignments in system:', assignments.length);
      return assignments;
    },
  });

  // Filter assignments for this specific student only
  const studentAssignments = useMemo(() => {
    if (!allAssignments || !studentData) {
      console.log('No assignments or student data available');
      return [];
    }

    console.log(`=== DETAILED FILTERING FOR STUDENT: ${studentData.name} ===`);
    console.log('Student data:', {
      id: studentData.id,
      name: studentData.name,
      english_name: studentData.english_name,
      idType: typeof studentData.id
    });
    console.log('Total assignments to search through:', allAssignments.length);
    
    // Debug: Show all assignments with their students
    allAssignments.forEach((assignment, index) => {
      console.log(`Assignment ${index + 1} (ID: ${assignment.id}):`, {
        subject: assignment.subject,
        date: assignment.date,
        students: assignment.students?.map(s => ({
          id: s.id,
          name: s.name,
          english_name: s.english_name,
          idType: typeof s.id
        }))
      });
    });
    
    const filteredAssignments = allAssignments.filter(assignment => {
      // Try multiple matching strategies
      const studentInAssignment = assignment.students?.find(s => {
        // Strategy 1: Direct ID match
        const idMatch = s.id === studentData.id;
        
        // Strategy 2: String/Number conversion match
        const idStringMatch = String(s.id) === String(studentData.id);
        
        // Strategy 3: Name matching (fallback) - case insensitive
        const nameMatch = s.name?.toLowerCase() === studentData.name?.toLowerCase() || 
                         s.english_name?.toLowerCase() === studentData.name?.toLowerCase() ||
                         s.name?.toLowerCase() === studentData.english_name?.toLowerCase();
        
        if (idMatch || idStringMatch || nameMatch) {
          console.log('✅ MATCH FOUND!', {
            strategy: idMatch ? 'Direct ID' : idStringMatch ? 'String ID' : 'Name',
            assignmentStudent: { id: s.id, name: s.name },
            selectedStudent: { id: studentData.id, name: studentData.name }
          });
          return true;
        }
        
        return false;
      });
      
      if (studentInAssignment) {
        console.log('✅ Assignment matched for student:', {
          assignmentId: assignment.id,
          subject: assignment.subject,
          date: assignment.date,
          teachers: assignment.teachers?.map(t => t.name),
          students: assignment.students?.map(s => s.name)
        });
      }
      
      return !!studentInAssignment;
    });

    console.log(`🎯 FINAL RESULT: Found ${filteredAssignments.length} assignments for student ${studentData.name}`);
    console.log('Filtered assignments:', filteredAssignments.map(a => ({
      id: a.id,
      subject: a.subject,
      date: a.date
    })));
    console.log('=================================================');
    
    return filteredAssignments;
  }, [allAssignments, studentData]);

  // Show "No classes scheduled" when student has no assignments
  const hasNoClasses = !studentAssignments || studentAssignments.length === 0;

  // Calculate student status - assigned if they have any classes in the week, stopped if none
  const getStudentStatus = useMemo(() => {
    if (!studentData) return 'unknown';
    
    console.log('=== CALCULATING STUDENT STATUS ===');
    console.log('Student assignments found:', studentAssignments?.length || 0);
    
    // If student has any assignments in the week template, they are assigned
    if (studentAssignments && studentAssignments.length > 0) {
      console.log('Status: ASSIGNED (has at least one class in the week)');
      return 'assigned';
    }

    // If no assignments found, they are stopped
    console.log('Status: STOPPED (no classes scheduled)');
    return 'stopped';
  }, [studentData, studentAssignments]);

  // Import dateToDay function to match WeeklyGrid logic
  const dateToDay = (dateString) => {
    const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  // Group assignments exactly like WeeklyGrid does for this student
  const scheduleGroups = useMemo(() => {
    if (!studentAssignments || studentAssignments.length === 0) return [];
    
    const groups = {};
    
    // Group assignments by teacher and time slot (matching WeeklyGrid logic)
    studentAssignments.forEach((assignment) => {
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
            assignments: [],
            notes: assignment.notes || '',
            color: assignment.color_keyword || null
          };
          groups[key].classes.push(classGroup);
        }
        
        // Add this day and assignment to the class group
        if (dayName && !classGroup.days.includes(dayName)) {
          classGroup.days.push(dayName);
        }
        classGroup.assignments.push(assignment);
        
        // Update notes and color from the latest assignment
        if (assignment.notes) classGroup.notes = assignment.notes;
        if (assignment.color_keyword) classGroup.color = assignment.color_keyword;
      });
    });
    
    // Sort days in each class group
    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    Object.values(groups).forEach(group => {
      group.classes.forEach(classGroup => {
        classGroup.days.sort((a, b) => weekDays.indexOf(a) - weekDays.indexOf(b));
      });
    });
    
    // Convert to flat array and sort by time slot order
    const flatClasses = [];
    Object.values(groups).forEach(group => {
      const timeSlot = timeSlots?.find(ts => ts.id === group.time_slot_id);
      group.classes.forEach(classGroup => {
        flatClasses.push({
          time: timeSlot?.name || 'Unknown Time',
          displayOrder: timeSlot?.display_order || 999,
          teacher: group.teacher_name,
          subject: classGroup.subject,
          notes: classGroup.notes,
          color: classGroup.color,
          days: classGroup.days,
          studentNames: classGroup.studentNames
        });
      });
    });
    
    return flatClasses.sort((a, b) => a.displayOrder - b.displayOrder);
  }, [studentAssignments, timeSlots]);

  // Schedule rows are already processed from groups
  const scheduleRows = scheduleGroups;

  // Format the schedule rows for display
  const formattedScheduleRows = scheduleRows.map(row => {
    // Priority: Local first_start_date > Local program_start_date > Notion start_date > N/A
    let startDate = 'N/A';
    
    if (studentData?.first_start_date && studentData.first_start_date !== null) {
      startDate = new Date(studentData.first_start_date).toLocaleDateString();
    } else if (studentData?.program_start_date && studentData.program_start_date !== null) {
      startDate = new Date(studentData.program_start_date).toLocaleDateString();
    } else if (studentData?.notion_start_date && studentData.notion_start_date.trim() !== '') {
      startDate = new Date(studentData.notion_start_date).toLocaleDateString();
    }
    
    return {
      time: row.time,
      days: row.days.join(', '),
      teacher: row.teacher,
      subject: row.subject,
      startDate: startDate,
      notes: row.notes,
      color: row.color
    };
  });


  // Get color class for assignments like in the scheduler
  const getColorClass = (colorKeyword) => {
    if (!colorKeyword) return 'bg-gray-100';
    
    const colorMap = {
      red: 'bg-red-200 text-red-900',
      blue: 'bg-blue-200 text-blue-900',
      green: 'bg-green-200 text-green-900',
      yellow: 'bg-yellow-200 text-yellow-900',
      purple: 'bg-purple-200 text-purple-900',
      orange: 'bg-orange-200 text-orange-900',
      pink: 'bg-pink-200 text-pink-900',
    };
    return colorMap[colorKeyword] || 'bg-gray-100';
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadImage = async () => {
    if (!printRef.current) return;

    try {
      const element = printRef.current;

      // Simple screenshot with html2canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const studentName = studentData?.name || 'student';
        const dateStr = selectedDate || new Date().toISOString().split('T')[0];
        link.download = `${studentName}_schedule_${dateStr}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error('Failed to download image:', error);
      alert('Failed to download image. Please try again.');
    }
  };

  // Reset date when student changes
  const handleStudentChange = (studentId) => {
    setSelectedStudentId(studentId);
    setSelectedDate(''); // Clear selected date when changing student
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
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Student Schedule Sheet</h1>

          <div className="flex gap-4 items-end mb-4">
            {/* Student Selector */}
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Student
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => handleStudentChange(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loadingStudents}
              >
                <option value="">-- Choose a student --</option>
                {students?.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.name} {student.english_name ? `(${student.english_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                disabled={!selectedStudentId}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Schedule
              </button>
              <button
                onClick={handleDownloadImage}
                disabled={!selectedStudentId}
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
      {selectedStudentId && studentData && (
        <div ref={printRef} className="w-full max-w-5xl mx-auto bg-white p-3 print-content">
          {/* Header */}
          <div className="text-center mb-2">
            <h1 className="text-xl font-bold text-blue-900">ICAN Academy - Student Schedule Sheet</h1>
            <div className="w-full h-0.5 bg-blue-600 mt-1"></div>
          </div>

          {/* Student Information */}
          <div className="mb-2">
            <div className="border-2 border-gray-300">
              <h3 className="text-xs font-bold bg-blue-100 px-2 py-1 border-b-2 border-gray-300">Student Information</h3>
              <div className="p-1.5">
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="h-5">
                      <td className="font-semibold w-24 align-top">Name:</td>
                      <td className="align-top">{studentData.name}</td>
                    </tr>
                    <tr className="h-5">
                      <td className="font-semibold align-top">English Name:</td>
                      <td className="align-top">{studentData.english_name || 'N/A'}</td>
                    </tr>
                    <tr className="h-5">
                      <td className="font-semibold align-top">Student ID:</td>
                      <td className="align-top">
                        {(studentData.notion_student_id && String(studentData.notion_student_id).trim() !== '') 
                          ? studentData.notion_student_id 
                          : (studentData.student_id || 'N/A')}
                      </td>
                    </tr>
                    <tr className="h-5">
                      <td className="font-semibold align-top">Gender:</td>
                      <td className="align-top">
                        {(studentData.notion_gender && String(studentData.notion_gender).trim() !== '') 
                          ? studentData.notion_gender 
                          : (studentData.gender || 'N/A')}
                      </td>
                    </tr>
                    <tr className="h-5">
                      <td className="font-semibold align-top">Grade:</td>
                      <td className="align-top">{studentData.grade || 'N/A'}</td>
                    </tr>
                    <tr className="h-5">
                      <td className="font-semibold align-top">Status:</td>
                      <td className="align-top">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          getStudentStatus === 'need-teachers' ? 'bg-yellow-100 text-yellow-800' :
                          getStudentStatus === 'assigned' ? 'bg-blue-100 text-blue-800' :
                          getStudentStatus === 'stopped' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {getStudentStatus === 'need-teachers' ? 'Need teachers' :
                           getStudentStatus === 'assigned' ? 'Assigned' :
                           getStudentStatus === 'stopped' ? 'Stopped' :
                           'Unknown'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>


          {/* Class Schedule */}
          <div className="border-2 border-gray-300">
            <div className="bg-blue-100 px-2 py-1 border-b-2 border-gray-300">
              <h3 className="text-xs font-bold">Weekly Class Schedule</h3>
            </div>

            {hasNoClasses ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <div className="text-lg font-semibold mb-2">No Classes Scheduled</div>
                <div>This student is not currently assigned to any classes.</div>
                {/* Display start date even when no classes */}
                {studentData && (
                  <div className="mt-4 text-gray-700">
                    <div className="text-sm font-semibold">Start Date:</div>
                    <div className="text-base">
                      {(() => {
                        
                        let startDate = 'N/A';
                        if (studentData?.first_start_date && studentData.first_start_date !== null) {
                          startDate = new Date(studentData.first_start_date).toLocaleDateString();
                        } else if (studentData?.program_start_date && studentData.program_start_date !== null) {
                          startDate = new Date(studentData.program_start_date).toLocaleDateString();
                        } else if (studentData?.notion_start_date && studentData.notion_start_date.trim() !== '') {
                          startDate = new Date(studentData.notion_start_date).toLocaleDateString();
                        }
                        return startDate;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-1.5 py-0.5 font-semibold text-center w-[12%]">Time</th>
                    <th className="border border-gray-300 px-1.5 py-0.5 font-semibold text-center w-[15%]">Days</th>
                    <th className="border border-gray-300 px-1.5 py-0.5 font-semibold text-center w-[12%]">Teacher</th>
                    <th className="border border-gray-300 px-1.5 py-0.5 font-semibold text-center w-[18%]">Subject</th>
                    <th className="border border-gray-300 px-1.5 py-0.5 font-semibold text-center w-[15%]">Start Date</th>
                    <th className="border border-gray-300 px-1.5 py-0.5 font-semibold text-center">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {formattedScheduleRows.map((row, idx) => (
                    <tr key={idx} className={`hover:bg-gray-50 ${getColorClass(row.color)}`}>
                      <td className="border border-gray-300 px-1.5 py-0.5 text-center">{row.time}</td>
                      <td className="border border-gray-300 px-1.5 py-0.5 text-center">{row.days}</td>
                      <td className="border border-gray-300 px-1.5 py-0.5 text-center">{row.teacher}</td>
                      <td className="border border-gray-300 px-1.5 py-0.5 text-center font-semibold">{row.subject}</td>
                      <td className="border border-gray-300 px-1.5 py-0.5 text-center">{row.startDate}</td>
                      <td className="border border-gray-300 px-1.5 py-0.5 text-center">{row.notes}</td>
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
      {!selectedStudentId && (
        <div className="max-w-4xl mx-auto text-center py-20">
          <div className="text-gray-400 mb-4">
            <svg className="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-2xl font-semibold text-gray-700 mb-2">Select a student and date</h3>
          <p className="text-gray-500">Choose a student and a schedule date to generate the schedule sheet</p>
        </div>
      )}
    </div>
  );
}

export default StudentPrintPage;
