/**
 * colors.js
 * 대시보드에서 사용하는 공통 HSL 테마 색상 상수 정의
 * shadcn/ui의 HSL 컬러 시스템 및 테마 디자인을 차용하여 구성했습니다.
 */

export const colors = {
  // shadcn/ui 시그니처 Forest Green HSL 테마
  primary:       'hsl(142, 72%, 29%)',     // 깊은 Forest Green (Primary)
  primaryDark:   'hsl(142, 72%, 20%)',     // 어두운 Green
  primaryLight:  'hsl(142, 50%, 97.5%)',   // 매우 연한 Green 배경 (Primary Muted)
  primaryMid:    'hsl(142, 45%, 45%)',     // 중간 Green
  
  success:       'hsl(142, 72%, 29%)',      // 성공 초록 (Primary와 통합)
  successLight:  'hsl(142, 50%, 97.5%)',
  
  danger:        'hsl(0, 84.2%, 60.2%)',   // 위험 빨강 (Destructive)
  dangerLight:   'hsl(0, 100%, 97.5%)',
  
  warning:       'hsl(38, 92%, 50%)',      // 경고 노랑
  warningLight:  'hsl(38, 100%, 97.5%)',
  
  info:          'hsl(221.2, 83.2%, 53.3%)',// 정보 파랑
  infoLight:     'hsl(221.2, 100%, 97.5%)',
  
  idle:          'hsl(240, 3.8%, 46.1%)',  // IDLE 회색 (Muted Foreground)
  idleLight:     'hsl(240, 4.8%, 95.9%)',  // IDLE 연한 회색 (Muted)
  
  running:       'hsl(221.2, 83.2%, 53.3%)',// RUNNING 파랑
  runningLight:  'hsl(221.2, 100%, 97.5%)',
  
  bgConsole:     'hsl(240, 10%, 3.9%)',    // 콘솔 배경 (Shadcn Dark)
  consoleText:   'hsl(142, 70%, 75%)',     // 콘솔 텍스트 (녹색)
  consoleGray:   'hsl(240, 5%, 64.9%)',    // 콘솔 보조 텍스트
  
  bg:            'hsl(240, 5%, 98%)',      // 전체 배경 (Shadcn Bg)
  cardBg:        'hsl(0, 0%, 100%)',       // 카드 배경 (Shadcn Card)
  border:        'hsl(240, 5.9%, 90%)',    // 테두리 (Shadcn Border)
  textPrimary:   'hsl(240, 10%, 3.9%)',    // 주요 텍스트 (Shadcn Foreground)
  textSecondary: 'hsl(240, 3.8%, 46.1%)',  // 보조 텍스트 (Shadcn Muted Foreground)
  textMuted:     'hsl(240, 3.8%, 65%)',    // 흐린 텍스트
};

export default colors;
