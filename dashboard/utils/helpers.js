/**
 * helpers.js
 * 대시보드에서 사용하는 공통 유틸리티 함수 정의
 */

/**
 * ISO 날짜 문자열을 한국어 형식으로 변환 (YYYY. MM. DD. HH:MM:SS)
 * @param {string} isoString 
 * @returns {string|null}
 */
export function formatKoreanDate(isoString) {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    return d.toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    });
  } catch {
    return isoString;
  }
}

/**
 * 로그 줄의 레벨 판별 (error, warn, info)
 * @param {string} line 
 * @returns {string}
 */
export function getLogLevel(line) {
  const upper = line.toUpperCase();
  if (upper.includes('ERROR') || upper.includes('CRITICAL')) return 'error';
  if (upper.includes('WARNING') || upper.includes('WARN'))   return 'warn';
  return 'info';
}
