import { useDraggable } from '@dnd-kit/core';

function DraggableClassCard({
  classGroup,
  teacherName,
  timeSlotId,
  children,
  groupIndex,
}) {
  // Create a unique ID for this draggable item
  // Use groupIndex to differentiate multiple class groups in the same cell
  const draggableId = `class-${teacherName}-${timeSlotId}-${groupIndex}`;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: {
      classGroup,
      sourceTeacherName: teacherName,
      sourceTimeSlotId: timeSlotId,
      assignments: classGroup.assignments,
    },
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}

export default DraggableClassCard;
