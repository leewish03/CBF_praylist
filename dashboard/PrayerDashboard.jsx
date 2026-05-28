/**
 * PrayerDashboard.jsx
 * CBF 기도제목 자동화 V2 - 메인 대시보드 컨테이너 컴포넌트
 *
 * 역할:
 * - 상태(status, config, logs)를 API로부터 주기적 폴링 및 관리
 * - 수동 트리거 요청 관리
 * - 모듈식으로 분할된 서브컴포넌트(Header, StatusBar, AlertBanner, ConfigGrid, ConsolePanel) 조립
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import colors from './styles/colors';

// 서브컴포넌트 임포트
import Header from './components/Header';
import StatusBar from './components/StatusBar';
import AlertBanner from './components/AlertBanner';
import ConfigGrid from './components/ConfigGrid';
import ConsolePanel from './components/ConsolePanel';

// 글로벌 스타일 (Pretendard 폰트 포함)
const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background-color: ${colors.bg};
    color: hsl(220, 15%, 20%);
    line-height: 1.6;
  }
`;

const ContainerWrapper = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 20px 48px;

  @media (max-width: 768px) {
    padding: 16px 12px 40px;
  }
`;

// API 서버 베이스 URL 설정
// Vite/CRA 빌드 시 process.env 또는 import.meta.env를 사용해 동적으로 바인딩 가능
const API_BASE_URL = process.env.REACT_APP_API_URL || ''; 

export default function PrayerDashboard() {
  // ── 상태 관리 ──
  const [status, setStatus]           = useState(null);           // /api/status 데이터
  const [configData, setConfigData]   = useState(null);           // /api/config 데이터
  const [logs, setLogs]               = useState([]);             // /api/logs 데이터
  const [isTriggering, setIsTriggering] = useState(false);        // 동기화 요청 로딩 상태
  const [statusError, setStatusError] = useState(null);           // 상태 통신 오류
  const [configError, setConfigError] = useState(null);           // 설정 통신 오류
  const [logsError, setLogsError]     = useState(null);           // 로그 통신 오류
  const [triggerMsg, setTriggerMsg]   = useState(null);           // 트리거 응답 메시지
  const [isConfigLoading, setIsConfigLoading] = useState(true);   // 설정 최초 로딩 상태

  // ── API 요청 함수들 ──

  /** 상태 조회 (/api/status) */
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus(data);
      setStatusError(null);
    } catch (err) {
      console.error('[PrayerDashboard] status fetch error:', err);
      setStatusError('상태 정보를 가져오지 못했습니다.');
    }
  }, []);

  /** 설정 로드 (/api/config) */
  const fetchConfig = useCallback(async () => {
    setIsConfigLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/config`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConfigData(data);
      setConfigError(null);
    } catch (err) {
      console.error('[PrayerDashboard] config fetch error:', err);
      setConfigError('설정 데이터를 가져오지 못했습니다.');
    } finally {
      setIsConfigLoading(false);
    }
  }, []);

  /** 로그 스트리밍 조회 (/api/logs) */
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/logs?limit=80`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLogs(data.lines || []);
      setLogsError(null);
    } catch (err) {
      console.error('[PrayerDashboard] logs fetch error:', err);
      setLogsError('로그를 가져오지 못했습니다.');
    }
  }, []);

  /** 파이프라인 트리거 시작 */
  const handleTrigger = useCallback(async () => {
    if (isTriggering || status?.status === 'RUNNING') return;

    setIsTriggering(true);
    setTriggerMsg(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/trigger`, { method: 'POST' });
      const data = await res.json();

      if (res.status === 409) {
        setTriggerMsg({ type: 'warn', text: data.detail || '이미 실행 중입니다.' });
      } else if (!res.ok) {
        setTriggerMsg({ type: 'error', text: data.detail || '실행 요청 실패' });
      } else {
        setTriggerMsg({ type: 'success', text: data.message || '파이프라인 실행이 시작되었습니다.' });
        // 즉시 상태 리프레시
        setTimeout(fetchStatus, 800);
      }
    } catch (err) {
      console.error('[PrayerDashboard] trigger error:', err);
      setTriggerMsg({ type: 'error', text: '요청 중 오류가 발생했습니다.' });
    } finally {
      setIsTriggering(false);
    }
  }, [isTriggering, status?.status, fetchStatus]);

  // ── 생명주기 및 폴링 설정 ──
  useEffect(() => {
    fetchStatus();
    fetchConfig();
    fetchLogs();

    // 3초 간격 상태 조회
    const statusInterval = setInterval(fetchStatus, 3000);
    // 5초 간격 로그 스트리밍
    const logsInterval = setInterval(fetchLogs, 5000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(logsInterval);
    };
  }, [fetchStatus, fetchConfig, fetchLogs]);

  // ── 트리거 완료 메시지 5초 자동 소거 ──
  useEffect(() => {
    if (triggerMsg) {
      const timer = setTimeout(() => setTriggerMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [triggerMsg]);

  // 데이터 가공 및 서브컴포넌트 바인딩용 변수
  const currentStatus  = status?.status || 'IDLE';
  const lastRun        = status?.last_run;
  const configSource   = status?.config_source;
  const unmapped       = status?.unmapped_requesters || [];
  const notionPageId   = status?.notion_page_id || '1c50f7e0cd5f8025bb78c5c839f205f0';
  const notionPageUrl  = `https://notion.so/${notionPageId.replace(/-/g, '')}`;

  const commonPrayers  = configData?.common_prayers?.data || [];
  const prayerSource   = configData?.common_prayers?.source;
  const assignments    = configData?.assignments?.data || {};
  const assignSource   = configData?.assignments?.source;

  return (
    <>
      <GlobalStyle />
      <ContainerWrapper>
        {/* ── 헤더 ── */}
        <Header notionPageUrl={notionPageUrl} />

        {/* ── 상태 정보 바 ── */}
        <StatusBar
          currentStatus={currentStatus}
          lastRun={lastRun}
          configSource={configSource}
          statusError={statusError}
          isTriggering={isTriggering}
          handleTrigger={handleTrigger}
        />

        {/* ── 트리거 액션 알림 팝업/토스트 메시지 ── */}
        {triggerMsg && (
          <div style={{
            padding: '10px 14px',
            marginBottom: '16px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: '600',
            background: triggerMsg.type === 'success' ? colors.successLight : 
                        (triggerMsg.type === 'warn' ? colors.warningLight : colors.dangerLight),
            color: triggerMsg.type === 'success' ? colors.success : 
                   (triggerMsg.type === 'warn' ? colors.warning : colors.danger),
            border: `1px solid ${triggerMsg.type === 'success' ? colors.success : 
                                (triggerMsg.type === 'warn' ? colors.warning : colors.danger)}44`
          }}>
            {triggerMsg.type === 'success' ? '✅' : '⚠'} {triggerMsg.text}
          </div>
        )}

        {/* ── 담당자 미배정 제출자 에러 배너 ── */}
        <AlertBanner unmappedRequesters={unmapped} />

        {/* ── 공통기도 & 담당자 배정 카드 그리드 ── */}
        <ConfigGrid
          isConfigLoading={isConfigLoading}
          configError={configError}
          commonPrayers={commonPrayers}
          prayerSource={prayerSource}
          assignments={assignments}
          assignSource={assignSource}
        />

        {/* ── 실시간 로그 터미널 ── */}
        <ConsolePanel
          logs={logs}
          logsError={logsError}
          currentStatus={currentStatus}
        />
      </ContainerWrapper>
    </>
  );
}
