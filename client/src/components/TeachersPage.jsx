import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTeachers, getTimeSlots, deleteTeacher, updateTeacher, deleteAllTeachers, previewTeachersFromNotion, importTeachersFromNotion, createTeacher, getAssignments, getAssignmentsByDateRange } from '../services/api';
import { dayToDate, weekDays, dateToDay } from '../utils/dayMapping';
import TeacherFormModal from './TeacherFormModal';
import NotionImportModal from './NotionImportModal';

function TeachersPage({ selectedDate, selectedDay, isAllWeekMode = false }) {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Drag selection state - using refs to avoid stale closure issues
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [dragMode, setDragMode] = useState(null); // 'add' or 'remove'
  const tableRef = useRef(null);

  // Refs to store latest values for the mouseup handler
  const selectedCellsRef = useRef(new Set());
  const dragModeRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Copy from teacher state
  const [copyFromTeacherId, setCopyFromTeacherId] = useState('');

  // Class details modal state (for All Week view)
  const [classDetailsModal, setClassDetailsModal] = useState({
    isOpen: false,
    teacherName: '',
    timeSlot: null,
    classDetails: [] // Array of { day, students, room, subject, notes }
  });

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

  // Fetch teachers for the selected date (single day mode)
  const { data: teachersForDate, isLoading: teachersLoading } = useQuery({
    queryKey: ['teachers', selectedDate],
    queryFn: async () => {
      const response = await getTeachers(selectedDate);
      return response.data;
    },
    enabled: !!selectedDate && !isAllWeekMode,
  });

  // Fetch teachers for ALL 7 days (All Week mode)
  const { data: allWeekTeachers, isLoading: allWeekTeachersLoading } = useQuery({
    queryKey: ['teachers', 'all-week-teachers-page'],
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

  // Get combined teachers list
  const teachers = useMemo(() => {
    if (isAllWeekMode) {
      if (!allWeekTeachers) return [];
      const uniqueTeachers = new Map();
      Object.values(allWeekTeachers).forEach(dayTeachers => {
        dayTeachers.forEach(teacher => {
          if (!uniqueTeachers.has(teacher.name)) {
            uniqueTeachers.set(teacher.name, teacher);
          }
        });
      });
      return Array.from(uniqueTeachers.values()).sort((a, b) => a.name.localeCompare(b.name));
    } else {
      return teachersForDate || [];
    }
  }, [isAllWeekMode, teachersForDate, allWeekTeachers]);

  // Fetch time slots for display
  const { data: timeSlots } = useQuery({
    queryKey: ['timeSlots'],
    queryFn: async () => {
      const response = await getTimeSlots();
      return response.data;
    },
  });

  // Fetch assignments to show which teachers actually have classes
  const { data: assignments } = useQuery({
    queryKey: ['assignments', selectedDay],
    queryFn: async () => {
      if (isAllWeekMode) {
        // Fetch entire week
        const response = await getAssignmentsByDateRange('2024-01-01', 7);
        return response.data;
      } else {
        // Fetch single day
        const response = await getAssignments(selectedDate);
        return response.data;
      }
    },
    enabled: !!selectedDate,
  });

  // Update availability mutation
  const updateAvailabilityMutation = useMutation({
    mutationFn: ({ id, data }) => updateTeacher(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['teachers']);
    },
    onError: (error) => {
      console.error('Update error:', error);
      alert('Failed to update teacher availability');
    },
  });

  // Preset templates based on time slots (8 AM to 10 PM, 30-min slots = 28 total)
  // Slots 1-8: 8 AM - 12 PM (Morning)
  // Slots 9-12: 12 PM - 2 PM (Lunch)
  // Slots 13-20: 2 PM - 6 PM (Afternoon)
  // Slots 21-28: 6 PM - 10 PM (Evening)
  const presetTemplates = useMemo(() => {
    if (!timeSlots) return [];
    const allIds = timeSlots.map(ts => ts.id);
    const morningIds = timeSlots.filter((_, i) => i < 8).map(ts => ts.id); // 8 AM - 12 PM
    const afternoonIds = timeSlots.filter((_, i) => i >= 8 && i < 20).map(ts => ts.id); // 12 PM - 6 PM
    const eveningIds = timeSlots.filter((_, i) => i >= 20).map(ts => ts.id); // 6 PM - 10 PM
    const workdayIds = timeSlots.filter((_, i) => i >= 2 && i < 20).map(ts => ts.id); // 9 AM - 6 PM

    return [
      { name: 'Full Day', ids: allIds, color: 'bg-blue-600' },
      { name: 'Work Hours (9-6)', ids: workdayIds, color: 'bg-green-600' },
      { name: 'Morning (8-12)', ids: morningIds, color: 'bg-yellow-600' },
      { name: 'Afternoon (12-6)', ids: afternoonIds, color: 'bg-orange-600' },
      { name: 'Evening (6-10)', ids: eveningIds, color: 'bg-purple-600' },
      { name: 'Clear All', ids: [], color: 'bg-gray-600' },
    ];
  }, [timeSlots]);

  // Apply preset to a teacher
  const applyPresetToTeacher = async (teacher, presetIds) => {
    try {
      await updateAvailabilityMutation.mutateAsync({
        id: teacher.id,
        data: {
          name: teacher.name,
          availability: presetIds,
          color_keyword: teacher.color_keyword,
        },
      });
    } catch (error) {
      console.error('Failed to apply preset:', error);
    }
  };

  // Toggle entire column (time slot) for all visible teachers
  const handleToggleColumn = async (timeSlotId) => {
    if (isAllWeekMode) return; // Disable in All Week mode

    const teachersToUpdate = filteredTeachers.filter(t => t.id);
    if (teachersToUpdate.length === 0) return;

    // Check if majority have this slot - if so, remove from all; otherwise add to all
    const countWithSlot = teachersToUpdate.filter(t => t.availability?.includes(timeSlotId)).length;
    const shouldAdd = countWithSlot < teachersToUpdate.length / 2;

    for (const teacher of teachersToUpdate) {
      const currentAvailability = teacher.availability || [];
      let newAvailability;

      if (shouldAdd) {
        newAvailability = currentAvailability.includes(timeSlotId)
          ? currentAvailability
          : [...currentAvailability, timeSlotId].sort((a, b) => a - b);
      } else {
        newAvailability = currentAvailability.filter(id => id !== timeSlotId);
      }

      if (JSON.stringify(currentAvailability.sort()) !== JSON.stringify(newAvailability.sort())) {
        await updateAvailabilityMutation.mutateAsync({
          id: teacher.id,
          data: {
            name: teacher.name,
            availability: newAvailability,
            color_keyword: teacher.color_keyword,
          },
        });
      }
    }
  };

  // Toggle entire row (all time slots) for a teacher
  const handleToggleRow = async (teacher) => {
    if (isAllWeekMode) return; // Disable in All Week mode
    if (!timeSlots) return;

    const allSlotIds = timeSlots.map(ts => ts.id);
    const currentAvailability = teacher.availability || [];

    // If teacher has more than half slots, clear all; otherwise fill all
    const shouldFillAll = currentAvailability.length < allSlotIds.length / 2;
    const newAvailability = shouldFillAll ? allSlotIds : [];

    try {
      await updateAvailabilityMutation.mutateAsync({
        id: teacher.id,
        data: {
          name: teacher.name,
          availability: newAvailability,
          color_keyword: teacher.color_keyword,
        },
      });
    } catch (error) {
      console.error('Failed to toggle row:', error);
    }
  };

  // Copy availability from another teacher
  const handleCopyFromTeacher = async (targetTeacher, sourceTeacherId) => {
    if (!sourceTeacherId) return;

    const sourceTeacher = teachers.find(t => t.id === parseInt(sourceTeacherId));
    if (!sourceTeacher) return;

    try {
      await updateAvailabilityMutation.mutateAsync({
        id: targetTeacher.id,
        data: {
          name: targetTeacher.name,
          availability: sourceTeacher.availability || [],
          color_keyword: targetTeacher.color_keyword,
        },
      });
    } catch (error) {
      console.error('Failed to copy availability:', error);
    }
  };

  // Apply availability to all days of the week
  const [applyingToAllDays, setApplyingToAllDays] = useState(null); // Tracks which teacher is being processed

  const handleApplyToAllDays = async (teacher) => {
    const availability = teacher.availability || [];
    const colorKeyword = teacher.color_keyword;
    const teacherName = teacher.name;

    if (availability.length === 0) {
      const proceed = confirm(
        `${teacherName} has no availability set for ${selectedDay}.\n\nDo you want to clear their availability for all days?`
      );
      if (!proceed) return;
    } else {
      const proceed = confirm(
        `Apply ${teacherName}'s availability (${availability.length} time slots) to all days (Mon-Sun)?`
      );
      if (!proceed) return;
    }

    setApplyingToAllDays(teacher.id);

    try {
      for (const day of weekDays) {
        const targetDate = dayToDate(day);
        if (!targetDate) continue;

        // Get existing teachers for this date
        const existingTeachersResponse = await getTeachers(targetDate);
        const existingTeachers = existingTeachersResponse.data || [];

        // Find if teacher already exists for this date
        const existingTeacher = existingTeachers.find(
          t => t.name.toLowerCase() === teacherName.toLowerCase()
        );

        if (existingTeacher) {
          // Update existing teacher's availability
          await updateTeacher(existingTeacher.id, {
            name: existingTeacher.name,
            availability: availability,
            color_keyword: colorKeyword,
          });
        } else {
          // Create new teacher record for this date
          await createTeacher({
            name: teacherName,
            availability: availability,
            color_keyword: colorKeyword,
            date: targetDate,
          });
        }
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['teachers']);

      alert(`Successfully applied ${teacherName}'s availability to all days!`);
    } catch (error) {
      console.error('Failed to apply availability to all days:', error);
      alert('Failed to apply availability to all days: ' + (error.response?.data?.message || error.message));
    } finally {
      setApplyingToAllDays(null);
    }
  };

  // Drag selection handlers
  const getCellKey = (teacherId, timeSlotId) => `${teacherId}-${timeSlotId}`;

  const handleDragStart = (teacher, timeSlotId, e) => {
    if (isAllWeekMode) return;
    e.preventDefault();

    const isCurrentlyAvailable = teacher.availability?.includes(timeSlotId);
    const mode = isCurrentlyAvailable ? 'remove' : 'add';
    const initialCells = new Set([getCellKey(teacher.id, timeSlotId)]);

    // Update both state and refs
    setDragMode(mode);
    setIsDragging(true);
    setDragStart({ teacherId: teacher.id, timeSlotId });
    setDragEnd({ teacherId: teacher.id, timeSlotId });
    setSelectedCells(initialCells);

    // Update refs immediately for the mouseup handler
    dragModeRef.current = mode;
    isDraggingRef.current = true;
    selectedCellsRef.current = initialCells;
  };

  const handleDragEnter = (teacher, timeSlotId) => {
    if (!isDraggingRef.current || isAllWeekMode) return;

    setDragEnd({ teacherId: teacher.id, timeSlotId });

    // Calculate all cells in the rectangle between dragStart and current position
    const startTeacherIdx = filteredTeachers.findIndex(t => t.id === dragStart?.teacherId);
    const endTeacherIdx = filteredTeachers.findIndex(t => t.id === teacher.id);
    const startSlotIdx = timeSlots?.findIndex(ts => ts.id === dragStart?.timeSlotId) ?? -1;
    const endSlotIdx = timeSlots?.findIndex(ts => ts.id === timeSlotId) ?? -1;

    if (startTeacherIdx === -1 || startSlotIdx === -1) return;

    const minTeacherIdx = Math.min(startTeacherIdx, endTeacherIdx);
    const maxTeacherIdx = Math.max(startTeacherIdx, endTeacherIdx);
    const minSlotIdx = Math.min(startSlotIdx, endSlotIdx);
    const maxSlotIdx = Math.max(startSlotIdx, endSlotIdx);

    const newSelectedCells = new Set();
    for (let ti = minTeacherIdx; ti <= maxTeacherIdx; ti++) {
      for (let si = minSlotIdx; si <= maxSlotIdx; si++) {
        const t = filteredTeachers[ti];
        const s = timeSlots[si];
        if (t && s) {
          newSelectedCells.add(getCellKey(t.id, s.id));
        }
      }
    }

    // Update both state and ref
    setSelectedCells(newSelectedCells);
    selectedCellsRef.current = newSelectedCells;
  };

  // Check if a cell is in the current drag selection
  const isCellSelected = (teacherId, timeSlotId) => {
    return selectedCells.has(getCellKey(teacherId, timeSlotId));
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteTeacher,
    onSuccess: () => {
      queryClient.invalidateQueries(['teachers']);
    },
  });


  // Delete all mutation
  const deleteAllMutation = useMutation({
    mutationFn: (date) => deleteAllTeachers(date),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['teachers']);
      alert(response.data.message || 'Teachers deleted successfully!');
    },
    onError: (error) => {
      console.error('Delete all error:', error);
      alert('Failed to delete all teachers: ' + (error.response?.data?.message || error.message));
    },
  });

  const handleAdd = () => {
    setEditingTeacher(null);
    setIsModalOpen(true);
  };

  const handleEdit = (teacher) => {
    setEditingTeacher(teacher);
    setIsModalOpen(true);
  };

  const handleDelete = async (teacher) => {
    if (confirm(`Are you sure you want to delete ${teacher.name}?`)) {
      try {
        await deleteMutation.mutateAsync(teacher.id);
      } catch (error) {
        alert('Failed to delete teacher');
      }
    }
  };

  const handleDeleteAll = async () => {
    const teacherCount = teachers?.length || 0;

    if (teacherCount === 0) {
      alert('No teachers to delete');
      return;
    }

    const confirmed = confirm(
      `⚠️ WARNING: Delete ALL ${teacherCount} teacher(s) for ${selectedDate}?\n\nThis will remove all teachers for this date only.\n\nA backup will be created automatically before deletion.`
    );

    if (confirmed) {
      try {
        await deleteAllMutation.mutateAsync(selectedDate);
      } catch (error) {
        console.error('Failed to delete all teachers:', error);
      }
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingTeacher(null);
  };

  const handleSave = () => {
    queryClient.invalidateQueries(['teachers']);
    handleModalClose();
  };

  // Notion import handlers
  const handlePreviewFromNotion = async (date) => {
    const response = await previewTeachersFromNotion(date);
    // Handle both formats: array directly or object with teachers array
    if (Array.isArray(response.data)) {
      return response.data;
    } else if (response.data && response.data.teachers) {
      return response.data.teachers;
    } else {
      console.error('Unexpected response format:', response.data);
      return [];
    }
  };

  const handleImportFromNotion = async (teachers) => {
    // Import each teacher for all days since teachers are available all week
    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    for (const teacher of teachers) {
      // Import the teacher for all 7 days, but check for duplicates first
      for (const day of weekDays) {
        const targetDate = dayToDate(day);
        if (targetDate) {
          try {
            // Check if teacher already exists for this date
            const existingTeachers = await getTeachers(targetDate);
            const teacherExists = existingTeachers.data.some(existing => 
              existing.name.toLowerCase() === teacher.name.toLowerCase()
            );
            
            if (!teacherExists) {
              await createTeacher({
                ...teacher,
                date: targetDate
              });
            } else {
              console.log(`Teacher ${teacher.name} already exists for ${day}, skipping...`);
            }
          } catch (error) {
            console.error(`Failed to import ${teacher.name} for ${day}:`, error);
          }
        }
      }
    }
  };

  // Toggle availability for a specific time slot
  const handleToggleAvailability = async (teacher, timeSlotId) => {
    if (isAllWeekMode) {
      // When in All Week mode, just update the current (Monday) record
      // This is a simplified approach to avoid server overload
      const currentAvailability = teacher.availability || [];
      const newAvailability = currentAvailability.includes(timeSlotId)
        ? currentAvailability.filter(id => id !== timeSlotId)
        : [...currentAvailability, timeSlotId].sort();

      try {
        await updateAvailabilityMutation.mutateAsync({
          id: teacher.id,
          data: {
            name: teacher.name,
            availability: newAvailability,
            color_keyword: teacher.color_keyword,
          },
        });
        
        // Show a message explaining the limitation
        console.log('Updated availability in All Week view. Note: This updates the reference record only.');
        
      } catch (error) {
        console.error('Failed to toggle availability:', error);
        alert('Failed to update teacher availability');
      }
    } else {
      // Single day mode - original logic
      const currentAvailability = teacher.availability || [];
      const newAvailability = currentAvailability.includes(timeSlotId)
        ? currentAvailability.filter(id => id !== timeSlotId)
        : [...currentAvailability, timeSlotId].sort();

      try {
        await updateAvailabilityMutation.mutateAsync({
          id: teacher.id,
          data: {
            name: teacher.name,
            availability: newAvailability,
            color_keyword: teacher.color_keyword,
          },
        });
      } catch (error) {
        console.error('Failed to toggle availability:', error);
      }
    }
  };

  // Filter teachers by search term with deduplication
  const filteredTeachers = useMemo(() => {
    if (!teachers) return [];
    
    // Create a map to deduplicate teachers by name
    const uniqueTeachers = new Map();
    teachers.forEach(teacher => {
      if (!uniqueTeachers.has(teacher.name)) {
        uniqueTeachers.set(teacher.name, teacher);
      }
    });
    
    // Filter by search term
    return Array.from(uniqueTeachers.values()).filter((teacher) =>
      teacher.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [teachers, searchTerm]);

  // Global mouseup handler to end drag selection when mouse leaves table
  useEffect(() => {
    const handleGlobalMouseUp = async () => {
      // Use refs to get the latest values
      if (!isDraggingRef.current || selectedCellsRef.current.size === 0) return;

      const cellsToProcess = new Set(selectedCellsRef.current);
      const currentDragMode = dragModeRef.current;

      // Clear refs and state immediately
      isDraggingRef.current = false;
      selectedCellsRef.current = new Set();
      dragModeRef.current = null;

      setIsDragging(false);
      setSelectedCells(new Set());
      setDragStart(null);
      setDragEnd(null);
      setDragMode(null);

      // Group selected cells by teacher
      const teacherChanges = new Map();
      for (const cellKey of cellsToProcess) {
        const [teacherIdStr, timeSlotIdStr] = cellKey.split('-');
        const teacherId = parseInt(teacherIdStr);
        const timeSlotId = parseInt(timeSlotIdStr);

        if (!teacherChanges.has(teacherId)) {
          teacherChanges.set(teacherId, new Set());
        }
        teacherChanges.get(teacherId).add(timeSlotId);
      }

      // Process each teacher's changes
      const updatePromises = [];
      for (const [teacherId, timeSlotIds] of teacherChanges) {
        const teacher = filteredTeachers.find(t => t.id === teacherId);
        if (!teacher) continue;

        let newAvailability = [...(teacher.availability || [])];

        for (const timeSlotId of timeSlotIds) {
          if (currentDragMode === 'add') {
            if (!newAvailability.includes(timeSlotId)) {
              newAvailability.push(timeSlotId);
            }
          } else {
            newAvailability = newAvailability.filter(id => id !== timeSlotId);
          }
        }

        // Sort the availability array
        newAvailability.sort((a, b) => a - b);

        // Only update if there's an actual change
        const originalSorted = [...(teacher.availability || [])].sort((a, b) => a - b);
        if (JSON.stringify(originalSorted) !== JSON.stringify(newAvailability)) {
          updatePromises.push(
            updateAvailabilityMutation.mutateAsync({
              id: teacher.id,
              data: {
                name: teacher.name,
                availability: newAvailability,
                color_keyword: teacher.color_keyword,
              },
            }).catch(error => {
              console.error('Failed to update teacher:', teacher.name, error);
            })
          );
        }
      }

      // Wait for all updates to complete
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [filteredTeachers, updateAvailabilityMutation]);

  // Helper to get time slot names
  const getTimeSlotNames = (availability) => {
    if (!availability || !timeSlots) return '';
    return availability
      .map((id) => timeSlots.find((ts) => ts.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  // Helper to check if teacher has a class at specific time slot
  const getTeacherClassInfo = (teacherName, timeSlotId) => {
    if (!assignments || !assignments.length) return { hasClass: false, students: [] };

    // Find assignments for this teacher and time slot
    const teacherAssignments = assignments.filter(assignment =>
      assignment.time_slot_id === timeSlotId &&
      assignment.teachers?.some(teacher => teacher.name === teacherName)
    );

    if (teacherAssignments.length === 0) {
      return { hasClass: false, students: [] };
    }

    // Collect all students from assignments
    const students = teacherAssignments.reduce((acc, assignment) => {
      if (assignment.students) {
        acc.push(...assignment.students.map(s => s.name));
      }
      return acc;
    }, []);

    // Remove duplicates and get unique student names
    const uniqueStudents = [...new Set(students)];

    return {
      hasClass: true,
      students: uniqueStudents,
      assignmentCount: teacherAssignments.length
    };
  };

  // Helper to get detailed class info for All Week view (per day)
  const getWeeklyClassDetails = (teacherName, timeSlotId) => {
    if (!assignments || !assignments.length) return [];

    const details = [];
    weekDays.forEach(day => {
      const dayAssignments = assignments.filter(a => {
        const assignmentDay = dateToDay(a.date);
        return assignmentDay === day &&
               a.time_slot_id === timeSlotId &&
               a.teachers?.some(t => t.name === teacherName);
      });

      if (dayAssignments.length > 0) {
        dayAssignments.forEach(assignment => {
          details.push({
            day,
            dayAbbrev: dayAbbrev[day],
            students: assignment.students?.map(s => s.name) || [],
            room: assignment.room?.name || 'No room',
            subject: assignment.subject || '',
            notes: assignment.notes || ''
          });
        });
      }
    });

    return details;
  };

  // Build tooltip text for All Week view cell
  const buildWeeklyTooltip = (teacherName, timeSlotId, classDays) => {
    if (classDays.length === 0) return '';

    const lines = [];
    classDays.forEach(day => {
      const dayAssignments = assignments?.filter(a => {
        const assignmentDay = dateToDay(a.date);
        return assignmentDay === day &&
               a.time_slot_id === timeSlotId &&
               a.teachers?.some(t => t.name === teacherName);
      }) || [];

      dayAssignments.forEach(assignment => {
        const students = assignment.students?.map(s => s.name).join(', ') || 'No students';
        const room = assignment.room?.name || 'No room';
        lines.push(`${dayAbbrev[day]}: ${students} (${room})`);
      });
    });

    return lines.join('\n');
  };

  // Open class details modal
  const openClassDetailsModal = (teacherName, timeSlot) => {
    const details = getWeeklyClassDetails(teacherName, timeSlot.id);
    setClassDetailsModal({
      isOpen: true,
      teacherName,
      timeSlot,
      classDetails: details
    });
  };

  // Check if loading
  const isLoading = isAllWeekMode ? allWeekTeachersLoading : teachersLoading;

  if (isLoading) {
    return <div className="text-center py-8">Loading teachers...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Teachers Management</h2>
          <div className="flex gap-3">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold shadow-md hover:shadow-lg transition-all"
            >
              Import from Notion
            </button>
            <button
              onClick={handleDeleteAll}
              disabled={deleteAllMutation.isPending || !teachers || teachers.length === 0}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md hover:shadow-lg transition-all"
            >
              Delete All Teachers
            </button>
            <button
              onClick={handleAdd}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-md hover:shadow-lg transition-all"
            >
              + Add Teacher
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
              Showing aggregated availability across all 7 days. Each cell shows day badges indicating availability status.
            </p>
          </div>
        )}

        {/* Legend */}
        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Legend</h3>
          {isAllWeekMode ? (
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-red-500 text-white rounded text-[10px] font-bold">Mon</span>
                <span><strong>Has Class</strong> - Teacher has class on that day</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-green-500 text-white rounded text-[10px] font-bold">Tue</span>
                <span><strong>Free</strong> - Available but no class</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-[10px]">Off: Wed</span>
                <span><strong>Off</strong> - Not available that day</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">#</span>
                </div>
                <span><strong>Has Class</strong> - Teacher has assigned students (Red)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
                <span><strong>Available</strong> - Teacher is available but no class (Green)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gray-200 rounded"></div>
                <span><strong>Unavailable</strong> - Teacher is not available (Gray)</span>
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search teachers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-5 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
          />
        </div>

        {/* Quick Actions Toolbar */}
        {!isAllWeekMode && (
          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Preset Templates */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">Apply to selected teacher:</span>
                <select
                  value=""
                  onChange={(e) => {
                    const preset = presetTemplates.find(p => p.name === e.target.value);
                    if (preset && editingTeacher) {
                      applyPresetToTeacher(editingTeacher, preset.ids);
                    } else if (preset) {
                      alert('Click on a teacher name first to select them, then choose a preset.');
                    }
                    e.target.value = '';
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Preset...</option>
                  {presetTemplates.map(preset => (
                    <option key={preset.name} value={preset.name}>{preset.name}</option>
                  ))}
                </select>
              </div>

              {/* Copy From Teacher */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">Copy schedule from:</span>
                <select
                  value={copyFromTeacherId}
                  onChange={(e) => setCopyFromTeacherId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
                >
                  <option value="">Select source teacher...</option>
                  {filteredTeachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Usage Tips */}
            <div className="mt-3 text-xs text-gray-500 space-y-1">
              <p><strong>Tips for faster editing:</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li><strong>Drag to select:</strong> Click and drag across multiple cells to select a range, then release to toggle them all</li>
                <li><strong>Column toggle:</strong> Click a time slot header to toggle that slot for ALL teachers</li>
                <li><strong>Row toggle:</strong> Right-click a teacher name to toggle all their time slots</li>
                <li><strong>Copy schedule:</strong> Select a source teacher above, then click "Copy" button next to any teacher</li>
              </ul>
            </div>
          </div>
        )}

        {/* Teachers Grid */}
        <div className="overflow-x-auto max-h-[calc(100vh-400px)] overflow-y-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-900 sticky left-0 top-0 bg-gray-200 z-20">
                  Teacher Name
                </th>
                {timeSlots?.map((slot, index) => {
                  // Determine background color based on position
                  const bgColor = Math.floor(index / 2) % 2 === 0 ? 'bg-gray-200' : 'bg-gray-300';
                  const isClickable = !isAllWeekMode;

                  return (
                    <th
                      key={slot.id}
                      className={`border border-gray-300 px-2 py-3 text-center text-xs font-semibold text-gray-900 min-w-[80px] sticky top-0 z-10 ${bgColor} ${isClickable ? 'cursor-pointer hover:bg-blue-200 transition-colors' : ''}`}
                      onClick={() => isClickable && handleToggleColumn(slot.id)}
                      title={isClickable ? `Click to toggle ${slot.name} for all teachers` : ''}
                    >
                      {slot.name.replace(' to ', '-')}
                      {isClickable && <div className="text-[9px] text-gray-500 font-normal">click to toggle</div>}
                    </th>
                  );
                })}
                <th className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-900 sticky right-0 top-0 bg-gray-200 z-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={timeSlots?.length + 2 || 3} className="px-4 py-8 text-center text-gray-500">
                    No teachers found
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((teacher) => {
                  // Get color for this teacher
                  const getTeacherColor = () => {
                    if (!teacher.color_keyword) return '#10b981'; // default green
                    const colorMap = {
                      red: '#ef4444',
                      blue: '#3b82f6',
                      green: '#10b981',
                      yellow: '#eab308',
                      purple: '#a855f7',
                      orange: '#f97316',
                      pink: '#ec4899',
                    };
                    return colorMap[teacher.color_keyword] || '#10b981';
                  };

                  return (
                    <tr key={teacher.id} className="hover:bg-gray-50">
                      <td
                        className="border border-gray-300 px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white hover:bg-blue-100 z-10 cursor-pointer"
                        onClick={() => handleEdit(teacher)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (!isAllWeekMode) {
                            handleToggleRow(teacher);
                          }
                        }}
                        title={isAllWeekMode ? "Click to edit teacher" : "Click to edit | Right-click to toggle all slots"}
                      >
                        <div className="flex items-center gap-2">
                          <span>{teacher.name}</span>
                          {!isAllWeekMode && (
                            <span className="text-[9px] text-gray-400">(R-click: toggle all)</span>
                          )}
                        </div>
                      </td>
                      {timeSlots?.map((slot, index) => {
                        // Determine background color based on position
                        const bgColor = Math.floor(index / 2) % 2 === 0 ? '#eff6ff' : '#f3f4f6'; // blue-50 or gray-50

                        if (isAllWeekMode) {
                          // All Week mode - show aggregated availability per day
                          const classDays = [];
                          const freeDays = [];
                          const offDays = [];

                          weekDays.forEach(day => {
                            const availability = teacherAvailabilityByDay[teacher.name]?.[day] || [];
                            const isAvailableOnDay = availability.includes(slot.id);

                            // Check if has class on this day
                            const dayAssignments = assignments?.filter(a => {
                              const assignmentDay = dateToDay(a.date);
                              return assignmentDay === day &&
                                     a.time_slot_id === slot.id &&
                                     a.teachers?.some(t => t.name === teacher.name);
                            }) || [];
                            const hasClassOnDay = dayAssignments.length > 0;

                            if (hasClassOnDay) {
                              classDays.push(day);
                            } else if (isAvailableOnDay) {
                              freeDays.push(day);
                            } else {
                              offDays.push(day);
                            }
                          });

                          // If off all week, show empty cell
                          if (offDays.length === 7) {
                            return (
                              <td
                                key={slot.id}
                                className="px-1 py-1 text-center border border-gray-300"
                                style={{ backgroundColor: bgColor }}
                                title="Not available all week"
                              >
                                <span className="text-gray-400 text-xs">—</span>
                              </td>
                            );
                          }

                          // Build detailed tooltip with student names
                          const tooltipText = classDays.length > 0
                            ? buildWeeklyTooltip(teacher.name, slot.id, classDays) +
                              (freeDays.length > 0 ? `\n\nFree: ${freeDays.map(d => dayAbbrev[d]).join(', ')}` : '') +
                              (offDays.length > 0 ? `\nOff: ${offDays.map(d => dayAbbrev[d]).join(', ')}` : '') +
                              '\n\n(Click for details)'
                            : `Free: ${freeDays.map(d => dayAbbrev[d]).join(', ') || 'None'}\nOff: ${offDays.map(d => dayAbbrev[d]).join(', ') || 'None'}`;

                          return (
                            <td
                              key={slot.id}
                              className={`px-1 py-1 text-center border border-gray-300 ${classDays.length > 0 ? 'cursor-pointer hover:opacity-80' : ''}`}
                              style={{ backgroundColor: bgColor }}
                              title={tooltipText}
                              onClick={() => {
                                if (classDays.length > 0) {
                                  openClassDetailsModal(teacher.name, slot);
                                }
                              }}
                            >
                              <div className="space-y-0.5">
                                {classDays.length > 0 && (
                                  <div className="flex flex-wrap gap-0.5 justify-center">
                                    {classDays.map(day => {
                                      // Get student count for this day
                                      const dayAssignments = assignments?.filter(a => {
                                        const assignmentDay = dateToDay(a.date);
                                        return assignmentDay === day &&
                                               a.time_slot_id === slot.id &&
                                               a.teachers?.some(t => t.name === teacher.name);
                                      }) || [];
                                      const studentCount = dayAssignments.reduce((sum, a) => sum + (a.students?.length || 0), 0);

                                      return (
                                        <span
                                          key={day}
                                          className="px-1 py-0.5 bg-red-500 text-white rounded text-[8px] font-bold"
                                          title={`${day}: ${studentCount} student(s)`}
                                        >
                                          {dayAbbrev[day]}{studentCount > 0 ? `:${studentCount}` : ''}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                {freeDays.length > 0 && (
                                  <div className="flex flex-wrap gap-0.5 justify-center">
                                    {freeDays.map(day => (
                                      <span
                                        key={day}
                                        className="px-1 py-0.5 bg-green-500 text-white rounded text-[8px] font-bold"
                                      >
                                        {dayAbbrev[day]}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {offDays.length > 0 && offDays.length < 7 && (
                                  <div className="text-[7px] text-gray-400">
                                    Off: {offDays.map(d => dayAbbrev[d]).join(',')}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        }

                        // Single day mode - original logic
                        const isAvailable = teacher.availability?.includes(slot.id);
                        const classInfo = getTeacherClassInfo(teacher.name, slot.id);
                        const isSelected = isCellSelected(teacher.id, slot.id);

                        // Determine cell styling based on availability and class assignment
                        let cellStyle = { backgroundColor: bgColor };
                        let cellContent = null;
                        let titleText = 'Not available - Click/drag to add';

                        if (classInfo.hasClass) {
                          // Teacher has a class - show with bright red background
                          cellStyle = {
                            backgroundColor: '#dc2626', // bright red for classes
                            color: 'white'
                          };
                          cellContent = (
                            <div className="text-white text-xs font-bold">
                              <div>{classInfo.students.length}</div>
                            </div>
                          );
                          titleText = `HAS CLASS: ${classInfo.students.join(', ')} (${classInfo.students.length} student${classInfo.students.length !== 1 ? 's' : ''})`;
                        } else if (isAvailable) {
                          // Teacher is available but no class assigned - show with green background
                          cellStyle = {
                            backgroundColor: '#16a34a', // bright green for available
                            color: 'white'
                          };
                          cellContent = (
                            <div className="text-white text-xs font-bold">✓</div>
                          );
                          titleText = 'Available - Click/drag to remove';
                        }

                        // Add selection highlight
                        if (isSelected) {
                          cellStyle = {
                            ...cellStyle,
                            outline: '3px solid #3b82f6',
                            outlineOffset: '-2px',
                            backgroundColor: dragMode === 'add' ? '#bfdbfe' : '#fecaca'
                          };
                        }

                        return (
                          <td
                            key={slot.id}
                            className="px-2 py-1 text-center border border-gray-300 cursor-pointer select-none transition-all"
                            style={cellStyle}
                            onMouseDown={(e) => handleDragStart(teacher, slot.id, e)}
                            onMouseEnter={() => handleDragEnter(teacher, slot.id)}
                            title={titleText}
                          >
                            {cellContent}
                          </td>
                        );
                      })}
                      <td className="border border-gray-300 px-2 py-2 text-center sticky right-0 bg-white hover:bg-gray-50 z-10 min-w-[200px]">
                        <div className="flex flex-col gap-1">
                          {/* Quick Actions Row */}
                          {!isAllWeekMode && (
                            <div className="flex items-center justify-center gap-1">
                              {/* Preset Dropdown */}
                              <select
                                className="px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value=""
                                onChange={(e) => {
                                  const preset = presetTemplates.find(p => p.name === e.target.value);
                                  if (preset) {
                                    applyPresetToTeacher(teacher, preset.ids);
                                  }
                                  e.target.value = '';
                                }}
                              >
                                <option value="">Preset...</option>
                                {presetTemplates.map(preset => (
                                  <option key={preset.name} value={preset.name}>{preset.name}</option>
                                ))}
                              </select>

                              {/* Copy Button */}
                              {copyFromTeacherId && copyFromTeacherId !== String(teacher.id) && (
                                <button
                                  onClick={() => handleCopyFromTeacher(teacher, copyFromTeacherId)}
                                  className="px-2 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                  title={`Copy schedule from ${teachers.find(t => t.id === parseInt(copyFromTeacherId))?.name || 'selected teacher'}`}
                                >
                                  Copy
                                </button>
                              )}

                              {/* Apply to All Days Button */}
                              <button
                                onClick={() => handleApplyToAllDays(teacher)}
                                disabled={applyingToAllDays === teacher.id}
                                className="px-2 py-0.5 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                title="Apply this schedule to all days (Mon-Sun)"
                              >
                                {applyingToAllDays === teacher.id ? '...' : 'All Days'}
                              </button>
                            </div>
                          )}

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDelete(teacher)}
                            disabled={deleteMutation.isPending}
                            className="px-3 py-1 text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
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

        <div className="mt-4 text-sm text-gray-600">
          Total: {filteredTeachers.length} teacher{filteredTeachers.length !== 1 ? 's' : ''}
        </div>
      </div>

      {isModalOpen && (
        <TeacherFormModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSave={handleSave}
          teacher={editingTeacher}
          timeSlots={timeSlots || []}
          selectedDate={selectedDate}
        />
      )}

      {isImportModalOpen && (
        <NotionImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          type="teachers"
          selectedDate={selectedDate}
          onPreview={handlePreviewFromNotion}
          onImport={handleImportFromNotion}
        />
      )}

      {/* Class Details Modal for All Week View */}
      {classDetailsModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {classDetailsModal.teacherName}
                  </h2>
                  <p className="text-blue-100 text-sm">
                    {classDetailsModal.timeSlot?.name} • Weekly Class Details
                  </p>
                </div>
                <button
                  onClick={() => setClassDetailsModal({ ...classDetailsModal, isOpen: false })}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {classDetailsModal.classDetails.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No classes scheduled for this time slot.</p>
              ) : (
                <div className="space-y-4">
                  {classDetailsModal.classDetails.map((detail, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span className="px-3 py-1 bg-red-500 text-white rounded-full text-sm font-bold">
                          {detail.day}
                        </span>
                        <span className="text-gray-600 text-sm">
                          Room: <strong>{detail.room}</strong>
                        </span>
                        {detail.subject && (
                          <span className="text-gray-600 text-sm">
                            Subject: <strong>{detail.subject}</strong>
                          </span>
                        )}
                      </div>

                      <div className="mb-2">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">
                          Students ({detail.students.length}):
                        </h4>
                        {detail.students.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {detail.students.map((student, sIdx) => (
                              <span
                                key={sIdx}
                                className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                              >
                                {student}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-400 text-sm">No students assigned</p>
                        )}
                      </div>

                      {detail.notes && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-sm text-gray-600">
                            <strong>Notes:</strong> {detail.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">
                  {classDetailsModal.classDetails.length} class{classDetailsModal.classDetails.length !== 1 ? 'es' : ''} this week
                </p>
                <button
                  onClick={() => setClassDetailsModal({ ...classDetailsModal, isOpen: false })}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default TeachersPage;
