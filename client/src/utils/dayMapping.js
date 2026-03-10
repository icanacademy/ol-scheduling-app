// Day mapping utilities for weekly scheduling
// The system now uses day names directly (no date conversion needed)

export const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Identity functions for backward compatibility
// Previously these converted between day names and fixed dates (e.g., "Monday" ↔ "2024-01-01")
// Now the system uses day names directly throughout
export const dayToDate = (day) => day;
export const dateToDay = (date) => date;

// weekDates is now identical to weekDays (kept for backward compatibility)
export const weekDates = weekDays;
