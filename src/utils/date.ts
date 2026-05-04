import { clock } from "./clock";

export const getDailyDate = (): string => clock.dailyDate();

export const isToday = (dateStr: string): boolean => dateStr === getDailyDate();

export const isThisWeek = (dateStr: string): boolean => {
  const today = getDailyDate();
  const todayDate = new Date(today);
  // Monday as start of week (ISO 8601 standard): getDay() returns 0=Sun, 1=Mon ... 6=Sat
  const dayOfWeek = todayDate.getDay(); // 0 (Sun) – 6 (Sat)
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(todayDate);
  monday.setDate(todayDate.getDate() - daysFromMonday);
  const mondayStr = monday.toLocaleDateString("sv");

  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  const nextMondayStr = nextMonday.toLocaleDateString("sv");

  return dateStr >= mondayStr && dateStr < nextMondayStr;
};
