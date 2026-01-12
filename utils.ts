// --- Utility Functions ---

// 한국 공휴일 목록
export const koreanHolidays = new Set([
  '2024-01-01', '2024-02-09', '2024-02-10', '2024-02-11', '2024-02-12', '2024-03-01', 
  '2024-04-10', '2024-05-01', '2024-05-05', '2024-05-06', '2024-05-15', '2024-06-06', 
  '2024-08-15', '2024-09-16', '2024-09-17', '2024-10-03', '2024-10-09', '2024-12-25', 
  '2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30', '2025-03-01', '2025-05-01', 
  '2025-05-05', '2025-05-06', '2025-06-06', '2025-08-15', '2025-10-03', '2025-10-06', 
  '2025-10-07', '2025-10-08', '2025-10-09', '2025-12-25', '2026-01-01', '2026-02-16', 
  '2026-02-17', '2026-02-18', '2026-03-01', '2026-05-01', '2026-05-05', '2026-05-25', 
  '2026-06-06', '2026-08-15', '2026-09-24', '2026-09-25', '2026-09-26', '2026-10-03', 
  '2026-10-09', '2026-12-25'
]);

// 근무일 계산 함수
export const calculateWorkingDays = (startDateStr: string, endDateStr: string): number => {
  if (!startDateStr || !endDateStr) return 0;
  
  let currentDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  
  if (isNaN(currentDate.getTime()) || isNaN(endDate.getTime()) || currentDate > endDate) {
    return 0;
  }
  
  let workingDays = 0;
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    const dateString = currentDate.toISOString().split('T')[0];
    
    // 주말이 아니고 공휴일이 아닌 경우만 카운트
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !koreanHolidays.has(dateString)) {
      workingDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return workingDays;
};

// 오늘 날짜 문자열 반환 (KST 기준)
export const getTodayStr = (): string => {
  const today = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  return new Date(today.getTime() + kstOffset).toISOString().split('T')[0];
};
