import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTeachers,
  getStudents,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  validateAssignment,
  getAssignments,
} from '../services/api';
import { weekDays, dayToDate, dateToDay } from '../utils/dayMapping';

// Helper to merge teachers from multiple days into a single list with combined availability
function mergeTeachersFromAllDays(teachersByDay) {
  const mergedMap = new Map();

  Object.entries(teachersByDay).forEach(([day, dayTeachers]) => {
    dayTeachers.forEach(teacher => {
      if (!mergedMap.has(teacher.name)) {
        // First time seeing this teacher - store with their availability for this day
        mergedMap.set(teacher.name, {
          ...teacher,
          availabilityByDay: { [day]: teacher.availability || [] }
        });
      } else {
        // Already seen this teacher - add this day's availability
        const existing = mergedMap.get(teacher.name);
        existing.availabilityByDay[day] = teacher.availability || [];
      }
    });
  });

  // Convert back to array, combining all availabilities
  return Array.from(mergedMap.values()).map(teacher => ({
    ...teacher,
    // Combined availability = union of all days' availability
    availability: [...new Set(
      Object.values(teacher.availabilityByDay).flat()
    )]
  }));
}

function AssignmentModal({
  isOpen,
  onClose,
  onSave,
  selectedDate,
  timeSlotId,
  roomId,
  existingAssignment,
  timeSlots,
  isAllWeekMode = false, // New prop to indicate All Week mode
  classGroupDays = null, // Array of days this class group spans
  autoSelectTeacherName = null, // Auto-select teacher based on clicked row
}) {
  const queryClient = useQueryClient();
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [notes, setNotes] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [selectedDays, setSelectedDays] = useState(['Monday']); // Always start with Monday selected
  const [classDuration, setClassDuration] = useState(25); // Default to 25 minutes
  const [dayConflicts, setDayConflicts] = useState({}); // Track conflicts per day
  const [classColor, setClassColor] = useState(''); // Color for the class

  // Get the time slot name for display
  const timeSlot = timeSlots.find((ts) => ts.id === timeSlotId);

  // Fetch all teachers - in All Week mode, fetch from all days to get complete availability
  const { data: teachers, error: teachersError, isLoading: teachersLoading } = useQuery({
    queryKey: ['teachers-modal', isAllWeekMode ? 'all-week' : selectedDate],
    queryFn: async () => {
      if (isAllWeekMode) {
        // Fetch teachers for all 7 days and merge them
        const teachersByDay = {};
        for (const day of weekDays) {
          const date = dayToDate(day);
          if (date) {
            const response = await getTeachers(date);
            teachersByDay[day] = response?.data || [];
          }
        }
        // Merge teachers from all days, combining their availability
        const merged = mergeTeachersFromAllDays(teachersByDay);
        return merged;
      } else {
        if (!selectedDate) return [];
        const response = await getTeachers(selectedDate);
        const teachersData = response?.data || [];

        // Deduplicate teachers by name to prevent duplicates from API
        const uniqueTeachers = [];
        const seenNames = new Set();

        teachersData.forEach(teacher => {
          if (!seenNames.has(teacher.name)) {
            seenNames.add(teacher.name);
            uniqueTeachers.push(teacher);
          }
        });

        return uniqueTeachers;
      }
    },
    enabled: isAllWeekMode || !!selectedDate,
    staleTime: 0, // Always fetch fresh data
  });

  // Fetch all students - in All Week mode, fetch from all days to get complete availability
  const { data: students, error: studentsError, isLoading: studentsLoading } = useQuery({
    queryKey: ['students-modal', isAllWeekMode ? 'all-week' : selectedDate],
    queryFn: async () => {
      if (isAllWeekMode) {
        // Fetch students for all 7 days and merge them (similar to teachers)
        const studentsByDay = {};
        for (const day of weekDays) {
          const date = dayToDate(day);
          if (date) {
            const response = await getStudents(date);
            studentsByDay[day] = response?.data || [];
          }
        }
        // Merge students from all days, combining their availability
        const mergedMap = new Map();
        Object.entries(studentsByDay).forEach(([day, dayStudents]) => {
          dayStudents.forEach(student => {
            if (!mergedMap.has(student.name)) {
              mergedMap.set(student.name, {
                ...student,
                availabilityByDay: { [day]: student.availability || [] }
              });
            } else {
              const existing = mergedMap.get(student.name);
              existing.availabilityByDay[day] = student.availability || [];
            }
          });
        });
        return Array.from(mergedMap.values()).map(student => ({
          ...student,
          availability: [...new Set(
            Object.values(student.availabilityByDay).flat()
          )]
        }));
      } else {
        if (!selectedDate) return [];
        const response = await getStudents(selectedDate);
        const studentsData = response?.data || [];

        // Deduplicate students by name to prevent duplicates from API
        const uniqueStudents = [];
        const seenNames = new Set();

        studentsData.forEach(student => {
          if (!seenNames.has(student.name)) {
            seenNames.add(student.name);
            uniqueStudents.push(student);
          }
        });

        return uniqueStudents;
      }
    },
    enabled: isAllWeekMode || !!selectedDate,
    staleTime: 0, // Always fetch fresh data
  });

  // Fetch all assignments for this date and time slot
  const { data: allAssignments, error: assignmentsError, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['assignments', selectedDate],
    queryFn: async () => {
      if (!selectedDate) return [];
      const response = await getAssignments(selectedDate);
      return response?.data || [];
    },
    enabled: !!selectedDate && isOpen,
  });

  // In All Week mode, fetch assignments for all days of the week
  const { data: allWeekAssignments } = useQuery({
    queryKey: ['allWeekAssignments'],
    queryFn: async () => {
      const allAssignmentsMap = {};
      for (const day of weekDays) {
        const date = dayToDate(day);
        if (date) {
          const response = await getAssignments(date);
          allAssignmentsMap[day] = response?.data || [];
        }
      }
      return allAssignmentsMap;
    },
    enabled: isAllWeekMode && isOpen,
  });

  // Build maps of who's assigned where at this time slot
  // In All Week mode, check conflicts across all selected days
  const { teacherAssignments, studentAssignments } = useMemo(() => {
    const teacherMap = new Map();
    const studentMap = new Map();

    // In All Week mode, check conflicts for each selected day
    if (isAllWeekMode) {
      if (!allWeekAssignments) return { teacherAssignments: teacherMap, studentAssignments: studentMap };

      // Check each selected day for conflicts
      selectedDays.forEach((day) => {
        const dayAssignments = allWeekAssignments[day] || [];
        const relevantAssignments = dayAssignments.filter(
          (a) => a.time_slot_id === timeSlotId && a.id !== existingAssignment?.id
        );

        relevantAssignments.forEach((assignment) => {
          assignment.teachers?.forEach((teacher) => {
            teacherMap.set(teacher.id, `Scheduled on ${day}`);
          });
          assignment.students?.forEach((student) => {
            studentMap.set(student.id, `Scheduled on ${day}`);
          });
        });
      });

      return { teacherAssignments: teacherMap, studentAssignments: studentMap };
    }

    if (!allAssignments) return { teacherAssignments: teacherMap, studentAssignments: studentMap };

    // Filter assignments for this time slot, excluding the current assignment if editing
    const relevantAssignments = allAssignments.filter(
      (a) => a.time_slot_id === timeSlotId && a.id !== existingAssignment?.id
    );

    relevantAssignments.forEach((assignment) => {
      // Map teachers
      assignment.teachers?.forEach((teacher) => {
        teacherMap.set(teacher.id, 'Another Class');
      });

      // Map students
      assignment.students?.forEach((student) => {
        studentMap.set(student.id, 'Another Class');
      });
    });

    return { teacherAssignments: teacherMap, studentAssignments: studentMap };
  }, [allAssignments, allWeekAssignments, timeSlotId, existingAssignment?.id, isAllWeekMode, selectedDays]);

  // Get list of all teachers to show - includes available ones + currently selected ones (even if unavailable or deleted)
  // In All Week mode, show ALL teachers (they may be available on different days)
  const teachersToShow = useMemo(() => {
    if (!teachers) return [];

    const selectedTeacherIds = selectedTeachers.map((st) => st.teacher_id);

    // Create list of teachers to show (deduplicated by name)
    const teachersToShowMap = new Map(); // Use name as key instead of ID
    const seenTeacherNames = new Set();

    if (isAllWeekMode) {
      // In All Week mode, show ALL teachers - they may have availability on different days
      // Put the auto-selected teacher (clicked row) first
      if (autoSelectTeacherName) {
        const autoTeacher = teachers.find(t => t.name === autoSelectTeacherName);
        if (autoTeacher && !seenTeacherNames.has(autoTeacher.name)) {
          teachersToShowMap.set(autoTeacher.name, autoTeacher);
          seenTeacherNames.add(autoTeacher.name);
        }
      }

      // Add all other teachers
      teachers.forEach((teacher) => {
        if (!seenTeacherNames.has(teacher.name)) {
          teachersToShowMap.set(teacher.name, teacher);
          seenTeacherNames.add(teacher.name);
        }
      });
    } else {
      // Single day mode - filter by availability at this time slot
      const availableTeacherIds = new Set(
        teachers.filter((t) => t.availability && t.availability.includes(timeSlotId)).map((t) => t.id)
      );

      // Add all available teachers
      teachers.forEach((teacher) => {
        if (availableTeacherIds.has(teacher.id) && !seenTeacherNames.has(teacher.name)) {
          teachersToShowMap.set(teacher.name, teacher);
          seenTeacherNames.add(teacher.name);
        }
      });
    }

    // Add all selected teachers (even if deleted or unavailable)
    selectedTeacherIds.forEach((teacherId) => {
      const teacher = teachers.find(t => t.id === teacherId);
      if (teacher && !seenTeacherNames.has(teacher.name)) {
        // Teacher exists but might be unavailable
        teachersToShowMap.set(teacher.name, teacher);
        seenTeacherNames.add(teacher.name);
      } else if (!teacher) {
        // Teacher was deleted - create a placeholder
        const deletedName = `[DELETED TEACHER - ID: ${teacherId}]`;
        if (!seenTeacherNames.has(deletedName)) {
          teachersToShowMap.set(deletedName, {
            id: teacherId,
            name: deletedName,
            availability: [],
            color_keyword: null,
            isDeleted: true,
          });
          seenTeacherNames.add(deletedName);
        }
      }
    });

    return Array.from(teachersToShowMap.values());
  }, [teachers, timeSlotId, selectedTeachers, isAllWeekMode, autoSelectTeacherName]);

  // Get list of all students to show - includes available ones + currently selected ones (even if unavailable or deleted)
  // In All Week mode, show ALL students (they may be available on different days)
  const studentsToShow = useMemo(() => {
    if (!students) return [];

    const selectedStudentIds = selectedStudents.map((ss) => ss.student_id);
    const studentsMap = new Map(students.map((s) => [s.id, s]));

    // Create list of students to show (deduplicated by name)
    const studentsToShowMap = new Map();
    const seenStudentNames = new Set();

    if (isAllWeekMode) {
      // In All Week mode, show ALL students - they may have availability on different days
      // Exclude those already scheduled at this time slot (unless selected in current assignment)
      students.forEach((student) => {
        if (!seenStudentNames.has(student.name)) {
          const isAlreadyScheduled = studentAssignments.has(student.id);
          const isSelectedInCurrent = selectedStudentIds.includes(student.id);

          if (!isAlreadyScheduled || isSelectedInCurrent) {
            studentsToShowMap.set(student.name, student);
            seenStudentNames.add(student.name);
          }
        }
      });
    } else {
      // Single day mode - filter by availability at this time slot
      const availableStudentIds = new Set(
        students.filter((s) => s.availability && s.availability.includes(timeSlotId)).map((s) => s.id)
      );

      // Add all available students, excluding those already scheduled at this time slot
      students.forEach((student) => {
        if (availableStudentIds.has(student.id) && !seenStudentNames.has(student.name)) {
          const isAlreadyScheduled = studentAssignments.has(student.id);
          const isSelectedInCurrent = selectedStudentIds.includes(student.id);

          if (!isAlreadyScheduled || isSelectedInCurrent) {
            studentsToShowMap.set(student.name, student);
            seenStudentNames.add(student.name);
          }
        }
      });
    }

    // Add all selected students (even if deleted or unavailable)
    selectedStudentIds.forEach((studentId) => {
      const student = studentsMap.get(studentId);
      if (student && !seenStudentNames.has(student.name)) {
        // Student exists but is unavailable or doesn't match color filter
        studentsToShowMap.set(student.name, student);
        seenStudentNames.add(student.name);
      } else if (!student) {
        // Student was deleted - create a placeholder
        const deletedName = `[DELETED STUDENT - ID: ${studentId}]`;
        if (!seenStudentNames.has(deletedName)) {
          studentsToShowMap.set(deletedName, {
            id: studentId,
            name: deletedName,
            english_name: null,
            availability: [],
            color_keyword: null,
            weakness_level: null,
            isDeleted: true,
          });
          seenStudentNames.add(deletedName);
        }
      }
    });

    return Array.from(studentsToShowMap.values());
  }, [students, timeSlotId, selectedStudents, studentAssignments, isAllWeekMode]);

  // Initialize form with existing assignment data
  useEffect(() => {
    if (existingAssignment) {
      const teachersList = existingAssignment.teachers?.map((t) => ({
        teacher_id: t.id,
        is_substitute: t.is_substitute || false,
      })) || [];

      const studentsList = existingAssignment.students?.map((s) => ({
        student_id: s.id,
      })) || [];

      setSelectedTeachers(teachersList);
      setSelectedStudents(studentsList);
      setNotes(existingAssignment.notes || '');
      // Handle subject - could be string (old format) or array (new format)
      const existingSubject = existingAssignment.subject || '';
      if (Array.isArray(existingSubject)) {
        setSubjects(existingSubject);
      } else if (existingSubject) {
        setSubjects([existingSubject]);
      } else {
        setSubjects([]);
      }
      setClassColor(existingAssignment.color_keyword || '');
      
      // For editing, set the days of the class group (same student/time/duration classes)
      if (classGroupDays && classGroupDays.length > 0) {
        setSelectedDays(classGroupDays);
      } else if (existingAssignment.date) {
        const dayName = dateToDay(existingAssignment.date);
        if (dayName) {
          setSelectedDays([dayName]);
        }
      }
    }
  }, [existingAssignment, classGroupDays]);

  // Auto-select teacher when creating new assignment based on row clicked
  useEffect(() => {
    if (!existingAssignment && autoSelectTeacherName && teachers && teachers.length > 0) {
      // Find the teacher by name
      const teacher = teachers.find(t => t.name === autoSelectTeacherName);
      if (teacher) {
        // In All Week mode, auto-select the teacher regardless of availability
        // (the grid showed them as available, so they must be available on some day)
        // In single day mode, check availability
        if (isAllWeekMode || (teacher.availability && teacher.availability.includes(timeSlotId))) {
          setSelectedTeachers([{ teacher_id: teacher.id, is_substitute: false }]);
        }
      }
    }
  }, [existingAssignment, autoSelectTeacherName, teachers, timeSlotId, isAllWeekMode]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: createAssignment,
    onSuccess: () => {
      // Invalidate assignments cache to refresh the data
      queryClient.invalidateQueries({ queryKey: ['assignments'] }); // Invalidates all assignment queries
      queryClient.invalidateQueries({ queryKey: ['weeklyData'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error) => {
      console.error('Create mutation error:', error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateAssignment(id, data),
    onSuccess: () => {
      // Invalidate assignments cache to refresh the data
      console.log('Assignment updated successfully, invalidating cache');
      queryClient.removeQueries({ queryKey: ['assignments'] }); // Force remove all assignment cache
      queryClient.removeQueries({ queryKey: ['weeklyData'] });
      queryClient.removeQueries({ queryKey: ['teachers'] });
      queryClient.removeQueries({ queryKey: ['students'] });
    },
    onError: (error) => {
      console.error('Update mutation error:', error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAssignment,
    onError: (error) => {
      console.error('Delete mutation error:', error);
    },
  });

  const handleTeacherToggle = (teacherId) => {
    setSelectedTeachers((prev) => {
      const exists = prev.find((t) => t.teacher_id === teacherId);
      if (exists) {
        return prev.filter((t) => t.teacher_id !== teacherId);
      } else {
        if (prev.length >= 2) {
          alert('Maximum 2 teachers per room');
          return prev;
        }
        return [...prev, { teacher_id: teacherId, is_substitute: false }];
      }
    });
  };

  const handleSubstituteToggle = (teacherId) => {
    setSelectedTeachers((prev) =>
      prev.map((t) =>
        t.teacher_id === teacherId ? { ...t, is_substitute: !t.is_substitute } : t
      )
    );
  };

  const handleStudentToggle = (studentId) => {
    setSelectedStudents((prev) => {
      const exists = prev.find((s) => s.student_id === studentId);
      if (exists) {
        return prev.filter((s) => s.student_id !== studentId);
      } else {
        if (prev.length >= 5) {
          alert('Maximum 5 students per class');
          return prev;
        }
        return [...prev, { student_id: studentId }];
      }
    });
  };

  const toggleDay = (day) => {
    setSelectedDays(prev => {
      const current = [...prev];
      const index = current.indexOf(day);
      if (index > -1) {
        // Remove day if it exists
        current.splice(index, 1);
      } else {
        // Add day if it doesn't exist
        current.push(day);
      }
      return current.length === 0 ? ['Monday'] : current; // Always keep at least Monday
    });
    
    // Clear validation errors when days change
    setValidationErrors([]);
  };

  // Check for conflicts when editing existing assignment and days/teachers/students change
  useEffect(() => {
    console.log('Conflict detection useEffect triggered', {
      existingAssignment: !!existingAssignment,
      selectedTeachersCount: selectedTeachers.length,
      selectedStudentsCount: selectedStudents.length,
      selectedDays: selectedDays
    });
    
    if (existingAssignment && selectedTeachers.length > 0 && selectedStudents.length > 0 && teachers && students) {
      const checkConflicts = async () => {
        console.log('Starting conflict check for days:', selectedDays);
        const conflicts = {};
        const originalDays = classGroupDays || (existingAssignment ? [dateToDay(existingAssignment.date)].filter(Boolean) : []);
        console.log('Original class days:', originalDays);
        
        for (const day of selectedDays) {
          const targetDate = dayToDate(day);
          if (targetDate) {
            try {
              const response = await getAssignments(targetDate);
              const existingAssignments = response.data || [];
              
              // Filter assignments for this time slot, excluding ALL assignments from our current class group
              const conflictingAssignments = existingAssignments.filter((assignment) => {
                if (assignment.time_slot_id !== timeSlotId) return false;
                
                // Exclude the current assignment being edited
                if (assignment.id === existingAssignment.id) return false;
                
                // For class groups, check if this assignment belongs to our class group by matching students AND teachers
                if (existingAssignment) {
                  const sameTeachers = assignment.teachers?.some(teacher =>
                    selectedTeachers.some(selectedTeacher => selectedTeacher.teacher_id === teacher.id)
                  );
                  const sameStudents = assignment.students?.some(student =>
                    selectedStudents.some(selectedStudent => selectedStudent.student_id === student.id)
                  );
                  
                  // Only group if it has EXACTLY the same teachers AND students (same class across days)
                  const exactSameTeachers = assignment.teachers?.length === selectedTeachers.length &&
                    assignment.teachers?.every(teacher =>
                      selectedTeachers.some(selectedTeacher => selectedTeacher.teacher_id === teacher.id)
                    );
                  const exactSameStudents = assignment.students?.length === selectedStudents.length &&
                    assignment.students?.every(student =>
                      selectedStudents.some(selectedStudent => selectedStudent.student_id === student.id)
                    );
                  
                  // If it has the exact same teachers AND students, it's part of our class group
                  if (exactSameTeachers && exactSameStudents) {
                    return false; // Exclude from conflicts
                  }
                }
                
                return true;
              });
              
              if (conflictingAssignments.length > 0) {
                // Check if any teachers or students overlap with OTHER classes (not our own)
                const hasTeacherConflict = conflictingAssignments.some(assignment => 
                  assignment.teachers?.some(teacher => 
                    selectedTeachers.some(selectedTeacher => selectedTeacher.teacher_id === teacher.id)
                  )
                );
                
                const hasStudentConflict = conflictingAssignments.some(assignment => 
                  assignment.students?.some(student => 
                    selectedStudents.some(selectedStudent => selectedStudent.student_id === student.id)
                  )
                );
                
                // Set conflict only if there are actual teacher or student conflicts
                if (hasTeacherConflict || hasStudentConflict) {
                  console.log(`Setting conflict for ${day}:`, {
                    hasTeacherConflict,
                    hasStudentConflict,
                    conflictingAssignmentsCount: conflictingAssignments.length,
                    reason: hasTeacherConflict ? 'Teacher conflict' : 'Student conflict'
                  });
                  conflicts[day] = true;
                } else {
                  console.log(`No conflicts detected for ${day}`);
                }
              }
            } catch (error) {
              console.error('Error checking conflicts for', day, ':', error);
            }
          }
        }
        
        console.log('Final conflicts object:', conflicts);
        setDayConflicts(conflicts);
      };
      
      checkConflicts();
    } else {
      // Clear conflicts when not editing or no teachers/students selected
      setDayConflicts({});
    }
  }, [selectedDays, selectedTeachers, selectedStudents, existingAssignment, timeSlotId, classGroupDays, teachers, students]);

  const selectAllDays = () => {
    setSelectedDays([...weekDays]);
  };

  const deselectAllDays = () => {
    setSelectedDays(['Monday']); // Always keep at least Monday
  };

  // Helper function to get consecutive time slots based on duration
  const getTimeSlotSequence = (startTimeSlotId, duration) => {
    const slotsNeeded = duration === 25 ? 1 : duration === 50 ? 2 : 4;
    const sequence = [];
    
    // Find the index of the starting time slot
    const startIndex = timeSlots.findIndex(slot => slot.id === startTimeSlotId);
    if (startIndex === -1) return [startTimeSlotId]; // Fallback
    
    // Get consecutive slots
    for (let i = 0; i < slotsNeeded; i++) {
      const slotIndex = startIndex + i;
      if (slotIndex < timeSlots.length) {
        sequence.push(timeSlots[slotIndex].id);
      }
    }
    
    return sequence;
  };

  const handleValidate = async () => {
    try {
      const response = await validateAssignment({
        id: existingAssignment?.id,  // Include assignment ID if updating
        date: selectedDate,
        time_slot_id: timeSlotId,
        // No room required for online classes
        teachers: selectedTeachers,
        students: selectedStudents,
      });

      if (!response.data.valid) {
        setValidationErrors(response.data.errors);
        return false;
      }

      setValidationErrors([]);
      return true;
    } catch (error) {
      console.error('Validation error:', error);
      setValidationErrors(['Failed to validate assignment']);
      return false;
    }
  };

  const handleSave = async () => {
    if (selectedDays.length === 0) {
      alert('Please select at least one day for the class');
      return;
    }

    if (selectedTeachers.length === 0) {
      alert('Please select at least one teacher');
      return;
    }

    if (selectedStudents.length === 0) {
      alert('Please select at least one student');
      return;
    }

    if (!timeSlotId) {
      alert('Time slot is missing');
      return;
    }

    try {
      if (existingAssignment) {
        // For editing existing assignment, handle day changes
        const originalDays = classGroupDays || (existingAssignment ? [dateToDay(existingAssignment.date)].filter(Boolean) : []);
        const originalDaysSet = new Set(originalDays);
        const selectedDaysSet = new Set(selectedDays);
        
        // Check if days are exactly the same
        const daysUnchanged = originalDays.length === selectedDays.length && 
                              originalDays.every(day => selectedDaysSet.has(day));
        
        if (daysUnchanged && selectedDays.length === 1) {
          // Simple update - same day
          const data = {
            date: selectedDate,
            time_slot_id: timeSlotId,
            // No room required for online classes
            teachers: selectedTeachers,
            students: selectedStudents,
            notes,
            subject: subjects.join(', '),
            color_keyword: classColor || null,
          };
          await updateMutation.mutateAsync({ id: existingAssignment.id, data });
          
          // Single update completed - trigger refresh
          console.log('Update operation completed successfully');
          onSave();
          return;
        } else {
          // Check if we're just adding new days to an existing class
          const newDays = selectedDays.filter(day => !originalDays.includes(day));
          const removedDays = originalDays.filter(day => !selectedDays.includes(day));
          
          console.log('Days being added:', newDays);
          console.log('Days being removed:', removedDays);
          
          // If we're only adding days (not removing any), we can be more surgical
          if (removedDays.length === 0 && newDays.length > 0) {
            console.log('Only adding new days - no deletion needed');
            console.log('Client-side validation already passed, skipping server validation for surgical approach');
            
            // Check for client-side conflicts for new days only
            console.log('Current dayConflicts:', dayConflicts);
            const newDayConflicts = [];
            for (const day of newDays) {
              console.log(`Checking conflicts for new day ${day}:`, dayConflicts[day]);
              if (dayConflicts[day]) {
                newDayConflicts.push(day);
              }
            }
            console.log('New day conflicts found:', newDayConflicts);
            
            if (newDayConflicts.length > 0) {
              setValidationErrors([
                'Cannot add days due to conflicts:',
                ...newDayConflicts.map(day => `${day}: Teacher or student already has a class at this time`),
                '',
                'Please resolve conflicts before saving.'
              ]);
              return;
            }
            
            // Just create assignments for the new days (skip server validation)
            for (const day of newDays) {
              const targetDate = dayToDate(day);
              if (targetDate) {
                const data = {
                  date: targetDate,
                  time_slot_id: timeSlotId,
                  // No room required for online classes
                  teachers: selectedTeachers,
                  students: selectedStudents,
                  notes,
                  subject: subjects.join(', '),
                  color_keyword: classColor || null,
                };

                console.log('Creating new assignment for added day:', day, 'with data:', data);
                
                try {
                  // Validate first to prevent duplicates
                  const validation = await validateAssignment(data);
                  if (!validation.data.valid) {
                    console.error('Validation failed for new day:', day, validation.data.errors);
                    setValidationErrors([`${day}: ${validation.data.errors.join(', ')}`]);
                    return;
                  }
                  
                  await createMutation.mutateAsync(data);
                  console.log('Successfully created assignment for new day:', day);
                } catch (createError) {
                  console.error('Failed to create assignment for', day, ':', createError);
                  console.error('Create error response:', createError.response?.data);
                  throw createError;
                }
              }
            }
            
            // All new assignments created - trigger refresh
            console.log('All new day assignments completed successfully');
            onSave();
            return;
          }

          // FIRST: Check if this is a simple field update before doing conflict checking
          console.log('=== CHECKING FOR SIMPLE UPDATE ===');
          console.log('existingAssignment exists:', !!existingAssignment);
          console.log('classGroupDays:', classGroupDays);
          
          // Check for simple field-only updates (subject: subjects.join(', '), notes, color) without changing structure
          if (existingAssignment) {
            console.log('Existing assignment ID:', existingAssignment.id);
            console.log('Current subject:', existingAssignment.subject);
            console.log('New subjects:', subjects);
            console.log('Selected days:', selectedDays);
            console.log('Class group days:', classGroupDays);
            
            // For single assignment or entire class group field updates
            const originalDays = classGroupDays || [dateToDay(existingAssignment.date)].filter(Boolean);
            const daysUnchanged = selectedDays.length === originalDays.length && 
                                 selectedDays.every(day => originalDays.includes(day)) &&
                                 originalDays.every(day => selectedDays.includes(day));
            
            console.log('Original days:', originalDays);
            console.log('Days unchanged:', daysUnchanged);
            
            // Check if teachers and students are unchanged
            const teachersUnchanged = selectedTeachers.length === existingAssignment.teachers?.length &&
                                     selectedTeachers.every(st => existingAssignment.teachers?.some(et => et.id === st.teacher_id)) &&
                                     existingAssignment.teachers?.every(et => selectedTeachers.some(st => st.teacher_id === et.id));
            
            const studentsUnchanged = selectedStudents.length === existingAssignment.students?.length &&
                                     selectedStudents.every(ss => existingAssignment.students?.some(es => es.id === ss.student_id)) &&
                                     existingAssignment.students?.every(es => selectedStudents.some(ss => ss.student_id === es.id));
            
            console.log('Teachers unchanged:', teachersUnchanged);
            console.log('Students unchanged:', studentsUnchanged);
            
            const isSimpleFieldUpdate = daysUnchanged && teachersUnchanged && studentsUnchanged;
            console.log('Is simple field update:', isSimpleFieldUpdate);
            
            if (isSimpleFieldUpdate) {
              console.log('Performing simple field update for assignment:', existingAssignment.id);
              console.log('Need to update all days:', originalDays);
              
              try {
                // If this is a multi-day class, we need to find and update all related assignments
                if (originalDays.length > 1) {
                  console.log('Multi-day class detected, finding all related assignments...');
                  
                  const allAssignmentsToUpdate = [];
                  
                  // Get assignments for each day
                  for (const day of originalDays) {
                    const targetDate = dayToDate(day);
                    if (targetDate) {
                      const response = await getAssignments(targetDate);
                      const dayAssignments = response.data || [];
                      
                      // Find assignments that match our exact class group
                      const matchingAssignments = dayAssignments.filter(assignment => {
                        if (assignment.time_slot_id !== timeSlotId) return false;
                        
                        // Check if teachers match exactly
                        const assignmentTeacherIds = (assignment.teachers || []).map(t => t.id).sort();
                        const existingTeacherIds = (existingAssignment.teachers || []).map(t => t.id).sort();
                        const teachersMatch = assignmentTeacherIds.length === existingTeacherIds.length &&
                          assignmentTeacherIds.every((id, index) => id === existingTeacherIds[index]);
                        
                        // Check if students match exactly
                        const assignmentStudentIds = (assignment.students || []).map(s => s.id).sort();
                        const existingStudentIds = (existingAssignment.students || []).map(s => s.id).sort();
                        const studentsMatch = assignmentStudentIds.length === existingStudentIds.length &&
                          assignmentStudentIds.every((id, index) => id === existingStudentIds[index]);
                        
                        return teachersMatch && studentsMatch;
                      });
                      
                      allAssignmentsToUpdate.push(...matchingAssignments);
                    }
                  }
                  
                  console.log(`Found ${allAssignmentsToUpdate.length} assignments to update:`, allAssignmentsToUpdate.map(a => ({ id: a.id, date: a.date })));
                  
                  // Update all related assignments
                  for (const assignment of allAssignmentsToUpdate) {
                    await updateMutation.mutateAsync({
                      id: assignment.id,
                      data: {
                        subject: subjects.join(', '),
                        notes,
                        color_keyword: classColor || null
                      }
                    });
                    console.log(`Updated assignment ${assignment.id} for ${dateToDay(assignment.date)}`);
                  }
                  
                } else {
                  // Single day assignment - update just this one
                  await updateMutation.mutateAsync({
                    id: existingAssignment.id,
                    data: {
                      subject: subjects.join(', '),
                      notes,
                      color_keyword: classColor || null
                    }
                  });
                }
                
                console.log('Simple field update completed successfully');
                onSave();
                return;
              } catch (updateError) {
                console.error('Simple field update failed:', updateError);
                console.error('Error details:', updateError.response?.data);
                setValidationErrors([`Failed to update assignment: ${updateError.response?.data?.message || updateError.message}`]);
                return;
              }
            }
          }

          // Day change or multiple days - check for conflicts first
          const conflicts = [];
          
          for (const day of selectedDays) {
            const targetDate = dayToDate(day);
            if (targetDate) {
              // Get assignments for this date and time slot
              try {
                const response = await getAssignments(targetDate);
                const existingAssignments = response.data || [];
                
                // Filter assignments for this time slot, excluding ALL assignments from our current class group
                const conflictingAssignments = existingAssignments.filter((assignment) => {
                  if (assignment.time_slot_id !== timeSlotId) return false;
                  
                  // Exclude the current assignment being edited
                  if (assignment.id === existingAssignment.id) return false;
                  
                  // For any class edit, check if this assignment belongs to our class group by matching teachers and students
                  if (existingAssignment) {
                    // Check if this assignment belongs to our class group by matching teachers and students
                    const sameTeachers = assignment.teachers?.some(teacher =>
                      selectedTeachers.some(selectedTeacher => selectedTeacher.teacher_id === teacher.id)
                    );
                    const sameStudents = assignment.students?.some(student =>
                      selectedStudents.some(selectedStudent => selectedStudent.student_id === student.id)
                    );
                    
                    console.log(`Checking assignment ${assignment.id} for ${day}:`, {
                      assignmentId: assignment.id,
                      sameTeachers,
                      sameStudents,
                      assignmentTeachers: assignment.teachers?.map(t => ({ id: t.id, name: t.name })),
                      assignmentStudents: assignment.students?.map(s => ({ id: s.id, name: s.name })),
                      selectedTeacherIds: selectedTeachers.map(st => st.teacher_id),
                      selectedStudentIds: selectedStudents.map(ss => ss.student_id),
                      selectedTeacherNames: selectedTeachers.map(st => teachers?.find(t => t.id === st.teacher_id)?.name).filter(Boolean),
                      selectedStudentNames: selectedStudents.map(ss => students?.find(s => s.id === ss.student_id)?.name).filter(Boolean),
                    });
                    
                    // If it has the same teachers AND students, it's part of our class group
                    if (sameTeachers && sameStudents) {
                      console.log(`Assignment ${assignment.id} is part of current class group - excluding from conflicts`);
                      return false; // Exclude from conflicts
                    }
                  }
                  
                  return true;
                });
                
                if (conflictingAssignments.length > 0) {
                  console.log(`Found ${conflictingAssignments.length} potentially conflicting assignments for ${day}:`, conflictingAssignments.map(a => ({
                    id: a.id,
                    teachers: a.teachers?.map(t => t.name),
                    students: a.students?.map(s => s.name),
                    room_id: a.room_id
                  })));
                  
                  // Check if any teachers or students overlap
                  const hasTeacherConflict = conflictingAssignments.some(assignment => 
                    assignment.teachers?.some(teacher => 
                      selectedTeachers.some(selectedTeacher => selectedTeacher.teacher_id === teacher.id)
                    )
                  );
                  
                  const hasStudentConflict = conflictingAssignments.some(assignment => 
                    assignment.students?.some(student => 
                      selectedStudents.some(selectedStudent => selectedStudent.student_id === student.id)
                    )
                  );
                  
                  // No room conflicts for online classes
                  const hasRoomConflict = false;
                  
                  console.log(`Conflicts for ${day}:`, { 
                    hasTeacherConflict, 
                    hasStudentConflict, 
                    hasRoomConflict,
                    conflictingAssignmentsCount: conflictingAssignments.length
                  });
                  
                  // For now, let's treat ANY assignment at this time slot as a potential conflict
                  // until we understand the exact server logic
                  const hasAnyConflict = hasTeacherConflict || hasStudentConflict || conflictingAssignments.length > 0;
                  
                  if (hasAnyConflict) {
                    const conflictDetails = [];
                    if (hasTeacherConflict) {
                      const conflictingTeachers = [];
                      selectedTeachers.forEach(selectedTeacher => {
                        const teacherName = teachers?.find(t => t.id === selectedTeacher.teacher_id)?.name;
                        if (teacherName) {
                          // Check if this teacher is actually in a conflicting assignment
                          const isInConflict = conflictingAssignments.some(assignment => 
                            assignment.teachers?.some(teacher => teacher.id === selectedTeacher.teacher_id)
                          );
                          if (isInConflict) {
                            conflictingTeachers.push(teacherName);
                          }
                        }
                      });
                      if (conflictingTeachers.length > 0) {
                        conflictDetails.push(`Teacher(s): ${conflictingTeachers.join(', ')}`);
                      }
                    }
                    if (hasStudentConflict) {
                      const conflictingStudents = [];
                      selectedStudents.forEach(selectedStudent => {
                        const studentName = students?.find(s => s.id === selectedStudent.student_id)?.name;
                        if (studentName) {
                          // Check if this student is actually in a conflicting assignment
                          const isInConflict = conflictingAssignments.some(assignment => 
                            assignment.students?.some(student => student.id === selectedStudent.student_id)
                          );
                          if (isInConflict) {
                            conflictingStudents.push(studentName);
                          }
                        }
                      });
                      if (conflictingStudents.length > 0) {
                        conflictDetails.push(`Student(s): ${conflictingStudents.join(', ')}`);
                      }
                    }
                    if (conflictDetails.length > 0) {
                      conflicts.push(`${day}: ${conflictDetails.join(', ')}`);
                    }
                  }
                }
              } catch (error) {
                console.error('Error checking conflicts for', day, ':', error);
                conflicts.push(`${day}: Unable to check for conflicts`);
              }
            }
          }
          
          if (conflicts.length > 0) {
            setValidationErrors([
              'Cannot edit class due to scheduling conflicts:',
              ...conflicts,
              '',
              'These teachers or students are already assigned to other classes at this time on the selected days.'
            ]);
            return;
          }
          
          // Complex update - proceed with deletion and recreation
          // If we have classGroupDays, we need to delete all assignments in the class group
          const originalClassDays = classGroupDays || (existingAssignment ? [dateToDay(existingAssignment.date)].filter(Boolean) : []);
          
          if (originalClassDays.length > 1 || selectedDays.length !== originalClassDays.length || !originalClassDays.every(day => selectedDays.includes(day))) {
            console.log('Deleting existing assignments from original days:', originalClassDays);
            console.log('Will recreate for selected days:', selectedDays);
            
            // First, collect all assignments to delete across all days
            const allAssignmentsToDelete = [];
            
            for (const day of originalClassDays) {
              const targetDate = dayToDate(day);
              if (targetDate) {
                try {
                  const response = await getAssignments(targetDate);
                  const dayAssignments = response.data || [];
                  
                  // Find assignments that match our EXACT teachers and students at this time slot
                  const relatedAssignments = dayAssignments.filter(assignment => {
                    if (assignment.time_slot_id !== timeSlotId) return false;
                    
                    // Check if teachers match exactly (same set of teachers)
                    const assignmentTeacherIds = (assignment.teachers || []).map(t => t.id).sort();
                    const selectedTeacherIds = selectedTeachers.map(t => t.teacher_id).sort();
                    const teachersMatch = assignmentTeacherIds.length === selectedTeacherIds.length &&
                      assignmentTeacherIds.every((id, index) => id === selectedTeacherIds[index]);
                    
                    // Check if students match exactly (same set of students)
                    const assignmentStudentIds = (assignment.students || []).map(s => s.id).sort();
                    const selectedStudentIds = selectedStudents.map(s => s.student_id).sort();
                    const studentsMatch = assignmentStudentIds.length === selectedStudentIds.length &&
                      assignmentStudentIds.every((id, index) => id === selectedStudentIds[index]);
                    
                    // Check if subject matches
                    const subjectMatch = assignment.subject === subjects.join(', ');
                    
                    return teachersMatch && studentsMatch && subjectMatch;
                  });
                  
                  allAssignmentsToDelete.push(...relatedAssignments);
                  console.log(`Found ${relatedAssignments.length} related assignments to delete for ${day}`);
                } catch (error) {
                  console.error('Error fetching assignments for deletion on', day, ':', error);
                  throw new Error(`Failed to fetch assignments for ${day}: ${error.message}`);
                }
              }
            }
            
            // Now delete all assignments atomically - if any deletion fails, the whole operation should fail
            console.log(`Deleting ${allAssignmentsToDelete.length} total assignments from the class group`);
            for (const assignment of allAssignmentsToDelete) {
              try {
                console.log('Deleting assignment:', assignment.id, 'from', dateToDay(assignment.date));
                await deleteMutation.mutateAsync(assignment.id);
              } catch (error) {
                console.error('Failed to delete assignment:', assignment.id, error);
                throw new Error(`Failed to delete assignment ${assignment.id}. Operation aborted to prevent partial deletion.`);
              }
            }
          } else {
            // Single assignment delete
            await deleteMutation.mutateAsync(existingAssignment.id);
          }
          
          // Create new assignments for selected days
          for (const day of selectedDays) {
            const targetDate = dayToDate(day);
            if (targetDate) {
              const data = {
                date: targetDate,
                time_slot_id: timeSlotId,
                // No room required for online classes
                teachers: selectedTeachers,
                students: selectedStudents,
                notes,
                subject: subjects.join(', '),
                color_keyword: classColor || null,
              };

              // Skip server validation for days that are already part of the original class group
              // since our client-side validation already handled conflicts properly
              const originalValidationDays = classGroupDays || (existingAssignment ? [dateToDay(existingAssignment.date)].filter(Boolean) : []);
              const isDayAlreadyInClass = originalValidationDays.includes(day);
              
              if (!isDayAlreadyInClass) {
                // Only validate new days being added to the class
                try {
                  console.log('Validating assignment for', day, 'with data:', {
                    id: existingAssignment?.id,
                    date: targetDate,
                    time_slot_id: timeSlotId,
                    teachers: selectedTeachers,
                    students: selectedStudents,
                  });
                  
                  const response = await validateAssignment({
                    id: existingAssignment?.id, // Include existing assignment ID for proper validation
                    date: targetDate,
                    time_slot_id: timeSlotId,
                    // No room required for online classes
                    teachers: selectedTeachers,
                    students: selectedStudents,
                  });

                  console.log('Validation response for', day, ':', response.data);

                  if (!response.data.valid) {
                    console.error('Server validation failed for', day, ':', response.data.errors);
                    setValidationErrors([`${day}: ${response.data.errors.join(', ')}`]);
                    return;
                  }
                } catch (validationError) {
                  console.error('Validation error for', day, ':', validationError);
                  console.error('Validation error response:', validationError.response?.data);
                  const errorMsg = validationError.response?.data?.message || validationError.message || 'Unknown validation error';
                  setValidationErrors([`${day}: Validation failed - ${errorMsg}`]);
                  return;
                }
              }

              console.log('Creating assignment for day:', day, 'with data:', data);
              console.log('Teachers being assigned:', selectedTeachers);
              console.log('Students being assigned:', selectedStudents);
              
              try {
                // Validate first to prevent duplicates  
                const validation = await validateAssignment(data);
                if (!validation.data.valid) {
                  console.error('Validation failed for', day, ':', validation.data.errors);
                  setValidationErrors([`${day}: ${validation.data.errors.join(', ')}`]);
                  return;
                }
                
                await createMutation.mutateAsync(data);
                console.log('Successfully created assignment for', day);
              } catch (createError) {
                console.error('Failed to create assignment for', day, ':', createError);
                console.error('Create error response:', createError.response?.data);
                throw createError; // Re-throw to be caught by outer try-catch
              }
            }
          }
        }
      } else {
        // For new assignments, create one for each selected day and time slot sequence
        for (const day of selectedDays) {
          const targetDate = dayToDate(day);
          if (targetDate) {
            // Get the sequence of time slots based on duration
            const timeSlotSequence = getTimeSlotSequence(timeSlotId, classDuration);
            
            // Validate that we have enough consecutive slots
            if (timeSlotSequence.length < (classDuration === 25 ? 1 : classDuration === 50 ? 2 : 4)) {
              setValidationErrors([`${day}: Not enough consecutive time slots available for ${classDuration} minute class`]);
              return;
            }
            
            // Create assignment for each time slot in the sequence
            for (const slotId of timeSlotSequence) {
              const data = {
                date: targetDate,
                time_slot_id: slotId,
                // No room required for online classes
                teachers: selectedTeachers,
                students: selectedStudents,
                notes: classDuration > 25 ? `${notes} (${classDuration} min class)` : notes,
                subject: subjects.join(', '),
                color_keyword: classColor || null,
              };

              // Validate each assignment first to prevent duplicates
              try {
                const response = await validateAssignment({
                  date: targetDate,
                  time_slot_id: slotId,
                  // No room required for online classes
                  teachers: selectedTeachers,
                  students: selectedStudents,
                });

                if (!response.data.valid) {
                  setValidationErrors([`${day}: ${response.data.errors.join(', ')}`]);
                  return;
                }
              } catch (validationError) {
                console.error('Validation error for', day, ':', validationError);
                setValidationErrors([`${day}: Validation failed - ${validationError.message}`]);
                return;
              }

              console.log('Creating assignment with data:', data);
              await createMutation.mutateAsync(data);
            }
          }
        }
      }
      
      // All operations completed successfully - trigger refresh
      console.log('All save operations completed successfully');
      onSave();
      
    } catch (error) {
      console.error('Save error:', error);
      console.error('Full error response:', error.response);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      
      // Handle server validation errors properly
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        console.error('Server validation errors:', error.response.data.errors);
        setValidationErrors([
          'Server validation failed:',
          ...error.response.data.errors,
          '',
          'These conflicts were not detected by client-side validation. Please resolve them and try again.'
        ]);
        return; // Don't show alert, show validation errors instead
      }
      
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Unknown error';
      alert(`Failed to save assignment: ${errorMessage}`);
    }
  };

  const handleDelete = async () => {
    if (existingAssignment && confirm('Are you sure you want to delete this assignment?')) {
      try {
        await deleteMutation.mutateAsync(existingAssignment.id);
        console.log('Delete operation completed successfully');
        onSave();
      } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete assignment');
      }
    }
  };

  if (!isOpen) return null;

  // Show loading state
  if (teachersLoading || studentsLoading || assignmentsLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Loading...</h2>
          <div className="text-gray-600">Fetching teachers and students data...</div>
        </div>
      </div>
    );
  }

  // Show error if any queries failed
  if (teachersError || studentsError || assignmentsError) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error Loading Data</h2>
          <div className="space-y-2 text-sm">
            {teachersError && <p>Teachers: {teachersError.message}</p>}
            {studentsError && <p>Students: {studentsError.message}</p>}
            {assignmentsError && <p>Assignments: {assignmentsError.message}</p>}
          </div>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {existingAssignment ? 'Edit' : 'Create'} Class
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              &times;
            </button>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            {timeSlot?.name} ({selectedDate})
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <h3 className="text-sm font-semibold text-red-800 mb-2">Validation Errors:</h3>
              <ul className="list-disc list-inside text-sm text-red-700">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Day Selection (for both new and existing assignments) */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            {existingAssignment ? (
              <div className="mb-3 text-sm text-blue-700">
                <span className="font-medium">Note:</span> You can change which days this class occurs on. This will update the assignment for the selected days.
              </div>
            ) : isAllWeekMode ? (
              <div className="mb-3 text-sm text-blue-700">
                <span className="font-medium">Note:</span> Select which days of the week this class should occur. The class will be created for each selected day.
              </div>
            ) : null}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Select Days for This Class</h3>
              <button
                type="button"
                onClick={selectAllDays}
                className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                All Days
              </button>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map(day => {
                const isSelected = selectedDays.includes(day);
                const hasConflict = dayConflicts[day];
                const originalDays = classGroupDays || (existingAssignment ? [dateToDay(existingAssignment.date)].filter(Boolean) : []);
                const isOriginalDay = originalDays.includes(day);
                
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors relative ${
                      hasConflict && isSelected
                        ? 'bg-red-600 text-white'
                        : isSelected
                        ? 'bg-blue-600 text-white'
                        : hasConflict
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title={
                      hasConflict
                        ? `Conflict: Teacher or student already has a class on ${day}`
                        : isOriginalDay
                        ? `Original day for this class (currently scheduled on: ${originalDays.join(', ')})`
                        : ''
                    }
                  >
                    {day}
                    {hasConflict && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                        !
                      </span>
                    )}
                    {isOriginalDay && !hasConflict && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full text-xs text-white flex items-center justify-center">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="text-sm text-gray-600 mt-2">
              Selected: {selectedDays.length} day{selectedDays.length !== 1 ? 's' : ''}
              {selectedDays.length > 0 && ` (${selectedDays.join(', ')})`}
            </div>
            {Object.keys(dayConflicts).length > 0 && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="text-sm text-red-800">
                  <span className="font-medium">⚠️ Scheduling Conflicts Detected:</span>
                  <div className="mt-1">
                    Days with conflicts: {Object.keys(dayConflicts).filter(day => dayConflicts[day]).join(', ')}
                  </div>
                  <div className="mt-1 text-xs">
                    These days have conflicting assignments with the selected teachers or students. You cannot save changes that create conflicts.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Class Duration Selection (only for new assignments) */}
          {!existingAssignment && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Class Duration</h3>
              <div className="grid grid-cols-3 gap-3">
                {[25, 50, 100].map(minutes => {
                  const isSelected = classDuration === minutes;
                  const timeSlots = minutes === 25 ? 1 : minutes === 50 ? 2 : 4;
                  return (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => setClassDuration(minutes)}
                      className={`p-4 rounded-lg border-2 transition-colors ${
                        isSelected
                          ? 'border-green-500 bg-green-100 text-green-800'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <div className="text-lg font-bold">{minutes} min</div>
                      <div className="text-xs text-gray-500">
                        {timeSlots} time slot{timeSlots !== 1 ? 's' : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="text-sm text-gray-600 mt-2">
                {classDuration > 25 && (
                  <span className="text-orange-600 font-medium">
                    ⚠ This will create classes in {classDuration === 50 ? '2' : '4'} consecutive time slots
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Teachers and Students side by side */}
          <div className="grid grid-cols-2 gap-6">
            {/* Teachers Selection */}
            <div>
              <h3 className="text-lg font-semibold mb-3">
                Teachers (Max 2) - {selectedTeachers.length}/2 selected
              </h3>
              <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto border border-gray-200 rounded p-3">
                {teachersToShow.map((teacher) => {
                const isSelected = selectedTeachers.find((t) => t.teacher_id === teacher.id);
                const assignedElsewhere = teacherAssignments.get(teacher.id);
                const isAssignedElsewhere = !!assignedElsewhere;
                const hasAvailability = teacher.availability && teacher.availability.includes(timeSlotId);
                const isDeleted = teacher.isDeleted || false;
                const isSelectedButUnavailable = isSelected && !hasAvailability && !isDeleted;
                const isSelectedButDeleted = isSelected && isDeleted;

                return (
                  <div
                    key={teacher.id}
                    className={`flex items-center gap-2 p-2 rounded ${
                      isSelectedButDeleted
                        ? 'bg-red-100 border-2 border-red-400'
                        : isSelectedButUnavailable
                        ? 'bg-orange-50 border border-orange-300'
                        : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      id={`teacher-${teacher.id}`}
                      checked={!!isSelected}
                      onChange={() => handleTeacherToggle(teacher.id)}
                      className="rounded"
                      disabled={isAssignedElsewhere && !isDeleted && !isAllWeekMode}
                    />
                    <label
                      htmlFor={`teacher-${teacher.id}`}
                      className={`flex-1 text-sm ${
                        isSelectedButDeleted
                          ? 'text-red-900 font-bold'
                          : isAssignedElsewhere
                          ? 'line-through text-gray-400'
                          : isSelectedButUnavailable
                          ? 'text-orange-900 font-semibold'
                          : ''
                      }`}
                      title={
                        isSelectedButDeleted
                          ? '⚠️ Teacher deleted - Please uncheck to remove'
                          : isSelectedButUnavailable
                          ? '⚠️ No longer available for this time slot - Please replace'
                          : isAssignedElsewhere
                          ? `Already assigned to ${assignedElsewhere}`
                          : ''
                      }
                    >
                      {isSelectedButDeleted && <span className="text-red-600">🗑️ </span>}
                      {isSelectedButUnavailable && <span className="text-orange-600">⚠️ </span>}
                      <span>{teacher.name}</span>
                      {isSelectedButDeleted && (
                        <span className="ml-1 text-xs text-red-600 font-bold no-underline">
                          (DELETED)
                        </span>
                      )}
                      {isSelectedButUnavailable && (
                        <span className="ml-1 text-xs text-orange-600 font-bold no-underline">
                          (UNAVAILABLE)
                        </span>
                      )}
                      {isAssignedElsewhere && !isDeleted && (
                        <span className="ml-1 text-xs text-red-600 font-semibold no-underline">
                          ({assignedElsewhere})
                        </span>
                      )}
                      {!isAssignedElsewhere && !isSelectedButUnavailable && !isDeleted && teacher.color_keyword && (
                        <span
                          className="ml-2 inline-block w-3 h-3 rounded-full"
                          style={{ backgroundColor: getColorForKeyword(teacher.color_keyword) }}
                        />
                      )}
                    </label>
                    {isSelected && !isDeleted && (
                      <button
                        onClick={() => handleSubstituteToggle(teacher.id)}
                        className={`text-xs px-2 py-1 rounded ${
                          isSelected.is_substitute
                            ? 'bg-yellow-200 text-yellow-800'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {isSelected.is_substitute ? 'SUB' : 'Regular'}
                      </button>
                    )}
                  </div>
                );
              })}
              </div>
            </div>

            {/* Students Selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">
                  Students (Max 5) - {selectedStudents.length}/5 selected
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto border border-gray-200 rounded p-3">
                {studentsToShow.map((student) => {
                const isSelected = selectedStudents.find((s) => s.student_id === student.id);
                const assignedElsewhere = studentAssignments.get(student.id);
                const isAssignedElsewhere = !!assignedElsewhere;
                const hasAvailability = student.availability && student.availability.includes(timeSlotId);
                const isDeleted = student.isDeleted || false;
                const isSelectedButUnavailable = isSelected && !hasAvailability && !isDeleted;
                const isSelectedButDeleted = isSelected && isDeleted;

                return (
                  <div
                    key={student.id}
                    className={`flex items-center gap-2 p-2 rounded ${
                      isSelectedButDeleted
                        ? 'bg-red-100 border-2 border-red-400'
                        : isSelectedButUnavailable
                        ? 'bg-orange-50 border border-orange-300'
                        : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      id={`student-${student.id}`}
                      checked={!!isSelected}
                      onChange={() => handleStudentToggle(student.id)}
                      className="rounded"
                      disabled={isAssignedElsewhere && !isDeleted && !isAllWeekMode}
                    />
                    <label
                      htmlFor={`student-${student.id}`}
                      className={`flex-1 text-sm ${
                        isSelectedButDeleted
                          ? 'text-red-900 font-bold'
                          : isAssignedElsewhere
                          ? 'line-through text-gray-400'
                          : isSelectedButUnavailable
                          ? 'text-orange-900 font-semibold'
                          : ''
                      }`}
                      title={
                        isSelectedButDeleted
                          ? '⚠️ Student deleted - Please uncheck to remove'
                          : isSelectedButUnavailable
                          ? '⚠️ No longer available for this time slot - Please replace'
                          : isAssignedElsewhere
                          ? `Already assigned to ${assignedElsewhere}`
                          : student.name
                      }
                    >
                      {isSelectedButDeleted && <span className="text-red-600">🗑️ </span>}
                      {isSelectedButUnavailable && <span className="text-orange-600">⚠️ </span>}
                      <span>{student.name}</span>
                      {isSelectedButDeleted && (
                        <span className="ml-1 text-xs text-red-600 font-bold no-underline">
                          (DELETED)
                        </span>
                      )}
                      {isSelectedButUnavailable && (
                        <span className="ml-1 text-xs text-orange-600 font-bold no-underline">
                          (UNAVAILABLE)
                        </span>
                      )}
                      {isAssignedElsewhere && !isDeleted && (
                        <span className="ml-1 text-xs text-red-600 font-semibold no-underline">
                          ({assignedElsewhere})
                        </span>
                      )}
                      {!isAssignedElsewhere && !isSelectedButUnavailable && !isDeleted && student.color_keyword && (
                        <span
                          className="ml-2 inline-block w-3 h-3 rounded-full"
                          style={{ backgroundColor: getColorForKeyword(student.color_keyword) }}
                        />
                      )}
                    </label>
                  </div>
                );
              })}
              </div>
            </div>
          </div>

          {/* Class Color and Subject side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Class Color */}
            <div>
              <label htmlFor="classColor" className="block text-sm font-semibold mb-2">
                Class Color
              </label>
              <select
                id="classColor"
                value={classColor}
                onChange={(e) => setClassColor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Use Student Color</option>
                <option value="red">Red</option>
                <option value="blue">Blue</option>
                <option value="green">Green</option>
                <option value="yellow">Yellow</option>
                <option value="purple">Purple</option>
                <option value="orange">Orange</option>
                <option value="pink">Pink</option>
              </select>
            </div>

            {/* Subject - Multi-select Checkboxes + Custom Input */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Subjects {subjects.length > 0 && <span className="text-blue-600">({subjects.length} selected)</span>}
              </label>

              {/* Custom subject input */}
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  id="customSubject"
                  placeholder="Type a custom subject and press Add..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const value = e.target.value.trim();
                      if (value && !subjects.includes(value)) {
                        setSubjects([...subjects, value]);
                        e.target.value = '';
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById('customSubject');
                    const value = input.value.trim();
                    if (value && !subjects.includes(value)) {
                      setSubjects([...subjects, value]);
                      input.value = '';
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  Add
                </button>
              </div>

              {/* Selected subjects tags */}
              {subjects.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {subjects.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() => setSubjects(subjects.filter(sub => sub !== s))}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Preset subjects checkboxes */}
              <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto bg-white">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "Adult Conversation",
                    "AP",
                    "Book Club",
                    "Breaking News",
                    "Coding",
                    "Debate",
                    "Elementary School Subjects (G1-G6)",
                    "Elementary Entrance Exam Prep",
                    "Elementary TED",
                    "Essay Clinic (Elementary-Middle)",
                    "Grammar to Writing",
                    "High School Subjects",
                    "High School Essay Clinic",
                    "IB",
                    "IELTS",
                    "Middle School Subjects (G7-G9)",
                    "Middle School TED Practice",
                    "Reading and Vocab",
                    "Reading to Writing",
                    "SAT",
                    "SAT Book Bridge",
                    "SAT Reading Comprehension (Advanced Grammar)",
                    "TOEFL",
                    "TOEIC"
                  ].map((subjectOption) => (
                    <label
                      key={subjectOption}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-100 ${
                        subjects.includes(subjectOption) ? 'bg-blue-50 border border-blue-300' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={subjects.includes(subjectOption)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSubjects([...subjects, subjectOption]);
                          } else {
                            setSubjects(subjects.filter(s => s !== subjectOption));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm">{subjectOption}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Class/Books */}
          <div>
            <label htmlFor="notes" className="block text-sm font-semibold mb-2">
              Memo/Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter class materials, books, or other information..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex items-center justify-between">
          <div>
            {existingAssignment && (
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to get color for keyword
function getColorForKeyword(keyword) {
  const colorMap = {
    red: '#ef4444',
    blue: '#3b82f6',
    green: '#10b981',
    yellow: '#eab308',
    purple: '#a855f7',
    orange: '#f97316',
    pink: '#ec4899',
  };
  return colorMap[keyword.toLowerCase()] || '#6b7280';
}

export default AssignmentModal;
