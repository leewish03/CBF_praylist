/**
 * StatusBar.jsx
 * 실시간 상태 모니터링 배지 및 동기화 수동 실행 버튼 컴포넌트 (Shadcn/ui 스타일 리팩토링)
 */

import React from 'react';
import styled, { keyframes } from 'styled-components';
import colors from '../styles/colors';
import { formatKoreanDate } from '../utils/helpers';

const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0);    }
`;

const StatusBarCard = styled.div`
  background: ${colors.cardBg};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  animation: ${fadeIn} 0.35s ease;
  margin-bottom: 16px;
`;

const StatusBarInner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 20px;
`;

const StatusLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
`;

const statusConfig = {
  IDLE:    { bg: colors.idleLight,    text: colors.idle,    label: '대기 중' },
  RUNNING: { bg: colors.runningLight, text: colors.running, label: '실행 중' },
  SUCCESS: { bg: colors.successLight, text: colors.success, label: '완료' },
  ERROR:   { bg: colors.dangerLight,  text: colors.danger,  label: '오류' },
};

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 0.76rem;
  font-weight: 500;
  background: ${({ status }) => statusConfig[status]?.bg || colors.idleLight};
  color:      ${({ status }) => statusConfig[status]?.text || colors.idle};
  border: 1px solid ${({ status }) => statusConfig[status]?.text || colors.idle}22;
  transition: all 0.2s ease;
`;

const Spinner = styled.span`
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 1.5px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: ${spin} 0.75s linear infinite;
`;

const StatusDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
`;

const LastRunText = styled.p`
  font-size: 0.78rem;
  color: ${colors.textSecondary};
  letter-spacing: -0.01em;
`;

const TriggerButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  background: ${({ disabled }) => disabled ? colors.bg : colors.primary};
  color: ${({ disabled }) => disabled ? colors.textMuted : '#fff'};
  border: 1px solid ${({ disabled }) => disabled ? colors.border : colors.primary};
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease-in-out;
  box-shadow: ${({ disabled }) => disabled ? 'none' : `0 1px 2px 0 rgba(0,0,0,0.05)`};
  letter-spacing: -0.01em;

  &:hover:not(:disabled) {
    background: ${colors.primaryDark};
    border-color: ${colors.primaryDark};
  }

  &:active:not(:disabled) {
    transform: translateY(0.5px);
  }
`;

export default function StatusBar({
  currentStatus,
  lastRun,
  configSource,
  statusError,
  isTriggering,
  handleTrigger
}) {
  const isRunning = currentStatus === 'RUNNING';

  return (
    <StatusBarCard>
      <StatusBarInner>
        <StatusLeft>
          {/* 상태 배지 */}
          <StatusBadge status={currentStatus}>
            {isRunning ? <Spinner /> : <StatusDot />}
            {statusConfig[currentStatus]?.label || currentStatus}
          </StatusBadge>
 
          {/* 마지막 실행 시각 */}
          {lastRun && (
            <LastRunText>
              마지막 실행: {formatKoreanDate(lastRun)}
            </LastRunText>
          )}

          {/* 설정 소스 */}
          {configSource && configSource !== 'unknown' && (
            <LastRunText>
              설정 소스: {configSource}
            </LastRunText>
          )}

          {/* 상태 조회 오류 */}
          {statusError && (
            <span style={{ fontSize: '0.78rem', color: colors.danger }}>
              ⚠ {statusError}
            </span>
          )}
        </StatusLeft>

        {/* 동기화 시작 버튼 */}
        <TriggerButton
          onClick={handleTrigger}
          disabled={isRunning || isTriggering}
        >
          {isRunning || isTriggering ? <Spinner /> : '▶'}
          {isRunning ? '실행 중...' : isTriggering ? '요청 중...' : '동기화 시작'}
        </TriggerButton>
      </StatusBarInner>
    </StatusBarCard>
  );
}
