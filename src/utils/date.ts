export const getDailyDate = (): string => new Date().toISOString().slice(0, 10);

export const isToday = (dateStr: string): boolean => dateStr === getDailyDate();

export const isThisWeek = (dateStr: string): boolean => {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return date >= startOfWeek && date < endOfWeek;
};
