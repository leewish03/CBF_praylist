/**
 * PrayerDashboard.jsx  – CBF 기도제목 자동화 V2 대시보드 (전면 재작성)
 *
 * ─ 주요 기능 ─
 * 1. 일반 사용자 PIN 인증 오버레이 (비밀번호: '0691', sessionStorage)
 * 2. 관리자 모드 인증 카드  (비밀번호: '1217', URL에 '/admin' 포함 시 활성)
 * 3. shadcn UI 스타일 탭 스위처 (사용자 2탭 / 관리자 3탭)
 * 4. 개별 기도제목 – 담당자 필터(selectedManager) localStorage 캐싱 + 무결성 검증
 * 5. Forest Green 컬러 시스템, micro-animation, 3s/5s 폴링
 *
 * ─ API 경로 (모두 /api 접두사) ─
 *   GET  /api/status   – 파이프라인 상태 (notion_page_id 포함)
 *   POST /api/trigger  – 파이프라인 실행 (202 Accepted)
 *   GET  /api/config   – 설정 데이터 (공통 기도제목 + 담당자 배정)
 *   GET  /api/prayers  – 기도제목 데이터 (prayers_by_requester + assignments)
 *   GET  /api/logs     – 로그 파일 마지막 N줄
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react';
import styled, { keyframes, createGlobalStyle, css } from 'styled-components';

// ─────────────────────────────────────────────
// 상수 정의
// ─────────────────────────────────────────────
const PIN_USER          = '0691';        // 일반 사용자 PIN
const PIN_ADMIN         = '1217';        // 관리자 PIN
const SESSION_USER_KEY  = 'cbf_user_auth';   // sessionStorage 키 (일반)
const SESSION_ADMIN_KEY = 'cbf_admin_auth';  // sessionStorage 키 (관리자)
const SESSION_TOKEN_KEY = 'cbf_auth_token';  // JWT 토큰 키
const SESSION_ROLE_KEY  = 'cbf_auth_role';   // 역할 키
const LS_MANAGER_KEY    = 'cbf_selected_manager'; // localStorage 키 (필터)
const NOTION_FALLBACK   = '1c50f7e0cd5f8025bb78c5c839f205f0';

/** 가상 키패드 레이아웃 (3 × 4) */
const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['C', '0', '⌫'],
];

// ─────────────────────────────────────────────
// 컬러 시스템 (Forest Green + shadcn 토큰)
// ─────────────────────────────────────────────
const c = {
  // ── Forest Green 팔레트 ──
  primary:       'hsl(142, 35%, 28%)',
  primaryDark:   'hsl(142, 40%, 20%)',
  primaryLight:  'hsl(142, 20%, 95%)',
  primaryMid:    'hsl(142, 25%, 45%)',

  // ── 시멘틱 ──
  success:       'hsl(95, 38%, 45%)',
  successLight:  'hsl(95, 40%, 92%)',
  danger:        'hsl(0, 75%, 60%)',
  dangerLight:   'hsl(0, 70%, 95%)',
  warning:       'hsl(38, 90%, 50%)',
  warningLight:  'hsl(38, 90%, 94%)',
  info:          'hsl(210, 70%, 52%)',
  infoLight:     'hsl(210, 80%, 95%)',

  // ── 상태 ──
  idle:          'hsl(220, 10%, 55%)',
  idleLight:     'hsl(220, 15%, 93%)',
  running:       'hsl(210, 70%, 52%)',
  runningLight:  'hsl(210, 80%, 93%)',

  // ── shadcn 토큰 ──
  border:        'hsl(240, 5.9%, 90%)',   // 얇은 회색 테두리
  shadow:        'rgba(0, 0, 0, 0.05)',   // 미세 하단 그림자

  // ── 레이아웃 ──
  bg:            'hsl(142, 8%, 97%)',
  cardBg:        'hsl(0, 0%, 100%)',

  // ── 텍스트 ──
  textPrimary:   'hsl(220, 15%, 15%)',
  textSecondary: 'hsl(220, 10%, 50%)',
  textMuted:     'hsl(220, 10%, 70%)',

  // ── 콘솔 ──
  bgConsole:     'hsl(210, 15%, 15%)',
  consoleText:   'hsl(120, 100%, 75%)',
  consoleGray:   'hsl(220, 10%, 65%)',

  // ── PIN 오버레이 ──
  overlayBg:     'hsla(142, 30%, 10%, 0.75)',
};

// ─────────────────────────────────────────────
// 애니메이션
// ─────────────────────────────────────────────
const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;
const pulse = keyframes`
  0%, 100% { opacity: 1;   transform: scale(1); }
  50%       { opacity: 0.7; transform: scale(1.02); }
`;
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
`;
const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;
const slideIn = keyframes`
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
`;
const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  15%       { transform: translateX(-8px); }
  30%       { transform: translateX(8px); }
  45%       { transform: translateX(-6px); }
  60%       { transform: translateX(6px); }
  75%       { transform: translateX(-4px); }
  90%       { transform: translateX(4px); }
`;
const fadeOut = keyframes`
  from { opacity: 1; }
  to   { opacity: 0; transform: scale(1.03); }
`;
const tabFadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─────────────────────────────────────────────
// 글로벌 스타일
// ─────────────────────────────────────────────
const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: ${c.bg};
    color: ${c.textPrimary};
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  button { font-family: inherit; }
`;

// ─────────────────────────────────────────────
// 공통 카드 믹스인
// ─────────────────────────────────────────────
const cardStyle = css`
  background: ${c.cardBg};
  border: 1px solid ${c.border};
  box-shadow: 0 1px 2px 0 ${c.shadow};
  border-radius: 14px;
  overflow: hidden;
`;

// ─────────────────────────────────────────────
// PIN 오버레이 styled-components
// ─────────────────────────────────────────────
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${c.overlayBg};
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: ${({ fadeout }) => fadeout === 'true' ? css`${fadeOut} 0.5s ease forwards` : css`${fadeIn} 0.4s ease`};
`;

const PinCard = styled.div`
  background: ${c.cardBg};
  border: 1px solid ${c.border};
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  padding: 36px 32px 28px;
  width: 320px;
  max-width: calc(100vw - 32px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  animation: ${({ shaking }) => shaking === 'true' ? css`${shake} 0.4s ease` : 'none'};
`;

const PinTitle = styled.div`
  text-align: center;

  h2 {
    font-size: 1.15rem;
    font-weight: 700;
    color: ${c.primary};
    margin-bottom: 4px;
  }

  p {
    font-size: 0.78rem;
    color: ${c.textSecondary};
  }
`;

const PinDisplay = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
`;

const PinDot = styled.span`
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: ${({ filled }) => filled ? c.primary : c.border};
  transition: background 0.15s, transform 0.15s;
  transform: ${({ filled }) => filled ? 'scale(1.15)' : 'scale(1)'};
`;

const PinError = styled.p`
  font-size: 0.78rem;
  color: ${c.danger};
  text-align: center;
  min-height: 18px;
  font-weight: 500;
`;

const KeypadGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  width: 100%;
`;

const KeypadBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 52px;
  border-radius: 10px;
  font-size: ${({ isSpecial }) => isSpecial ? '0.8rem' : '1.2rem'};
  font-weight: ${({ isSpecial }) => isSpecial ? '500' : '600'};
  cursor: pointer;
  transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
  border: 1px solid ${c.border};
  box-shadow: 0 1px 2px 0 ${c.shadow};
  user-select: none;
  -webkit-tap-highlight-color: transparent;

  /* 숫자 버튼 */
  background: ${({ variant }) =>
    variant === 'clear' ? c.dangerLight :
    variant === 'back'  ? c.warningLight :
    c.bg};
  color: ${({ variant }) =>
    variant === 'clear' ? c.danger :
    variant === 'back'  ? c.warning :
    c.textPrimary};

  &:hover:not(:disabled) {
    background: ${({ variant }) =>
      variant === 'clear' ? 'hsl(0, 70%, 90%)' :
      variant === 'back'  ? 'hsl(38, 90%, 88%)' :
      c.primaryLight};
    color: ${({ variant }) =>
      variant === 'clear' ? c.danger :
      variant === 'back'  ? c.warning :
      c.primary};
  }

  &:active:not(:disabled) {
    transform: scale(0.96);
    box-shadow: none;
  }
`;

// ─────────────────────────────────────────────
// 레이아웃
// ─────────────────────────────────────────────
const Wrapper = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 20px 56px;

  @media (max-width: 768px) {
    padding: 14px 12px 48px;
  }
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
  padding: 18px 24px;
  background: ${c.primary};
  border-radius: 16px;
  box-shadow: 0 4px 20px hsla(142, 35%, 28%, 0.25);
  animation: ${fadeIn} 0.4s ease;

  @media (max-width: 768px) {
    padding: 14px 16px;
    border-radius: 12px;
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const HeaderEmoji = styled.span`
  font-size: 2rem;
`;

const HeaderText = styled.div`
  h1 {
    font-size: 1.2rem;
    font-weight: 700;
    color: #fff;
    line-height: 1.3;
    
    @media (max-width: 768px) { font-size: 1rem; }
  }
  p {
    font-size: 0.75rem;
    color: hsla(0, 0%, 100%, 0.72);
    margin-top: 2px;
  }
`;

const NotionLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: hsla(0, 0%, 100%, 0.15);
  color: #fff;
  border: 1px solid hsla(0, 0%, 100%, 0.3);
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.2s, border-color 0.2s;
  white-space: nowrap;

  &:hover {
    background: hsla(0, 0%, 100%, 0.25);
    border-color: hsla(0, 0%, 100%, 0.5);
  }
  &:active { transform: scale(0.96); }
`;

// ─────────────────────────────────────────────
// 탭 스위처 (shadcn UI 스타일)
// ─────────────────────────────────────────────
const TabsContainer = styled.div`
  margin-bottom: 20px;
  animation: ${fadeIn} 0.35s ease;
`;

const TabsList = styled.div`
  display: inline-flex;
  background: hsl(220, 10%, 93%);
  border: 1px solid ${c.border};
  border-radius: 10px;
  padding: 4px;
  gap: 2px;
  flex-wrap: wrap;
`;

const TabsTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 7px;
  font-size: 0.83rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  outline: none;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s, transform 0.1s;
  white-space: nowrap;
  user-select: none;
  -webkit-tap-highlight-color: transparent;

  ${({ active }) => active ? css`
    background: ${c.primary};
    color: #fff;
    box-shadow: 0 2px 8px hsla(142, 35%, 28%, 0.25);
  ` : css`
    background: transparent;
    color: ${c.textSecondary};

    &:hover { background: hsla(0,0%,100%,0.6); color: ${c.textPrimary}; }
  `}

  &:active { transform: scale(0.96); }
`;

const TabsContent = styled.div`
  display: ${({ active }) => active ? 'block' : 'none'};
  animation: ${tabFadeIn} 0.3s ease;
`;

// ─────────────────────────────────────────────
// 상태 바
// ─────────────────────────────────────────────
const StatusCard = styled.div`
  ${cardStyle}
  margin-bottom: 16px;
  animation: ${fadeIn} 0.35s ease;
`;

const StatusInner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 20px;
`;

const StatusLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const statusMap = {
  IDLE:    { bg: c.idleLight,    fg: c.idle,    label: '대기 중' },
  RUNNING: { bg: c.runningLight, fg: c.running, label: '실행 중' },
  SUCCESS: { bg: c.successLight, fg: c.success, label: '완료' },
  ERROR:   { bg: c.dangerLight,  fg: c.danger,  label: '오류' },
};

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  transition: all 0.3s;
  background: ${({ s }) => statusMap[s]?.bg || c.idleLight};
  color:      ${({ s }) => statusMap[s]?.fg || c.idle};
  border: 1px solid ${({ s }) => (statusMap[s]?.fg || c.idle) + '33'};
`;

const Spinner = styled.span`
  display: inline-block;
  width: 9px;
  height: 9px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: ${spin} 0.65s linear infinite;
`;

const StatusDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
`;

const SmallText = styled.p`
  font-size: 0.78rem;
  color: ${c.textSecondary};
`;

const TriggerBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  background: ${({ $disabled }) => $disabled ? c.idleLight : c.primary};
  color: ${({ $disabled }) => $disabled ? c.idle : '#fff'};
  border: none;
  border-radius: 9px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: ${({ $disabled }) => $disabled ? 'not-allowed' : 'pointer'};
  transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
  box-shadow: ${({ $disabled }) => $disabled ? 'none' : `0 3px 10px hsla(142, 35%, 28%, 0.3)`};

  &:hover:not([disabled]) {
    background: ${c.primaryDark};
    transform: translateY(-1px);
    box-shadow: 0 5px 15px hsla(142, 35%, 28%, 0.35);
  }
  &:active:not([disabled]) {
    transform: scale(0.96);
    box-shadow: none;
  }
`;

// ─────────────────────────────────────────────
// 경고 배너
// ─────────────────────────────────────────────
const AlertBanner = styled.div`
  display: ${({ $show }) => $show ? 'flex' : 'none'};
  align-items: flex-start;
  gap: 12px;
  padding: 14px 18px;
  background: ${c.dangerLight};
  border: 1px solid ${c.danger}55;
  border-left: 4px solid ${c.danger};
  border-radius: 10px;
  margin-bottom: 16px;
  animation: ${pulse} 2.5s ease-in-out infinite, ${fadeIn} 0.35s ease;
`;

// ─────────────────────────────────────────────
// 공통 카드
// ─────────────────────────────────────────────
const Card = styled.div`
  ${cardStyle}
  animation: ${fadeIn} 0.35s ease;
`;

const CardHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid ${c.border};
  background: ${c.primaryLight};

  h3 {
    font-size: 0.9rem;
    font-weight: 600;
    color: ${c.primary};
  }
`;

const CardBody = styled.div`
  padding: 18px;
`;

const SourceTag = styled.span`
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 500;
  background: ${({ $sheet }) => $sheet ? c.successLight : c.warningLight};
  color:      ${({ $sheet }) => $sheet ? c.success : c.warning};
  border: 1px solid ${({ $sheet }) => $sheet ? c.success + '44' : c.warning + '44'};
`;

// ─────────────────────────────────────────────
// 2열 그리드
// ─────────────────────────────────────────────
const TwoCol = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @media (max-width: 768px) { grid-template-columns: 1fr; }
`;

// ─────────────────────────────────────────────
// 공통 기도제목
// ─────────────────────────────────────────────
const PrayerList = styled.ol`
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const PrayerItem = styled.li`
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  background: ${c.primaryLight};
  border-left: 3px solid ${c.primary};
  border-radius: 8px;
  animation: ${slideIn} 0.3s ease both;
  animation-delay: ${({ $i }) => $i * 0.05}s;
`;

