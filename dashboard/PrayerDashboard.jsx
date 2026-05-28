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
import styled, { createGlobalStyle, keyframes } from 'styled-components';
import colors from './styles/colors';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0);    }
`;

// 서브컴포넌트 임포트
import Header from './components/Header';
import StatusBar from './components/StatusBar';
import AlertBanner from './components/AlertBanner';
import ConfigGrid from './components/ConfigGrid';
import ConsolePanel from './components/ConsolePanel';
import PrayersViewer from './components/PrayersViewer';

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

const AuthCardWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 20px;
  animation: ${fadeIn} 0.35s ease;
`;

const AuthCard = styled.div`
  width: 100%;
  max-width: 360px;
  background: ${colors.cardBg};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.05);
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

const LockIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: ${colors.primaryLight};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  margin-bottom: 16px;
  border: 1px solid ${colors.primary}22;
`;

const AuthTitle = styled.h2`
  font-size: 1.1rem;
  font-weight: 600;
  color: ${colors.textPrimary};
  margin-bottom: 6px;
  letter-spacing: -0.01em;
`;

const AuthSub = styled.p`
  font-size: 0.78rem;
  color: ${colors.textSecondary};
  margin-bottom: 20px;
  line-height: 1.4;
`;

const AuthForm = styled.form`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const PasswordInput = styled.input`
  width: 100%;
  border: 1px solid ${colors.border};
  background: ${colors.cardBg};
  color: ${colors.textPrimary};
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 0.85rem;
  text-align: center;
  outline: none;
  letter-spacing: 0.2em;
  font-weight: bold;
  transition: all 0.15s ease-in-out;

  &:focus {
    border-color: ${colors.primary};
    box-shadow: 0 0 0 2px ${colors.primary}22;
  }
`;

const AuthError = styled.p`
  font-size: 0.75rem;
  color: ${colors.danger};
  font-weight: 500;
  margin-top: 4px;
`;

const AuthBtnContainer = styled.div`
  display: flex;
  gap: 8px;
  width: 100%;
  margin-top: 8px;
`;

const AuthButton = styled.button`
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  letter-spacing: -0.01em;

  ${({ variant }) => variant === 'primary' && `
    background: ${colors.primary};
    color: #fff;
    border: 1px solid ${colors.primary};
    
    &:hover {
      background: ${colors.primaryDark};
      border-color: ${colors.primaryDark};
    }
  `}

  ${({ variant }) => variant === 'outline' && `
    background: ${colors.cardBg};
    color: ${colors.textPrimary};
    border: 1px solid ${colors.border};
    
    &:hover {
      background: ${colors.bg};
    }
  `}
