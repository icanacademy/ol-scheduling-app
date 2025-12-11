// Maps day names to fixed dates for consistent weekly scheduling
// Using a fixed week in 2024 (Jan 1-7, 2024, where Jan 1 is Monday)
export const dayToDate = (day) => {
  const dayMap = {
    'Monday': '2024-01-01',
    'Tuesday': '2024-01-02',
    'Wednesday': '2024-01-03',
    'Thursday': '2024-01-04',
    'Friday': '2024-01-05',
    'Saturday': '2024-01-06',
    'Sunday': '2024-01-07'
  };
  
  return dayMap[day] || null;
};

export const dateToDay = (date) => {
  const dateMap = {
    '2024-01-01': 'Monday',
    '2024-01-02': 'Tuesday',
    '2024-01-03': 'Wednesday',
    '2024-01-04': 'Thursday',
    '2024-01-05': 'Friday',
    '2024-01-06': 'Saturday',
    '2024-01-07': 'Sunday'
  };
  
  return dateMap[date] || null;
};

export const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const weekDates = weekDays.map(day => dayToDate(day));