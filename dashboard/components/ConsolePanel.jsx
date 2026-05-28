/**
 * ConsolePanel.jsx
 * 백그라운드 파이프라인의 실시간 로그를 터미널 형태로 보여주는 콘솔 뷰어 컴포넌트
 */

import React, { useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import colors from '../styles/colors';
import { getLogLevel } from '../utils/helpers';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0);    }
`;

const ConsolePanelCard = styled.div`
  background: ${colors.cardBg};
  border: 1px solid ${colors.border};
  border-radius: 14px;
  box-shadow: 0 2px 12px hsla(0, 0%, 0%, 0.06);
  overflow: hidden;
  animation: ${fadeIn} 0.35s ease;
  margin-bottom: 0;
`;

const ConsoleHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  background: hsl(210, 15%, 20%);
  border-bottom: 1px solid hsl(210, 15%, 25%);

  h3 {
    font-size: 0.85rem;
    font-weight: 600;
    color: ${colors.consoleGray};
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;

const ConsoleDot = styled.span`
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ color }) => color};
`;

const ConsoleBody = styled.div`
  background: ${colors.bgConsole};
  height: 250px;
  overflow-y: auto;
  padding: 14px 18px;
  font-family: 'Courier New', Courier, monospace;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: hsl(210, 15%, 20%);
  }
  &::-webkit-scrollbar-thumb {
    background: hsl(210, 15%, 35%);
    border-radius: 3px;
  }
`;

const LogLine = styled.p`
  font-size: 0.76rem;
  line-height: 1.7;
  color: ${({ isError }) => isError ? colors.danger : 
          ({ isWarn }) => isWarn ? colors.warning : colors.consoleText};
  white-space: pre-wrap;
  word-break: break-all;
  animation: ${fadeIn} 0.2s ease;

  ${({ isError }) => isError && css`color: hsl(0, 80%, 70%);`}
  ${({ isWarn }) => isWarn && css`color: hsl(38, 90%, 70%);`}
`;

const EmptyConsole = styled.p`
  font-size: 0.78rem;
  color: ${colors.consoleGray};
  font-style: italic;
`;

export default function ConsolePanel({ logs, logsError, currentStatus }) {
  const consoleRef = useRef(null);

  // 새 로그가 올 때마다 자동으로 하단 스크롤
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  const isRunning = currentStatus === 'RUNNING';
  const statusColor = isRunning ? '#3b82f6' : (currentStatus === 'ERROR' ? '#ef4444' : '#10b981');

  return (
    <ConsolePanelCard>
      <ConsoleHeader>
        <h3>
          <ConsoleDot color={statusColor} />
          실시간 동기화 콘솔 로그 (최근 80줄)
        </h3>
        {logsError && (
          <span style={{ fontSize: '0.75rem', color: colors.danger }}>
            ⚠ {logsError}
          </span>
        )}
      </ConsoleHeader>
      <ConsoleBody ref={consoleRef}>
        {logs.length > 0 ? (
          logs.map((line, idx) => {
            const level = getLogLevel(line);
            return (
              <LogLine
                key={idx}
                isError={level === 'error'}
                isWarn={level === 'warn'}
              >
                {line}
              </LogLine>
            );
          })
        ) : (
          <EmptyConsole>표시할 로그가 없습니다.</EmptyConsole>
        )}
      </ConsoleBody>
    </ConsolePanelCard>
  );
}
