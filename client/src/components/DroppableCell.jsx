import { useDroppable } from '@dnd-kit/core';

function DroppableCell({
  teacherName,
  timeSlotId,
  children,
  isValidDropTarget,
  isDragging,
  className = '',
  onClick,
}) {
  const droppableId = `cell-${teacherName}-${timeSlotId}`;

  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: {
      targetTeacherName: teacherName,
      targetTimeSlotId: timeSlotId,
    },
  });

  // Determine cell styling based on drop state
  let dropStyles = '';
  if (isDragging) {
    if (isOver) {
      if (isValidDropTarget) {
        dropStyles = 'ring-4 ring-green-500 ring-inset bg-green-50';
      } else {
        dropStyles = 'ring-4 ring-red-500 ring-inset bg-red-50';
      }
    } else if (isValidDropTarget) {
      // Show subtle indication of valid targets
      dropStyles = 'bg-green-50/50';
    }
  }

  return (
    <td
      ref={setNodeRef}
      className={`${className} ${dropStyles} transition-all duration-150`}
      onClick={onClick}
    >
      {children}
    </td>
  );
}

export default DroppableCell;
