import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateAssignment, getTeachers } from '../services/api';

export function useDragDropAssignment(teacherAvailabilityByDay, teachersByDay) {
  const queryClient = useQueryClient();
  const [activeItem, setActiveItem] = useState(null);
  const [validDropTargets, setValidDropTargets] = useState(new Set());
  const [isDragging, setIsDragging] = useState(false);

  // Helper to get teacher ID from name and date
  const getTeacherIdByName = useCallback(async (teacherName, date) => {
    // First check cached teacher data
    if (teachersByDay) {
      for (const dayTeachers of Object.values(teachersByDay)) {
        const teacher = dayTeachers.find(t => t.name === teacherName);
        if (teacher) return teacher.id;
      }
    }

    // Fallback to API call
    try {
      const response = await getTeachers(date);
      const teacher = response.data.find(t => t.name === teacherName);
      return teacher?.id;
    } catch (error) {
      console.error('Failed to get teacher ID:', error);
      return null;
    }
  }, [teachersByDay]);

  // Mutation for updating a single assignment
  const updateMutation = useMutation({
    mutationFn: async ({ assignments, newTeacherName, newTimeSlotId }) => {
      const results = [];

      for (const assignment of assignments) {
        // Get the teacher ID for the new teacher
        const teacherId = await getTeacherIdByName(newTeacherName, assignment.date);

        if (!teacherId) {
          throw new Error(`Teacher "${newTeacherName}" not found for date ${assignment.date}`);
        }

        // Build update data
        const updateData = {
          time_slot_id: newTimeSlotId,
          teachers: [{
            teacher_id: teacherId,
            is_substitute: false
          }],
          // Preserve other fields
          students: assignment.students?.map(s => ({ student_id: s.id })) || [],
          notes: assignment.notes,
          subject: assignment.subject,
          color_keyword: assignment.color_keyword,
        };

        const result = await updateAssignment(assignment.id, updateData);
        results.push(result);
      }

      return results;
    },
    onSuccess: () => {
      // Invalidate all relevant queries to refresh the grid
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyData'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error) => {
      console.error('Failed to move class:', error);
      // Refresh to restore consistent state
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });

  // Validate if a drop target is valid for the current drag item
  const validateDropTarget = useCallback((sourceData, targetData) => {
    const { classGroup, sourceTeacherName, sourceTimeSlotId } = sourceData;
    const { targetTeacherName, targetTimeSlotId } = targetData;

    // Same cell - not valid (no change)
    if (sourceTeacherName === targetTeacherName && sourceTimeSlotId === targetTimeSlotId) {
      return { valid: false, reason: 'Same cell' };
    }

    // Check teacher availability for all days in the class group
    const unavailableDays = [];
    for (const day of classGroup.days) {
      const availability = teacherAvailabilityByDay[targetTeacherName]?.[day] || [];
      // Handle both string and number comparison
      if (!availability.some(a => a == targetTimeSlotId)) {
        unavailableDays.push(day);
      }
    }

    if (unavailableDays.length > 0) {
      return {
        valid: false,
        reason: `${targetTeacherName} not available on: ${unavailableDays.join(', ')}`
      };
    }

    return { valid: true };
  }, [teacherAvailabilityByDay]);

  // Calculate all valid drop targets when drag starts
  const calculateValidTargets = useCallback((sourceData, allTeachers, timeSlots) => {
    const validTargets = new Set();

    for (const teacherName of allTeachers) {
      for (const slot of timeSlots) {
        const validation = validateDropTarget(sourceData, {
          targetTeacherName: teacherName,
          targetTimeSlotId: slot.id,
        });

        if (validation.valid) {
          validTargets.add(`cell-${teacherName}-${slot.id}`);
        }
      }
    }

    return validTargets;
  }, [validateDropTarget]);

  // Handle drag start
  const handleDragStart = useCallback((event, allTeachers, timeSlots) => {
    const { active } = event;
    setActiveItem(active.data.current);
    setIsDragging(true);

    // Pre-calculate all valid drop targets
    const targets = calculateValidTargets(active.data.current, allTeachers, timeSlots);
    setValidDropTargets(targets);
  }, [calculateValidTargets]);

  // Handle drag over (for real-time validation feedback)
  const handleDragOver = useCallback(() => {
    // Visual feedback is handled by the validDropTargets set
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;

    setActiveItem(null);
    setIsDragging(false);
    setValidDropTargets(new Set());

    if (!over) return; // Dropped outside any target

    const sourceData = active.data.current;
    const targetData = over.data.current;

    if (!targetData) return; // Invalid drop target

    // Validate the drop
    const validation = validateDropTarget(sourceData, targetData);
    if (!validation.valid) {
      if (validation.reason !== 'Same cell') {
        alert(`Cannot move here: ${validation.reason}`);
      }
      return;
    }

    // Perform the move - update all assignments in the class group
    try {
      await updateMutation.mutateAsync({
        assignments: sourceData.assignments,
        newTeacherName: targetData.targetTeacherName,
        newTimeSlotId: targetData.targetTimeSlotId,
      });
    } catch (error) {
      alert(`Failed to move class: ${error.message}`);
    }
  }, [validateDropTarget, updateMutation]);

  // Handle drag cancel
  const handleDragCancel = useCallback(() => {
    setActiveItem(null);
    setIsDragging(false);
    setValidDropTargets(new Set());
  }, []);

  return {
    activeItem,
    validDropTargets,
    isDragging,
    isUpdating: updateMutation.isPending,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
