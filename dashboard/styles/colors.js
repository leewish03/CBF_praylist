/**
 * colors.js
 * 대시보드에서 사용하는 공통 HSL 테마 색상 상수 정의
 */

export const colors = {
  primary:       'hsl(142, 35%, 28%)',     // 깊은 Forest Green
  primaryDark:   'hsl(142, 40%, 20%)',     // 더 어두운 Green
  primaryLight:  'hsl(142, 20%, 95%)',     // 매우 연한 Green 배경
  primaryMid:    'hsl(142, 25%, 45%)',     // 중간 Green
  success:       'hsl(95, 38%, 45%)',      // 성공 초록
  successLight:  'hsl(95, 40%, 92%)',
  danger:        'hsl(0, 75%, 60%)',       // 위험 빨강
  dangerLight:   'hsl(0, 70%, 95%)',
  warning:       'hsl(38, 90%, 50%)',      // 경고 노랑
  warningLight:  'hsl(38, 90%, 94%)',
  info:          'hsl(210, 70%, 52%)',     // 정보 파랑
  infoLight:     'hsl(210, 80%, 95%)',
  idle:          'hsl(220, 10%, 55%)',     // IDLE 회색
  idleLight:     'hsl(220, 15%, 93%)',
  running:       'hsl(210, 70%, 52%)',     // RUNNING 파랑
  runningLight:  'hsl(210, 80%, 93%)',
  bgConsole:     'hsl(210, 15%, 15%)',     // 콘솔 배경
  consoleText:   'hsl(120, 100%, 75%)',    // 콘솔 텍스트 (녹색)
  consoleGray:   'hsl(220, 10%, 65%)',     // 콘솔 보조 텍스트
  bg:            'hsl(142, 10%, 97%)',     // 전체 배경
  cardBg:        'hsl(0, 0%, 100%)',       // 카드 배경
  border:        'hsl(142, 15%, 88%)',     // 테두리
  textPrimary:   'hsl(220, 15%, 15%)',     // 주요 텍스트
  textSecondary: 'hsl(220, 10%, 50%)',     // 보조 텍스트
  textMuted:     'hsl(220, 10%, 70%)',     // 흐린 텍스트
};

export default colors;