const PNum = styled.span`
  font-size: 0.72rem;
  font-weight: 700;
  color: ${c.primary};
  min-width: 16px;
  padding-top: 2px;
`;

const PText = styled.p`
  font-size: 0.82rem;
  line-height: 1.65;
  white-space: pre-line;
  color: ${c.textPrimary};
`;

// ─────────────────────────────────────────────
// 담당자 배정 테이블
// ─────────────────────────────────────────────
const AssignRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: ${c.bg};
  border: 1px solid ${c.border};
  border-radius: 8px;
  transition: box-shadow 0.2s;
  animation: ${slideIn} 0.3s ease both;
  animation-delay: ${({ $i }) => $i * 0.04}s;

  &:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
`;

const ManagerName = styled.span`
  font-size: 0.84rem;
  font-weight: 600;
  color: ${c.primary};
  min-width: 54px;
  padding-top: 2px;
`;

const Tags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
`;

const Tag = styled.span`
  padding: 2px 8px;
  background: ${c.primaryLight};
  color: ${c.primaryDark};
  border: 1px solid ${c.border};
  border-radius: 12px;
  font-size: 0.73rem;
  font-weight: 500;
`;

// ─────────────────────────────────────────────
// 개별 기도제목 – 담당자 필터
// ─────────────────────────────────────────────
const FilterBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
`;

const FilterBtn = styled.button`
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid ${({ $active }) => $active ? c.primary : c.border};
  background: ${({ $active }) => $active ? c.primary : c.cardBg};
  color: ${({ $active }) => $active ? '#fff' : c.textSecondary};
  transition: all 0.15s;

  &:hover:not([disabled]) {
    border-color: ${c.primary};
    color: ${({ $active }) => $active ? '#fff' : c.primary};
  }
  &:active { transform: scale(0.96); }
`;

// ─────────────────────────────────────────────
// 개별 기도제목 카드
// ─────────────────────────────────────────────
const PrayerCardGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const PrayerCardWrap = styled.div`
  ${cardStyle}
  padding: 16px 18px;
  animation: ${fadeInUp} 0.3s ease both;
  animation-delay: ${({ $i }) => Math.min($i * 0.03, 0.3)}s;
`;

const PrayerCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
`;

const PrayerTarget = styled.h4`
  font-size: 0.95rem;
  font-weight: 700;
  color: ${c.textPrimary};
`;

const PrayerMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const MetaBadge = styled.span`
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.72rem;
  font-weight: 500;
  background: ${c.primaryLight};
  color: ${c.primaryMid};
  border: 1px solid ${c.border};
`;

const ManagerBadge = styled.span`
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.72rem;
  font-weight: 600;
  background: ${c.primary};
  color: #fff;
`;

const PrayerContentBox = styled.div`
  background: ${c.bg};
  border: 1px solid ${c.border};
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 0.82rem;
  line-height: 1.7;
  color: ${c.textPrimary};
  white-space: pre-line;
`;

const PrayerInfoRow = styled.p`
  font-size: 0.78rem;
  color: ${c.textSecondary};
  margin-bottom: 6px;
`;

// ─────────────────────────────────────────────
// 콘솔 패널
// ─────────────────────────────────────────────
const ConsoleWrap = styled.div`
  ${cardStyle}
`;

const ConsoleHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: hsl(210, 15%, 20%);
  border-bottom: 1px solid hsl(210, 15%, 25%);

  h3 {
    font-size: 0.82rem;
    font-weight: 600;
    color: ${c.consoleGray};
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;

const ConsoleDot = styled.span`
  width: 9px; height: 9px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  display: inline-block;
`;

const ConsoleBody = styled.div`
  background: ${c.bgConsole};
  height: 280px;
  overflow-y: auto;
  padding: 12px 16px;
  font-family: 'Courier New', monospace;

  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-track { background: hsl(210, 15%, 20%); }
  &::-webkit-scrollbar-thumb { background: hsl(210, 15%, 35%); border-radius: 3px; }
`;

const LogLine = styled.p`
  font-size: 0.74rem;
  line-height: 1.7;
  color: ${({ $level }) =>
    $level === 'error' ? 'hsl(0, 80%, 70%)' :
    $level === 'warn'  ? 'hsl(38, 90%, 70%)' :
    c.consoleText};
  white-space: pre-wrap;
  word-break: break-all;
`;

const AdminShortcuts = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
  animation: ${fadeIn} 0.35s ease;
`;

const ShortcutLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 9px;
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
  border: 1px solid ${({ $border }) => $border};
  background: ${({ $bg }) => $bg};
  color: ${({ $color }) => $color};
  box-shadow: 0 1px 2px 0 ${c.shadow};

  &:hover {
    background: ${({ $hoverBg }) => $hoverBg};
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  }
  &:active {
    transform: scale(0.96);
  }
`;

const DeleteTagBtn = styled.button`
  border: none;
  background: transparent;
  color: ${c.textMuted};
  cursor: pointer;
  font-size: 0.72rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 2px;
  border-radius: 50%;
  margin-left: 4px;
  transition: all 0.15s;

  &:hover {
    color: ${c.danger};
    background: ${c.dangerLight};
  }
`;

const QuickAddForm = styled.form`
  display: flex;
  gap: 6px;
  align-items: center;
  margin-left: auto;
  
  @media (max-width: 480px) {
    width: 100%;
    margin-top: 6px;
  }
`;

const MiniInput = styled.input`
  border: 1px solid ${c.border};
  background: ${c.cardBg};
  color: ${c.textPrimary};
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.75rem;
  outline: none;
  width: 90px;
  transition: border-color 0.15s;

  &:focus {
    border-color: ${c.primary};
  }

  @media (max-width: 480px) {
    flex-grow: 1;
  }
`;

const MiniButton = styled.button`
  border: 1px solid ${c.border};
  background: ${c.bg};
  color: ${c.textPrimary};
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${c.primary};
    border-color: ${c.primary};
    color: #fff;
  }
`;

const UnmappedSection = styled.div`
  background: ${c.dangerLight}66;
  border: 1px solid ${c.danger}22;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  animation: ${fadeIn} 0.3s ease;
`;

const UnmappedTitle = styled.h4`
  font-size: 0.78rem;
  font-weight: 600;
  color: ${c.danger};
  margin-bottom: 8px;
`;

const UnmappedGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const UnmappedRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 10px;
  background: ${c.cardBg};
  border: 1px solid ${c.border};
  border-radius: 6px;
  flex-wrap: wrap;
`;

const UnmappedName = styled.span`
  font-size: 0.75rem;
  font-weight: 600;
  color: ${c.textPrimary};
`;

const SelectBox = styled.select`
  border: 1px solid ${c.border};
  border-radius: 6px;
  padding: 3px 6px;
  font-size: 0.72rem;
  outline: none;
  background: ${c.cardBg};
  color: ${c.textPrimary};
`;

const ActionFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid ${c.border};
  background: ${c.bg};
  align-items: center;
  border-bottom-left-radius: 14px;
  border-bottom-right-radius: 14px;
`;

const SaveButton = styled.button`
  border: 1px solid ${c.primary};
  background: ${c.primary};
  color: #fff;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 2px 0 ${c.shadow};

  &:hover:not(:disabled) {
    background: ${c.primaryDark};
    border-color: ${c.primaryDark};
  }

  &:disabled {
    background: ${c.idleLight};
    border-color: ${c.border};
    color: ${c.idle};
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const ResetButton = styled.button`
  border: 1px solid ${c.border};
  background: ${c.cardBg};
  color: ${c.textSecondary};
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: ${c.bg};
    color: ${c.textPrimary};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ToastMessage = styled.div`
  font-size: 0.75rem;
  color: ${({ type }) => type === 'success' ? c.success : c.danger};
  font-weight: 600;
  margin-right: auto;
`;

// ─────────────────────────────────────────────
// 스켈레톤 / 에러 / 빈 상태
// ─────────────────────────────────────────────
const Skeleton = styled.div`
  height: ${({ $h }) => $h || '14px'};
  width: ${({ $w }) => $w || '100%'};
  background: linear-gradient(90deg, hsl(220,10%,90%) 25%, hsl(220,10%,95%) 50%, hsl(220,10%,90%) 75%);
  background-size: 200% 100%;
  border-radius: 6px;
  margin-bottom: 8px;
  animation: shimmer 1.5s infinite;
  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;

const ErrMsg = styled.p`
  font-size: 0.8rem;
  color: ${c.danger};
  background: ${c.dangerLight};
  border: 1px solid ${c.danger}44;
  border-radius: 8px;
  padding: 10px 12px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 32px 0;
  color: ${c.textMuted};
  font-size: 0.82rem;
`;

// ─────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  } catch { return iso; }
}

function logLevel(line) {
  const u = line.toUpperCase();
  if (u.includes('ERROR') || u.includes('CRITICAL')) return 'error';
  if (u.includes('WARNING') || u.includes('WARN'))   return 'warn';
  return 'info';
}

// ─────────────────────────────────────────────
// 가상 키패드 컴포넌트 (재사용)
// ─────────────────────────────────────────────
function VirtualKeypad({ onKey }) {
  return (
    <KeypadGrid>
      {KEYPAD_ROWS.flat().map((key) => {
        const variant =
          key === 'C'  ? 'clear' :
          key === '⌫' ? 'back'  : 'num';
        return (
          <KeypadBtn
            key={key}
            variant={variant}
            isSpecial={variant !== 'num'}
            onClick={() => onKey(key)}
          >
            {key}
          </KeypadBtn>
        );
      })}
    </KeypadGrid>
  );
}

// ─────────────────────────────────────────────
// PIN 오버레이 컴포넌트 (일반 / 관리자 공용)
// ─────────────────────────────────────────────
function PinOverlay({ title, subtitle, pinLength = 4, onSuccess, adminMode }) {
  const [buf, setBuf]         = useState('');
  const [error, setError]     = useState('');
  const [shaking, setShaking] = useState(false);
  const [fadeout, setFadeout] = useState(false);
  const inputRef              = useRef(null);

  /** 버퍼에 키 처리 */
  const handleKey = useCallback((key) => {
    if (shaking || fadeout) return;

    setBuf(prev => {
      if (key === 'C')  return '';
      if (key === '⌫') return prev.slice(0, -1);
      if (prev.length >= pinLength) return prev;

      const next = prev + key;

      // 4자리 채워지면 자동 검증
      if (next.length === pinLength) {
        setTimeout(() => verify(next), 0);
      }
      return next;
    });
    setError('');
  }, [shaking, fadeout, pinLength]);

  /** PIN 검증 */
  async function verify(value) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: value })
      });
      const data = await response.json();

      if (response.ok && data.token) {
        // ── 인증 성공: 페이드 아웃 후 콜백 ──
        setFadeout(true);
        setTimeout(() => onSuccess(data.token, data.role), 500);
      } else {
        // ── 인증 실패: 흔들림 + 에러 + 버퍼 초기화 ──
        setShaking(true);
        setError(data.detail || '비밀번호가 올바르지 않습니다.');
        setBuf('');
        setTimeout(() => setShaking(false), 420);
      }
    } catch (e) {
      console.error(e);
      setShaking(true);
      setError('서버와 통신하는 중 오류가 발생했습니다.');
      setBuf('');
      setTimeout(() => setShaking(false), 420);
    }
  }

  /** 물리 키보드 지원 */
  useEffect(() => {
    function onKeydown(e) {
      if (e.key >= '0' && e.key <= '9') { handleKey(e.key); return; }
      if (e.key === 'Backspace')          { handleKey('⌫'); return; }
      if (e.key === 'Escape')             { handleKey('C'); }
    }
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [handleKey]);

  return (
    <Overlay fadeout={fadeout.toString()}>
      <PinCard shaking={shaking.toString()}>
        {/* 아이콘 */}
        <div style={{ fontSize: '2.4rem' }}>
          {adminMode ? '🔐' : '🙏'}
        </div>

        {/* 제목 */}
        <PinTitle>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </PinTitle>

        {/* PIN 표시 (마스킹) */}
        <PinDisplay>
          {Array.from({ length: pinLength }).map((_, i) => (
            <PinDot key={i} filled={i < buf.length} />
          ))}
        </PinDisplay>

        {/* 숨겨진 읽기 전용 input (모바일 기본 키보드 차단) */}
        <input
          ref={inputRef}
          type="text"
          readOnly
          value={'●'.repeat(buf.length)}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
          aria-label="PIN 입력창"
        />

        {/* 에러 메시지 */}
        <PinError>{error}</PinError>

        {/* 가상 키패드 */}
        <VirtualKeypad onKey={handleKey} />
      </PinCard>
    </Overlay>
  );
}

// ─────────────────────────────────────────────
// 개별 기도제목 탭 콘텐츠
// ─────────────────────────────────────────────
function IndividualPrayersTab({ prayersData, assignments, selectedManager, onSelectManager }) {
  if (!prayersData) return <Skeleton $h="80px" />;

  const prayersByRequester = prayersData.prayers_by_requester || {};
  const managerNames = Object.keys(assignments);

  // 역방향 매핑: 제출자 → 담당자
  const submitterToManager = useMemo(() => {
    const map = {};
    Object.entries(assignments).forEach(([mgr, assignees]) => {
      assignees.forEach(a => { map[a] = mgr; });
    });
    return map;
  }, [assignments]);

  // 전체 기도제목 평탄화 (각 기도에 manager 필드 추가)
  const allPrayers = useMemo(() => {
    const result = [];
    Object.entries(prayersByRequester).forEach(([requester, prayers]) => {
      const mgr = submitterToManager[requester] || '미배정';
      prayers.forEach(p => result.push({ ...p, _manager: mgr }));
    });
    return result;
  }, [prayersByRequester, submitterToManager]);

  // 필터 적용
  const filtered = useMemo(() => {
    if (selectedManager === 'ALL') return allPrayers;
    if (selectedManager === '미배정') return allPrayers.filter(p => p._manager === '미배정');
    return allPrayers.filter(p => p._manager === selectedManager);
  }, [allPrayers, selectedManager]);

  const unmappedCount = allPrayers.filter(p => p._manager === '미배정').length;

  return (
    <>
      {/* 담당자 필터 버튼 */}
      <FilterBar>
        {['ALL', ...managerNames, ...(unmappedCount > 0 ? ['미배정'] : [])].map(name => (
          <FilterBtn
            key={name}
            $active={selectedManager === name}
            onClick={() => onSelectManager(name)}
          >
            {name === 'ALL' ? '전체' : name}
            {name === '미배정' && ` (${unmappedCount})`}
          </FilterBtn>
        ))}
      </FilterBar>

      {/* 기도제목 카드 목록 */}
      {filtered.length === 0 ? (
        <EmptyState>
          {selectedManager === 'ALL'
            ? '제출된 기도제목이 없습니다.'
            : `'${selectedManager}' 담당자의 기도제목이 없습니다.`}
        </EmptyState>
      ) : (
        <PrayerCardGrid>
          {filtered.map((prayer, i) => (
            <PrayerCardWrap key={i} $i={i}>
              <PrayerCardHeader>
                <PrayerTarget>
                  🙏 {prayer.target_name || prayer.name}
                </PrayerTarget>
                <PrayerMeta>
                  {prayer.gender && <MetaBadge>{prayer.gender}</MetaBadge>}
                  {prayer.age && <MetaBadge>{prayer.age}</MetaBadge>}
                  {prayer._manager && <ManagerBadge>{prayer._manager}</ManagerBadge>}
                </PrayerMeta>
              </PrayerCardHeader>

              <PrayerInfoRow>
                👤 제출자: <strong>{prayer.name}</strong>
                {prayer.relationship && `  ·  관계: ${prayer.relationship}`}
              </PrayerInfoRow>

              <PrayerContentBox>
                {prayer.prayer_content || '(내용 없음)'}
              </PrayerContentBox>
            </PrayerCardWrap>
          ))}
        </PrayerCardGrid>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────
export default function PrayerDashboard() {
  // ── 커스텀 라우팅 상태 ──
  const [currentPath, setCurrentPath] = useState(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const isAdmin = currentPath.includes('/admin');

  // ── 인증 상태 (메모리 상태 보관 -> 새로고침 시 즉시 초기화되어 재로그인 요구) ──
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);

  const isUserAuth = !!token && (role === 'ROLE_USER' || role === 'ROLE_ADMIN');
  const isAdminAuth = !!token && role === 'ROLE_ADMIN';

  // ── 커스텀 라우터 이동 헬퍼 ──
  const navigate = useCallback((path) => {
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', path);
      setCurrentPath(path);
      // 화면 전환 시 최상단으로 스크롤
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // 브라우저 뒤로가기/앞으로가기 감지
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ── 탭 상태 (경로 변경 시 디폴트 탭 자동 갱신) ──
  const [activeTab, setActiveTab] = useState(isAdmin ? 'settings' : 'common');
  useEffect(() => {
    setActiveTab(isAdmin ? 'settings' : 'common');
  }, [isAdmin]);

  // ── 담당자 필터 (localStorage 캐싱) ──
  const [selectedManager, _setSelectedManager] = useState(
    typeof localStorage !== 'undefined'
      ? (localStorage.getItem(LS_MANAGER_KEY) || 'ALL')
      : 'ALL'
  );

  function setSelectedManager(name) {
    _setSelectedManager(name);
    try { localStorage.setItem(LS_MANAGER_KEY, name); } catch {}
  }

  // ── 데이터 상태 ──
  const [status,       setStatus]      = useState(null);
  const [prayersData,  setPrayersData] = useState(null);
  const [configData,   setConfigData]  = useState(null);
  const [logs,         setLogs]        = useState([]);
  const [isConfigLoad, setIsConfigLoad]= useState(true);
  const [isPrayLoad,   setIsPrayLoad]  = useState(true);

  // ── 오류 상태 ──
  const [statusErr,  setStatusErr]  = useState(null);
  const [configErr,  setConfigErr]  = useState(null);
  const [logsErr,    setLogsErr]    = useState(null);

  // ── 트리거 상태 ──
  const [triggering, setTriggering] = useState(false);
  const [trigMsg,    setTrigMsg]    = useState(null);

  const consoleRef = useRef(null);

  // ── 담당자 편집용 로컬 상태 ──
  const [editingAssignments, setEditingAssignments] = useState({});
  const [newAssigneeInputs, setNewAssigneeInputs] = useState({});
  const [unmappedSelections, setUnmappedSelections] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // 부모로부터 assignments 프롭스가 갱신될 때 로컬 상태 초기화
  useEffect(() => {
    if (configData?.assignments?.data) {
      const copy = {};
      Object.entries(configData.assignments.data).forEach(([k, v]) => {
        copy[k] = [...v];
      });
      setEditingAssignments(copy);
    }
  }, [configData]);

  // 토스트 메시지 5초 후 자동 제거
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // ── 편집 핸들러 ──
  const handleDeleteAssignee = useCallback((manager, name) => {
    setEditingAssignments(prev => ({
      ...prev,
      [manager]: (prev[manager] || []).filter(n => n !== name)
    }));
  }, []);

  const handleAddAssigneeSubmit = useCallback((manager, e) => {
    if (e) e.preventDefault();
    const name = newAssigneeInputs[manager]?.trim();
    if (!name) return;

    if (editingAssignments[manager]?.includes(name)) {
      alert('이미 배정된 이름입니다.');
      return;
    }

    setEditingAssignments(prev => ({
      ...prev,
      [manager]: [...(prev[manager] || []), name]
    }));

    setNewAssigneeInputs(prev => ({ ...prev, [manager]: '' }));
  }, [newAssigneeInputs, editingAssignments]);

  const handleQuickAssign = useCallback((requester) => {
    const targetManager = unmappedSelections[requester];
    if (!targetManager) {
      alert('담당자를 선택해주세요.');
      return;
    }

    setEditingAssignments(prev => ({
      ...prev,
      [targetManager]: [...(prev[targetManager] || []), requester]
    }));

    setUnmappedSelections(prev => {
      const copy = { ...prev };
      delete copy[requester];
      return copy;
    });
  }, [unmappedSelections]);

  const hasChanges = useCallback(() => {
    const original = configData?.assignments?.data;
    if (!original || !editingAssignments) return false;
    
    const origKeys = Object.keys(original);
    const editKeys = Object.keys(editingAssignments);
    if (origKeys.length !== editKeys.length) return true;

    for (let key of origKeys) {
      const origList = original[key] || [];
      const editList = editingAssignments[key] || [];
      if (origList.length !== editList.length) return true;
      
      const origSorted = [...origList].sort().join(',');
      const editSorted = [...editList].sort().join(',');
      if (origSorted !== editSorted) return true;
    }
    return false;
  }, [configData, editingAssignments]);

  const handleSaveAssignments = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    setToast(null);

    try {
      const res = await authenticatedFetch('/api/config/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: editingAssignments })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '저장 실패');

      setToast({ type: 'success', text: '✅ 구글 시트 배정표를 성공적으로 업데이트했습니다!' });
      
      // 데이터 강제 리프레시
      fetchConfig();
    } catch (err) {
      console.error('[Dashboard] Save assignments error:', err);
      setToast({ type: 'error', text: `❌ 저장 실패: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  }, [editingAssignments, isSaving, authenticatedFetch, fetchConfig]);

  const handleResetAssignments = useCallback(() => {
    if (!configData?.assignments?.data) return;
    const copy = {};
    Object.entries(configData.assignments.data).forEach(([k, v]) => {
      copy[k] = [...v];
    });
    setEditingAssignments(copy);
    setUnmappedSelections({});
    setToast(null);
  }, [configData]);

  // ─────────────────── 인증 만료 및 API 래퍼 ───────────────────
  const handleAuthExpiration = useCallback(() => {
    setToken(null);
    setRole(null);
    setPrayersData(null);
    setConfigData(null);
    setLogs([]);
    console.warn('[Dashboard] 세션 만료로 데이터 소거 및 로그인 화면 전환');
  }, []);

  const authenticatedFetch = useCallback(async (url, options = {}) => {
    const currentToken = token;
    const headers = {
      ...options.headers,
    };
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });
      if (response.status === 401) {
        handleAuthExpiration();
        throw new Error('인증 세션이 만료되었습니다. 다시 로그인해주세요.');
      }
      return response;
    } catch (error) {
      throw error;
    }
  }, [handleAuthExpiration, token]);

  // ─────────────────── API fetch 함수 ───────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/status');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStatus(await r.json());
      setStatusErr(null);
    } catch (e) {
      console.error('[Dashboard] status error:', e);
      setStatusErr('상태 조회 실패');
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    setIsConfigLoad(true);
    try {
      const r = await authenticatedFetch('/api/config');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setConfigData(await r.json());
      setConfigErr(null);
    } catch (e) {
      console.error('[Dashboard] config error:', e);
      setConfigErr('설정 데이터 조회 실패');
    } finally {
      setIsConfigLoad(false);
    }
  }, [authenticatedFetch]);

  const fetchPrayers = useCallback(async () => {
    setIsPrayLoad(true);
    try {
      const r = await authenticatedFetch('/api/prayers');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setPrayersData(await r.json());
    } catch (e) {
      console.error('[Dashboard] prayers error:', e);
    } finally {
      setIsPrayLoad(false);
    }
  }, [authenticatedFetch]);

  const fetchLogs = useCallback(async () => {
    try {
      const r = await authenticatedFetch('/api/logs?limit=100');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setLogs(d.lines || []);
      setLogsErr(null);
    } catch (e) {
      console.error('[Dashboard] logs error:', e);
      setLogsErr('로그 조회 실패');
    }
  }, [authenticatedFetch]);

  // 파이프라인 트리거
  const handleTrigger = useCallback(async () => {
    if (triggering || status?.status === 'RUNNING') return;
    setTriggering(true);
    setTrigMsg(null);
    try {
      const r = await authenticatedFetch('/api/trigger', { method: 'POST' });
      const d = await r.json();
      if (r.status === 409) {
        setTrigMsg({ type: 'warn', text: d.detail || '이미 실행 중입니다.' });
      } else if (!r.ok) {
        setTrigMsg({ type: 'error', text: d.detail || '요청 실패' });
      } else {
        setTrigMsg({ type: 'success', text: d.message || '파이프라인 실행이 시작되었습니다.' });
        setTimeout(fetchStatus, 800);
      }
    } catch (e) {
      setTrigMsg({ type: 'error', text: '요청 중 오류가 발생했습니다.' });
    } finally {
      setTriggering(false);
    }
  }, [triggering, status?.status, fetchStatus, authenticatedFetch]);

  // ─────────────────── 탭 변경 ───────────────────
  function changeTab(tab) {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ─────────────────── 폴링 & 초기 로드 ───────────────────
  useEffect(() => {
    fetchStatus();
    fetchConfig();
    fetchPrayers();
    fetchLogs();

    const si = setInterval(fetchStatus, 3000);
    const li = setInterval(fetchLogs, 5000);

    return () => { clearInterval(si); clearInterval(li); };
  }, [fetchStatus, fetchConfig, fetchPrayers, fetchLogs]);

  // ─────────────────── selectedManager 무결성 검사 ───────────────────
  useEffect(() => {
    if (!prayersData || !configData) return;

    const assignments = configData?.assignments?.data || {};
    const validManagers = new Set([
      'ALL',
      ...Object.keys(assignments),
      '미배정'
    ]);

    if (!validManagers.has(selectedManager)) {
      console.warn(`[Dashboard] 캐시된 담당자 '${selectedManager}' 가 배정표에 없음 → ALL로 복구`);
      setSelectedManager('ALL');
    }
  }, [prayersData, configData]);

  // ─────────────────── 콘솔 자동 스크롤 ───────────────────
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  // ─────────────────── 트리거 메시지 자동 소거 ───────────────────
  useEffect(() => {
    if (trigMsg) {
      const t = setTimeout(() => setTrigMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [trigMsg]);

  // ─────────────────── 파생 값 ───────────────────
  const curStatus     = status?.status || 'IDLE';
  const isRunning     = curStatus === 'RUNNING';
  const unmapped      = status?.unmapped_requesters || [];
  const notionPageId  = status?.notion_page_id || NOTION_FALLBACK;
  const notionPageUrl = `https://notion.so/${notionPageId.replace(/-/g, '')}`;

  const commonPrayers  = configData?.common_prayers?.data || [];
  const prayerSource   = configData?.common_prayers?.source;
  const assignments    = configData?.assignments?.data || {};
  const assignSource   = configData?.assignments?.source;

  // ─────────────────── 인증 오버레이 렌더링 ───────────────────
  /**
   * 관리자 모드: 관리자 PIN 카드만 표시 (일반 PIN 없음)
   * 일반 모드: 일반 PIN 오버레이
   */
  if (isAdmin && !isAdminAuth) {
    return (
      <>
        <GlobalStyle />
        <PinOverlay
          title="관리자 인증"
          subtitle="관리자 비밀번호를 입력하세요"
          adminMode
          onSuccess={(tok, rol) => {
            setToken(tok);
            setRole(rol);
          }}
        />
      </>
    );
  }

  if (!isAdmin && !isUserAuth) {
    return (
      <>
        <GlobalStyle />
        <PinOverlay
          title="CBF 기도제목 대시보드"
          subtitle="비밀번호 4자리를 입력하세요"
          onSuccess={(tok, rol) => {
            setToken(tok);
            setRole(rol);
            if (rol === 'ROLE_ADMIN') {
              navigate('/admin');
            }
          }}
        />
      </>
    );
  }

  // ─────────────────── 탭 정의 ───────────────────
  const userTabs = [
    { key: 'common',     label: '📋 공통 기도제목' },
    { key: 'individual', label: '🙏 개별 기도제목' },
  ];

  const adminTabs = [
    { key: 'settings', label: '👥 담당자 설정 및 관리' },
    { key: 'prayers',  label: '📋 개별 기도제목 현황' },
    { key: 'logs',     label: '💻 실시간 시스템 로그' },
  ];

  const tabs = isAdmin ? adminTabs : userTabs;

  // ─────────────────── 렌더 ───────────────────
  return (
    <>
      <GlobalStyle />
      <Wrapper>

        {/* ── 헤더 ── */}
        <Header>
          <HeaderLeft>
            <HeaderEmoji>🙏</HeaderEmoji>
            <HeaderText>
              <h1>CBF 기도제목 자동화 대시보드{isAdmin ? ' (관리자)' : ''}</h1>
              <p>Google Sheets → Notion 자동 동기화 파이프라인</p>
            </HeaderText>
          </HeaderLeft>
          {isAdmin ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <NotionLink href={notionPageUrl} target="_blank" rel="noopener noreferrer">
                📓 Notion 페이지
              </NotionLink>
              <NotionLink 
                href="#" 
                onClick={(e) => { e.preventDefault(); navigate('/'); }}
                style={{ background: 'hsla(0, 0%, 100%, 0.1)', cursor: 'pointer' }}
              >
                🚪 사용자 화면
              </NotionLink>
            </div>
          ) : (
            <NotionLink 
              href="#" 
              onClick={(e) => { e.preventDefault(); navigate('/admin'); }}
              style={{ background: 'hsla(0, 0%, 100%, 0.1)', cursor: 'pointer' }}
            >
              🔐 관리자 모드
            </NotionLink>
          )}
        </Header>

        {/* ── 탭 스위처 ── */}
        <TabsContainer>
          <TabsList>
            {tabs.map(t => (
              <TabsTrigger
                key={t.key}
                active={activeTab === t.key}
                onClick={() => changeTab(t.key)}
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </TabsContainer>

        {/* ────────────── 일반 사용자 탭 콘텐츠 ────────────── */}

        {/* 개별 기도제목 (default for user) */}
        {!isAdmin && (
          <TabsContent active={activeTab === 'individual'}>
            <Card>
              <CardHead>
                <span>🙏</span>
                <h3>개별 기도제목</h3>
                <SourceTag $sheet={prayersData?.source !== 'empty'} style={{ marginLeft: 'auto' }}>
                  {isPrayLoad ? '로딩 중...' : `총 ${Object.values(prayersData?.prayers_by_requester || {}).reduce((s, v) => s + v.length, 0)}개`}
                </SourceTag>
              </CardHead>
              <CardBody>
                {isPrayLoad ? (
                  <>
                    <Skeleton /><Skeleton $w="85%" /><Skeleton $w="70%" />
                  </>
                ) : (
                  <IndividualPrayersTab
                    prayersData={prayersData}
                    assignments={assignments}
                    selectedManager={selectedManager}
                    onSelectManager={setSelectedManager}
                  />
                )}
              </CardBody>
            </Card>
          </TabsContent>
        )}

        {/* 공통 기도제목 (user) */}
        {!isAdmin && (
          <TabsContent active={activeTab === 'common'}>
            <Card>
              <CardHead>
                <span>📋</span>
                <h3>공통 기도제목</h3>
                {prayerSource && (
                  <SourceTag $sheet={prayerSource === 'google_sheets'}>
                    {prayerSource === 'google_sheets' ? '🔗 시트' : '⚙️ 기본값'}
                  </SourceTag>
                )}
              </CardHead>
              <CardBody>
                {isConfigLoad ? (
                  <><Skeleton /><Skeleton $w="85%" /><Skeleton $w="70%" /></>
                ) : configErr ? (
                  <ErrMsg>❌ {configErr}</ErrMsg>
                ) : commonPrayers.length === 0 ? (
                  <EmptyState>공통 기도제목이 없습니다.</EmptyState>
                ) : (
                  <PrayerList>
                    {commonPrayers.map((p, i) => (
                      <PrayerItem key={i} $i={i}>
                        <PNum>{i + 1}.</PNum>
                        <PText>{p}</PText>
                      </PrayerItem>
                    ))}
                  </PrayerList>
                )}
              </CardBody>
            </Card>
          </TabsContent>
        )}

        {/* ────────────── 관리자 탭 콘텐츠 ────────────── */}

        {/* 담당자 설정 및 관리 (admin default) */}
        {isAdmin && (
          <TabsContent active={activeTab === 'settings'}>

            {/* 파이프라인 상태 카드 */}
            <StatusCard style={{ marginBottom: 16 }}>
              <StatusInner>
                <StatusLeft>
                  <StatusBadge s={curStatus}>
                    {isRunning ? <Spinner /> : <StatusDot />}
                    {statusMap[curStatus]?.label || curStatus}
                  </StatusBadge>
                  {status?.last_run && (
                    <SmallText>마지막 실행: {fmtDate(status.last_run)}</SmallText>
                  )}
                  {statusErr && (
                    <SmallText style={{ color: c.danger }}>⚠ {statusErr}</SmallText>
                  )}
                </StatusLeft>
                <TriggerBtn
                  $disabled={isRunning || triggering}
                  disabled={isRunning || triggering}
                  onClick={handleTrigger}
                >
                  {isRunning || triggering ? <Spinner /> : '▶'}
                  {isRunning ? '실행 중...' : triggering ? '요청 중...' : '동기화 시작'}
                </TriggerBtn>
              </StatusInner>
              {trigMsg && (
                <div style={{
                  padding: '0 20px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  color: trigMsg.type === 'success' ? c.success
                       : trigMsg.type === 'warn'    ? c.warning
                       : c.danger
                }}>
                  {trigMsg.type === 'success' ? '✅' : trigMsg.type === 'warn' ? '⚠️' : '❌'}
                  {' '}{trigMsg.text}
                </div>
              )}
            </StatusCard>

            {/* ── 관리자 구글 시트 바로가기 ── */}
            <AdminShortcuts>
              <ShortcutLink
                href="https://docs.google.com/spreadsheets/d/1Bvl8bKvXQezJA3diKZM3sd_WauWSEG7jjjh7w3e74VI/edit#gid=266289115"
                target="_blank"
                rel="noopener noreferrer"
                $border="#16a34a33"
                $bg="#16a34a0f"
                $color="#16a34a"
                $hoverBg="#16a34a1a"
              >
                📋 설문 응답 시트 바로가기
              </ShortcutLink>
              <ShortcutLink
                href="https://docs.google.com/spreadsheets/d/1Bvl8bKvXQezJA3diKZM3sd_WauWSEG7jjjh7w3e74VI"
                target="_blank"
                rel="noopener noreferrer"
                $border="#2563eb33"
                $bg="#2563eb0f"
                $color="#2563eb"
                $hoverBg="#2563eb1a"
              >
                ⚙️ 설정 시트 바로가기
              </ShortcutLink>
            </AdminShortcuts>

            {/* 담당자 미지정 경고 배너 */}
            <AlertBanner $show={unmapped.length > 0}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
              <div>
                <p style={{ fontWeight: 700, color: c.danger, fontSize: '0.88rem', marginBottom: 4 }}>
                  담당자 미지정 제출자 감지
                </p>
                <p style={{ fontSize: '0.8rem', color: 'hsl(0, 50%, 40%)' }}>
                  아래 이름이 배정표에 없습니다: <strong>{unmapped.join(', ')}</strong>
                </p>
              </div>
            </AlertBanner>

            {/* 2열: 공통기도제목 + 담당자배정 */}
            <TwoCol>
              {/* 공통 기도제목 */}
              <Card>
                <CardHead>
                  <span>📋</span>
                  <h3>공통 기도제목</h3>
                  {prayerSource && (
                    <SourceTag $sheet={prayerSource === 'google_sheets'}>
                      {prayerSource === 'google_sheets' ? '🔗 시트' : '⚙️ 기본값'}
                    </SourceTag>
                  )}
                </CardHead>
                <CardBody>
                  {isConfigLoad ? (
                    <><Skeleton /><Skeleton $w="85%" /></>
                  ) : configErr ? (
                    <ErrMsg>❌ {configErr}</ErrMsg>
                  ) : commonPrayers.length === 0 ? (
                    <EmptyState>기도제목이 없습니다.</EmptyState>
                  ) : (
                    <PrayerList>
                      {commonPrayers.map((p, i) => (
                        <PrayerItem key={i} $i={i}>
                          <PNum>{i + 1}.</PNum>
                          <PText>{p}</PText>
                        </PrayerItem>
                      ))}
                    </PrayerList>
                  )}
                </CardBody>
              </Card>

              {/* 담당자 지정 및 할당 편집기 */}
              <Card>
                <CardHead>
                  <span>👥</span>
                  <h3>담당자 지정 및 할당 편집기</h3>
                  {assignSource && (
                    <SourceTag $sheet={assignSource === 'google_sheets'}>
                      {assignSource === 'google_sheets' ? '🔗 시트' : '⚙️ 기본값'}
                    </SourceTag>
                  )}
                </CardHead>
                <CardBody style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  
                  {/* 미배정 사용자 할당 필요 경고 섹션 */}
                  {(() => {
                    const actualUnmapped = unmapped.filter(req => {
                      return !Object.values(editingAssignments || {}).some(list => list.includes(req));
                    });
                    if (actualUnmapped.length === 0) return null;
                    const managers = Object.keys(editingAssignments || {});
                    return (
                      <UnmappedSection>
                        <UnmappedTitle>⚠️ 담당자 미지정 사용자 할당 필요 ({actualUnmapped.length}명)</UnmappedTitle>
                        <UnmappedGrid>
                          {actualUnmapped.map(req => (
                            <UnmappedRow key={req}>
                              <UnmappedName>{req}</UnmappedName>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <SelectBox
                                  value={unmappedSelections[req] || ''}
                                  onChange={(e) => setUnmappedSelections(prev => ({ ...prev, [req]: e.target.value }))}
                                >
                                  <option value="">담당자 선택...</option>
                                  {managers.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                  ))}
                                </SelectBox>
                                <MiniButton 
                                  type="button" 
                                  onClick={() => handleQuickAssign(req)}
                                  style={{ background: c.primary, color: '#fff', borderColor: c.primary }}
                                >
                                  할당
                                </MiniButton>
                              </div>
                            </UnmappedRow>
                          ))}
                        </UnmappedGrid>
                      </UnmappedSection>
                    );
                  })()}

                  {/* 담당자 배정 편집 목록 */}
                  {isConfigLoad ? (
                    <><Skeleton /><Skeleton $w="75%" /></>
                  ) : configErr ? (
                    <ErrMsg>❌ {configErr}</ErrMsg>
                  ) : Object.keys(editingAssignments || {}).length === 0 ? (
                    <EmptyState>배정 정보가 없습니다.</EmptyState>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {Object.entries(editingAssignments || {}).map(([mgr, assignees], i) => (
                        <AssignRow key={mgr} $i={i}>
                          <ManagerName onClick={() => setSelectedManager(mgr)}>
                            {mgr}
                          </ManagerName>
                          <Tags>
                            {assignees.length > 0 ? (
                              assignees.map(a => (
                                <Tag key={a}>
                                  {a}
                                  <DeleteTagBtn 
                                    type="button" 
                                    onClick={() => handleDeleteAssignee(mgr, a)}
                                    title="삭제"
                                  >
                                    ✕
                                  </DeleteTagBtn>
                                </Tag>
                              ))
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: c.textMuted, fontStyle: 'italic', paddingLeft: '4px' }}>
                                제출자 없음
                              </span>
                            )}
                          </Tags>
                          
                          {/* 개별 추가 폼 */}
                          <QuickAddForm onSubmit={(e) => handleAddAssigneeSubmit(mgr, e)}>
                            <MiniInput
                              type="text"
                              placeholder="이름 추가..."
                              value={newAssigneeInputs[mgr] || ''}
                              onChange={(e) => setNewAssigneeInputs(prev => ({ ...prev, [mgr]: e.target.value }))}
                            />
                            <MiniButton type="submit">추가</MiniButton>
                          </QuickAddForm>
                        </AssignRow>
                      ))}
                    </div>
                  )}
                  
                  {!isConfigLoad && (
                    <div style={{ marginTop: 14, textAlign: 'right' }}>
                      <button
                        onClick={fetchConfig}
                        style={{
                          background: 'none', border: `1px solid ${c.border}`,
                          borderRadius: 6, padding: '4px 12px',
                          fontSize: '0.75rem', color: c.textSecondary, cursor: 'pointer'
                        }}
                        onMouseEnter={e => { e.target.style.borderColor = c.primary; e.target.style.color = c.primary; }}
                        onMouseLeave={e => { e.target.style.borderColor = c.border; e.target.style.color = c.textSecondary; }}
                      >
                        🔄 설정 새로고침
                      </button>
                    </div>
                  )}
                </CardBody>

                {/* 하단 푸터 저장 제어바 */}
                <ActionFooter>
                  {toast && <ToastMessage type={toast.type}>{toast.text}</ToastMessage>}
                  <ResetButton 
                    type="button" 
                    onClick={handleResetAssignments} 
                    disabled={!hasChanges() || isSaving}
                  >
                    초기화
                  </ResetButton>
                  <SaveButton 
                    type="button" 
                    onClick={handleSaveAssignments} 
                    disabled={!hasChanges() || isSaving}
                  >
                    {isSaving ? '저장 중...' : '구글 시트에 저장'}
                  </SaveButton>
                </ActionFooter>
              </Card>
            </TwoCol>
          </TabsContent>
        )}

        {/* 개별 기도제목 현황 (admin) */}
        {isAdmin && (
          <TabsContent active={activeTab === 'prayers'}>
            <Card>
              <CardHead>
                <span>📋</span>
                <h3>개별 기도제목 현황</h3>
                <SourceTag $sheet style={{ marginLeft: 'auto' }}>
                  {isPrayLoad
                    ? '로딩 중...'
                    : `총 ${Object.values(prayersData?.prayers_by_requester || {}).reduce((s, v) => s + v.length, 0)}개`}
                </SourceTag>
              </CardHead>
              <CardBody>
                {isPrayLoad ? (
                  <><Skeleton /><Skeleton $w="85%" /><Skeleton $w="60%" /></>
                ) : (
                  <IndividualPrayersTab
                    prayersData={prayersData}
                    assignments={assignments}
                    selectedManager={selectedManager}
                    onSelectManager={setSelectedManager}
                  />
                )}
              </CardBody>
            </Card>
          </TabsContent>
        )}

        {/* 실시간 시스템 로그 (admin) */}
        {isAdmin && (
          <TabsContent active={activeTab === 'logs'}>
            <ConsoleWrap>
              <ConsoleHead>
                <h3>
                  <ConsoleDot $color="hsl(0, 80%, 60%)" />
                  <ConsoleDot $color="hsl(38, 90%, 55%)" />
                  <ConsoleDot $color="hsl(95, 50%, 50%)" />
                  &nbsp;&nbsp;파이프라인 로그
                </h3>
                <span style={{ fontSize: '0.7rem', color: c.consoleGray }}>
                  5초마다 자동 갱신{logsErr ? ' · ⚠ 조회 오류' : ''}
                </span>
              </ConsoleHead>
              <ConsoleBody ref={consoleRef}>
                {logs.length === 0 ? (
                  <p style={{ fontSize: '0.76rem', color: c.consoleGray, fontStyle: 'italic' }}>
                    {logsErr ? `⚠ ${logsErr}` : '로그가 없습니다. 파이프라인을 실행하면 로그가 표시됩니다.'}
                  </p>
                ) : (
                  logs.map((line, i) => (
                    <LogLine key={i} $level={logLevel(line)}>{line}</LogLine>
                  ))
                )}
              </ConsoleBody>
            </ConsoleWrap>
          </TabsContent>
        )}

      </Wrapper>
    </>
  );
}
