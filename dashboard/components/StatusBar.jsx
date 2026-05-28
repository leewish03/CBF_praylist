/**
 * StatusBar.jsx
 * 실시간 상태 모니터링 배지 및 동기화 수동 실행 버튼 컴포넌트
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
  border-radius: 14px;
  box-shadow: 0 2px 12px hsla(0, 0%, 0%, 0.06);
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
  padding: 18px 20px;
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
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.82rem;
  font-weight: 600;
  background: ${({ status }) => statusConfig[status]?.bg || colors.idleLight};
  color:      ${({ status }) => statusConfig[status]?.text || colors.idle};
  border: 1px solid ${({ status }) => statusConfig[status]?.text || colors.idle}33;
  transition: all 0.3s ease;
`;

const Spinner = styled.span`
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: ${spin} 0.7s linear infinite;
`;

const StatusDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
`;

const LastRunText = styled.p`
  font-size: 0.8rem;
  color: ${colors.textSecondary};
`;

const TriggerButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: ${({ disabled }) => disabled ? colors.idleLight : colors.primary};
  color: ${({ disabled }) => disabled ? colors.idle : '#fff'};
  border: none;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
  box-shadow: ${({ disabled }) => disabled ? 'none' : `0 3px 10px hsla(142, 35%, 28%, 0.3)`};

  &:hover:not(:disabled) {
    background: ${colors.primaryDark};
    transform: translateY(-1px);
    box-shadow: 0 5px 15px hsla(142, 35%, 28%, 0.35);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
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
