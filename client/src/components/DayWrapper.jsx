import { dayToDate } from '../utils/dayMapping';

// Wrapper component that converts selectedDay to selectedDate for legacy components
function DayWrapper({ selectedDay, Component }) {
  // For "All Week" view, use Monday as the reference day to show all teachers/students
  // Since teachers and students are the same across all days in our day-based system
  const selectedDate = selectedDay === 'All Week' ? dayToDate('Monday') : dayToDate(selectedDay);
  const isAllWeekMode = selectedDay === 'All Week';
  
  return <Component selectedDate={selectedDate} selectedDay={selectedDay} isAllWeekMode={isAllWeekMode} />;
}

export default DayWrapper;