// Wrapper component that passes selectedDay as selectedDate for legacy components
function DayWrapper({ selectedDay, Component }) {
  // For "All Week" view, use Monday as the reference day
  const selectedDate = selectedDay === 'All Week' ? 'Monday' : selectedDay;
  const isAllWeekMode = selectedDay === 'All Week';

  return <Component selectedDate={selectedDate} selectedDay={selectedDay} isAllWeekMode={isAllWeekMode} />;
}

export default DayWrapper;