`;

export default function PrayerDashboard() {
  // ── 라우팅 상태 ──
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // 페이지 이동 함수
  const navigate = useCallback((path) => {
    window.history.pushState(null, '', path);
    setCurrentPath(path);
  }, []);

  // 뒤로가기/앞으로가기 브라우저 액션 대응
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ── 관리자 권한 인증 상태 ──
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return sessionStorage.getItem('admin_auth') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

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

  // Notion 제거 및 대시보드 뷰어용 상태 신설
  const [prayersData, setPrayersData] = useState(null);           // /api/prayers 데이터
  const [prayersError, setPrayersError] = useState(null);         // 기도제목 통신 오류
  const [selectedManager, setSelectedManager] = useState('ALL');  // 필터링 담당자

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

  /** 수집된 기도제목 조회 (/api/prayers) */
  const fetchPrayers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/prayers`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPrayersData(data);
      setPrayersError(null);
    } catch (err) {
      console.error('[PrayerDashboard] prayers fetch error:', err);
      setPrayersError('기도제목 데이터를 가져오지 못했습니다.');
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
        setTimeout(() => {
          fetchStatus();
          fetchPrayers();
        }, 800);
      }
    } catch (err) {
      console.error('[PrayerDashboard] trigger error:', err);
      setTriggerMsg({ type: 'error', text: '요청 중 오류가 발생했습니다.' });
    } finally {
      setIsTriggering(false);
    }
  }, [isTriggering, status?.status, fetchStatus]);

  // ── 관리자 비밀번호 검증 ──
  const handleAuthSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === '1217') {
      setIsAdminAuthenticated(true);
      sessionStorage.setItem('admin_auth', 'true');
      setAuthError('');
      setPasswordInput('');
    } else {
      setAuthError('비밀번호가 올바르지 않습니다.');
    }
  };

  const handleAuthCancel = () => {
    setAuthError('');
    setPasswordInput('');
    navigate('/'); // 안전하게 일반 화면으로 리다이렉트
  };

  // ── 생명주기 및 폴링 설정 ──
  useEffect(() => {
    fetchStatus();
    fetchConfig();
    fetchLogs();
    fetchPrayers();

    // 3초 간격 상태 조회
    const statusInterval = setInterval(fetchStatus, 3000);
    // 5초 간격 로그 스트리밍
    const logsInterval = setInterval(fetchLogs, 5000);
    // 10초 간격 기도제목 수집 조회
    const prayersInterval = setInterval(fetchPrayers, 10000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(logsInterval);
      clearInterval(prayersInterval);
    };
  }, [fetchStatus, fetchConfig, fetchLogs, fetchPrayers]);

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
  const notionPageId   = status?.notion_page_id;
  const notionPageUrl  = notionPageId ? `https://notion.so/${notionPageId.replace(/-/g, '')}` : null;

  const commonPrayers  = configData?.common_prayers?.data || [];
  const prayerSource   = configData?.common_prayers?.source;
  const assignments    = configData?.assignments?.data || {};
  const assignSource   = configData?.assignments?.source;

  const isAdmin = currentPath === '/admin';
  const showAdminAuth = isAdmin && !isAdminAuthenticated;

  return (
    <>
      <GlobalStyle />
      <ContainerWrapper>
        {/* ── 헤더 ── */}
        <Header notionPageUrl={notionPageUrl} isAdmin={isAdmin} onNavigate={navigate} />

        {showAdminAuth ? (
          // 🔒 관리자 페이지 비밀번호 입력 모달/카드
          <AuthCardWrapper>
            <AuthCard>
              <LockIcon>🔒</LockIcon>
              <AuthTitle>관리자 인증 필요</AuthTitle>
              <AuthSub>
                관리자 도구에 진입하려면 설정된 비밀번호를 입력해 주십시오.
              </AuthSub>
              <AuthForm onSubmit={handleAuthSubmit}>
                <PasswordInput
                  type="password"
                  placeholder="••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  maxLength={10}
                  autoFocus
                />
                {authError && <AuthError>{authError}</AuthError>}
                <AuthBtnContainer>
                  <AuthButton type="button" variant="outline" onClick={handleAuthCancel}>
                    취소
                  </AuthButton>
                  <AuthButton type="submit" variant="primary">
                    인증하기
                  </AuthButton>
                </AuthBtnContainer>
              </AuthForm>
            </AuthCard>
          </AuthCardWrapper>
        ) : isAdmin ? (
          // ⚙️ 관리자용 페이지 뷰 (인증 완료 시)
          <>
            {/* 상태 정보 바 */}
            <StatusBar
              currentStatus={currentStatus}
              lastRun={lastRun}
              configSource={configSource}
              statusError={statusError}
              isTriggering={isTriggering}
              handleTrigger={handleTrigger}
            />

            {/* 트리거 액션 알림 팝업/토스트 메시지 */}
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

            {/* 담당자 미배정 제출자 에러 배너 */}
            <AlertBanner unmappedRequesters={unmapped} />

            {/* 실제 수집된 기도제목 뷰어 */}
            <PrayersViewer
              prayersData={prayersData}
              assignments={assignments}
              selectedManager={selectedManager}
              setSelectedManager={setSelectedManager}
            />

            {/* 설정 정보(공통 기도제목 & 담당자 배정) 카드 그리드 */}
            <ConfigGrid
              isConfigLoading={isConfigLoading}
              configError={configError}
              commonPrayers={commonPrayers}
              prayerSource={prayerSource}
              assignments={assignments}
              assignSource={assignSource}
              onManagerClick={setSelectedManager}
              isAdmin={true}
              unmappedRequesters={unmapped}
              onRefreshConfig={fetchConfig}
            />

            {/* 실시간 로그 터미널 */}
            <ConsolePanel
              logs={logs}
              logsError={logsError}
              currentStatus={currentStatus}
            />
          </>
        ) : (
          // 🙏 기도팀용 페이지 뷰 (기도제목만 노출)
          <>
            {/* 공통 기도제목 카드 (담당자 지정 없이 1열로만 렌더링) */}
            <ConfigGrid
              isConfigLoading={isConfigLoading}
              configError={configError}
              commonPrayers={commonPrayers}
              prayerSource={prayerSource}
              assignments={assignments}
              assignSource={assignSource}
              onManagerClick={setSelectedManager}
              isAdmin={false}
              unmappedRequesters={unmapped}
              onRefreshConfig={fetchConfig}
            />

            {/* 실제 수집된 개별 구도자 기도제목 뷰어 */}
            <PrayersViewer
              prayersData={prayersData}
              assignments={assignments}
              selectedManager={selectedManager}
              setSelectedManager={setSelectedManager}
            />
          </>
        )}
      </ContainerWrapper>
    </>
  );
}
