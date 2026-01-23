import { weekDays } from '../utils/dayMapping';

function DragOverlayContent({ classGroup }) {
  if (!classGroup) return null;

  // Helper to format day ranges
  const formatDays = (days) => {
    if (days.length === 0) return '';
    if (days.length === 1) return days[0];
    if (days.length === 7) return 'Every day';

    // Check for consecutive days
    const dayIndices = days.map(d => weekDays.indexOf(d));
    const isConsecutive = dayIndices.every((val, i) => i === 0 || val === dayIndices[i - 1] + 1);

    if (isConsecutive && days.length > 2) {
      return `${days[0]} - ${days[days.length - 1]}`;
    }

    // Abbreviate day names for display
    const abbrevDays = days.map(d => d.substring(0, 3));
    return abbrevDays.join(', ');
  };

  // Helper to get color based on days
  const getDayColor = (days) => {
    if (days.length === 7) return 'bg-purple-100 text-purple-800';
    if (days.length >= 5) return 'bg-blue-100 text-blue-800';
    if (days.length >= 3) return 'bg-green-100 text-green-800';
    if (days.length === 2) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  // Helper to get container color based on assignment/student color
  const getContainerColor = () => {
    const assignmentColor = classGroup.assignments?.[0]?.color_keyword;
    const studentColor = classGroup.students?.[0]?.color_keyword;
    const colorKeyword = assignmentColor || studentColor;

    if (colorKeyword) {
      const colorMap = {
        red: 'bg-red-300 text-red-900',
        blue: 'bg-blue-300 text-blue-900',
        green: 'bg-green-300 text-green-900',
        yellow: 'bg-yellow-300 text-yellow-900',
        purple: 'bg-purple-300 text-purple-900',
        orange: 'bg-orange-300 text-orange-900',
        pink: 'bg-pink-300 text-pink-900',
      };
      return colorMap[colorKeyword] || 'bg-blue-300 text-blue-900';
    }

    return 'bg-blue-300 text-blue-900';
  };

  return (
    <div
      className={`border-2 border-blue-500 rounded-lg p-3 shadow-xl ${getContainerColor()}
                  transform scale-105 cursor-grabbing min-w-[180px] max-w-[250px]`}
    >
      {/* Day indicator */}
      <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium mb-2 ${getDayColor(classGroup.days)}`}>
        {formatDays(classGroup.days)}
      </div>

      {/* Subject */}
      {classGroup.subject && (
        <div className="text-xs font-semibold mb-1">
          {classGroup.subject}
        </div>
      )}

      {/* Students */}
      {classGroup.students?.length > 0 && (
        <div className="text-xs">
          <div className="font-medium mb-1">
            {classGroup.students.length} student{classGroup.students.length !== 1 ? 's' : ''}
          </div>
          <div className="opacity-80">
            {classGroup.students.slice(0, 3).map(s => s.name).join(', ')}
            {classGroup.students.length > 3 && ` +${classGroup.students.length - 3}`}
          </div>
        </div>
      )}

      {/* Drag indicator */}
      <div className="mt-2 text-xs font-medium text-center border-t border-current/20 pt-2">
        Drop to move class
      </div>
    </div>
  );
}

export default DragOverlayContent;
