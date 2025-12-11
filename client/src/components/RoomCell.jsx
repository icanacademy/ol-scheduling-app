function RoomCell({ assignment, timeSlotId, teachers, students, onClick, columnBgColor }) {
  if (!assignment) {
    return (
      <td
        className={`border border-gray-300 p-2 cursor-pointer hover:bg-gray-50 room-cell ${columnBgColor || ''}`}
        onClick={onClick}
      >
        <div className="text-gray-400 text-xs text-center">Click to assign</div>
      </td>
    );
  }

  const assignedTeachers = assignment.teachers || [];
  const assignedStudents = assignment.students || [];

  // Check if any assigned teachers don't have availability for this time slot
  // This includes: deleted teachers OR teachers who removed this time slot from availability
  const unavailableTeachers = assignedTeachers.filter((assignedTeacher) => {
    const teacherData = teachers.find((t) => t.id === assignedTeacher.id);
    // Teacher was deleted OR doesn't have availability for this time slot
    return !teacherData || !teacherData.availability.includes(timeSlotId);
  });

  // Check if any assigned students don't have availability for this time slot
  // This includes: deleted students OR students who removed this time slot from availability
  const unavailableStudents = assignedStudents.filter((assignedStudent) => {
    const studentData = students.find((s) => s.id === assignedStudent.id);
    // Student was deleted OR doesn't have availability for this time slot
    return !studentData || !studentData.availability.includes(timeSlotId);
  });

  const hasUnavailable = unavailableTeachers.length > 0 || unavailableStudents.length > 0;


  return (
    <td
      className={`border border-gray-300 p-2 cursor-pointer hover:bg-blue-50 room-cell ${columnBgColor || ''}`}
      style={{
        backgroundColor: hasUnavailable ? '#fed7aa' : undefined,
      }}
      onClick={onClick}
    >
      {hasUnavailable && (
        <div className="text-xs font-bold text-orange-700 mb-2 flex items-center gap-1">
          ⚠️ Availability Issue
        </div>
      )}
      <div className="space-y-2">
        {/* Teachers and Students side by side */}
        <div className="flex gap-3">
          {/* Teachers */}
          {assignedTeachers.length > 0 && (
            <div className="flex-1">
              <div className="text-xs font-semibold text-gray-700 mb-1">Teacher/s:</div>
              <div className="flex flex-wrap gap-1">
                {assignedTeachers.map((teacher) => {
                  const isUnavailable = unavailableTeachers.some((t) => t.id === teacher.id);
                  return (
                    <span
                      key={teacher.id}
                      className={teacher.is_substitute ? 'substitute-chip' : 'teacher-chip'}
                      title={
                        isUnavailable
                          ? '⚠️ No longer available for this time slot'
                          : teacher.is_substitute
                          ? 'Substitute'
                          : 'Regular'
                      }
                      style={{
                        backgroundColor: isUnavailable
                          ? '#fca5a5'
                          : getColorForKeyword(teacher.color_keyword || 'green'),
                        textDecoration: isUnavailable ? 'line-through' : undefined,
                      }}
                    >
                      {isUnavailable && '⚠️ '}
                      {teacher.name}
                      {teacher.is_substitute && ' (SUB)'}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Students */}
          {assignedStudents.length > 0 && (
            <div className="flex-1">
              <div className="text-xs font-semibold text-gray-700 mb-1">Student/s:</div>
              <div className="flex flex-wrap gap-1">
                {assignedStudents.map((student) => {
                  const isUnavailable = unavailableStudents.some((s) => s.id === student.id);
                  return (
                    <span
                      key={student.id}
                      className="student-chip"
                      title={
                        isUnavailable
                          ? '⚠️ No longer available for this time slot'
                          : `${student.name}${student.weakness_level ? ` - Level: ${student.weakness_level}` : ''}`
                      }
                      style={{
                        backgroundColor: isUnavailable
                          ? '#fca5a5'
                          : getColorForKeyword(student.color_keyword || 'blue'),
                        textDecoration: isUnavailable ? 'line-through' : undefined,
                      }}
                    >
                      {isUnavailable && '⚠️ '}
                      {student.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        {assignment.notes && (
          <div className="text-xs text-gray-600 italic mt-1">
            Note: {assignment.notes}
          </div>
        )}
      </div>
    </td>
  );
}

// Helper function to get color for keyword
function getColorForKeyword(keyword) {
  const colorMap = {
    red: '#fecaca',
    blue: '#bfdbfe',
    green: '#bbf7d0',
    yellow: '#fef08a',
    purple: '#e9d5ff',
    orange: '#fed7aa',
    pink: '#fbcfe8',
  };
  return colorMap[keyword.toLowerCase()] || '#d1d5db';
}

export default RoomCell;
