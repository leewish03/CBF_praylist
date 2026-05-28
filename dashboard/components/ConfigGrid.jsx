/**
 * ConfigGrid.jsx
 * 구글 시트에서 가져온 설정 데이터(공통 기도제목, 담당자 매핑)를 렌더링하고 편집하는 그리드 카드 컴포넌트 (Shadcn/ui 스타일 및 에뮬레이팅)
 */

import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import colors from '../styles/colors';
import MarkdownText from './MarkdownText';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0);    }
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0);    }
`;

const SkeletonAnim = keyframes`
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: ${({ singleColumn }) => singleColumn ? '1fr' : '1fr 1fr'};
  gap: 20px;
  margin-bottom: 24px;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
    gap: 16px;
  }
`;

const Card = styled.div`
  background: ${colors.cardBg};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  animation: ${fadeIn} 0.35s ease;
  display: flex;
  flex-direction: column;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid ${colors.border};
  background: transparent;
  flex-wrap: wrap;
  gap: 8px;

  h3 {
    font-size: 0.88rem;
    font-weight: 600;
    color: ${colors.textPrimary};
    letter-spacing: -0.01em;
  }
`;

const CardBody = styled.div`
  padding: 20px;
  flex-grow: 1;

  @media (max-width: 480px) {
    padding: 16px;
  }
`;

const SourceTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 500;
  background: ${({ isSheet }) => isSheet ? colors.successLight : colors.warningLight};
  color:      ${({ isSheet }) => isSheet ? colors.success : colors.warning};
  border: 1px solid ${({ isSheet }) => isSheet ? colors.success + '22' : colors.warning + '22'};
`;

const PrayerList = styled.ol`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const PrayerItem = styled.li`
  display: flex;
  gap: 14px;
  padding: 16px 18px;
  background: ${colors.cardBg};
  border: 1px solid ${colors.border};
  border-radius: 6px;
  animation: ${slideIn} 0.3s ease both;
  animation-delay: ${({ idx }) => idx * 0.05}s;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.02);
  transition: all 0.2s ease-in-out;

  &:hover {
    border-color: ${colors.primary}33;
    box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.04);
  }
`;

const PrayerNum = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: ${colors.primaryLight};
  color: ${colors.primary};
  font-size: 0.72rem;
  font-weight: 700;
  flex-shrink: 0;
  border: 1px solid ${colors.primary}15;
  margin-top: 1px;
`;

const PrayerText = styled.div`
  font-size: 0.82rem;
  color: ${colors.textPrimary};
  line-height: 1.6;
`;

const AssignmentTable = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const AssignmentRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  background: ${colors.cardBg};
  border: 1px solid ${colors.border};
  border-radius: 6px;
  animation: ${slideIn} 0.3s ease both;
  animation-delay: ${({ idx }) => idx * 0.04}s;
  transition: all 0.2s ease;
  flex-wrap: wrap;

  &:hover {
    background: ${colors.bg};
  }

  @media (max-width: 480px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
`;

const ManagerName = styled.span`
  font-size: 0.8rem;
  font-weight: 600;
  color: ${colors.primary};
  min-width: 65px;
  padding: 3px 6px;
  border-radius: 4px;
  cursor: pointer;
  background: ${colors.primaryLight};
  border: 1px solid ${colors.primary}11;
  text-align: center;
  transition: all 0.15s;

  &:hover {
    background: ${colors.primary};
    color: #fff;
  }
`;

const AssigneeTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex-grow: 1;
`;

const AssigneeTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: ${colors.bg};
  color: ${colors.textSecondary};
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 500;
  border: 1px solid ${colors.border};
`;

const DeleteTagBtn = styled.button`
  border: none;
  background: transparent;
  color: ${colors.textMuted};
  cursor: pointer;
  font-size: 0.72rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 1px;
  border-radius: 2px;
  transition: all 0.15s;

  &:hover {
    color: ${colors.danger};
    background: ${colors.dangerLight};
  }
`;

const QuickAddForm = styled.form`
  display: flex;
  gap: 6px;
  align-items: center;
  
  @media (max-width: 480px) {
    width: 100%;
  }
`;

const MiniInput = styled.input`
  border: 1px solid ${colors.border};
  background: ${colors.cardBg};
  color: ${colors.textPrimary};
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.75rem;
  outline: none;
  width: 100px;
  transition: border-color 0.15s;

  &:focus {
    border-color: ${colors.primary};
  }

  @media (max-width: 480px) {
    flex-grow: 1;
  }
`;

const MiniButton = styled.button`
  border: 1px solid ${colors.border};
  background: ${colors.bg};
  color: ${colors.textPrimary};
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${colors.primary};
    border-color: ${colors.primary};
    color: #fff;
  }
`;

const UnmappedSection = styled.div`
  background: ${colors.dangerLight}44;
  border: 1px solid ${colors.danger}22;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 16px;
  animation: ${fadeIn} 0.3s ease;
`;

const UnmappedTitle = styled.h4`
  font-size: 0.78rem;
  font-weight: 600;
  color: ${colors.danger};
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
  background: ${colors.cardBg};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  flex-wrap: wrap;
`;

const UnmappedName = styled.span`
  font-size: 0.75rem;
  font-weight: 600;
  color: ${colors.textPrimary};
`;

const SelectBox = styled.select`
  border: 1px solid ${colors.border};
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.72rem;
  outline: none;
  background: ${colors.cardBg};
  color: ${colors.textPrimary};
`;

const ActionFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid ${colors.border};
  background: ${colors.bg};
  align-items: center;
`;

const SaveButton = styled.button`
  border: 1px solid ${colors.primary};
  background: ${colors.primary};
  color: #fff;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);

  &:hover:not(:disabled) {
    background: ${colors.primaryDark};
    border-color: ${colors.primaryDark};
  }

  &:disabled {
    background: ${colors.border};
    border-color: ${colors.border};
    color: ${colors.textMuted};
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const ResetButton = styled.button`
  border: 1px solid ${colors.border};
  background: ${colors.cardBg};
  color: ${colors.textSecondary};
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: ${colors.bg};
    color: ${colors.textPrimary};
  }
`;

const ToastMessage = styled.div`
  font-size: 0.75rem;
  color: ${({ type }) => type === 'success' ? colors.success : colors.danger};
  font-weight: 500;
  margin-right: auto;
`;

const SkeletonLine = styled.div`
  height: ${({ h }) => h || '14px'};
  background: linear-gradient(90deg, 
    hsl(240, 5%, 92%) 25%, 
    hsl(240, 5%, 96%) 50%, 
    hsl(240, 5%, 92%) 75%);
  background-size: 200% 100%;
  border-radius: 4px;
  margin-bottom: 8px;
  width: ${({ w }) => w || '100%'};
  animation: ${SkeletonAnim} 1.5s infinite;
`;

const ErrorMessage = styled.p`
  font-size: 0.78rem;
  color: ${colors.danger};
  padding: 10px 12px;
  background: ${colors.dangerLight};
  border-radius: 6px;
  border: 1px solid ${colors.danger}22;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 24px 0;
  color: ${colors.textMuted};
  font-size: 0.8rem;
`;

export default function ConfigGrid({
  isConfigLoading,
  configError,
  commonPrayers,
  prayerSource,
  assignments,
  assignSource,
  onManagerClick,
  isAdmin = true,
  unmappedRequesters = [], // 미배정 제출자 프롭스 추가
  onRefreshConfig          // 설정 리프레시 콜백
}) {
  const isSheetPrayer = prayerSource === 'google_sheets';
  const isSheetAssign = assignSource === 'google_sheets';
  const singleColumn = !isAdmin;

  // ── 담당자 편집용 로컬 상태 ──
  const [editingAssignments, setEditingAssignments] = useState({});
  const [newAssigneeInputs, setNewAssigneeInputs] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [unmappedSelections, setUnmappedSelections] = useState({});

  // 부모로부터 assignments 프롭스가 갱신될 때 로컬 상태 초기화
  useEffect(() => {
    if (assignments) {
      // 딥 카피
      const copy = {};
      Object.entries(assignments).forEach(([k, v]) => {
        copy[k] = [...v];
      });
      setEditingAssignments(copy);
    }
  }, [assignments]);

  // 토스트 메시지 5초 후 자동 제거
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // ── 편집 헬퍼 함수들 ──

  /** 특정 담당자 매핑에서 제출자 삭제 */
  const handleDeleteAssignee = (manager, name) => {
    setEditingAssignments(prev => ({
      ...prev,
      [manager]: prev[manager].filter(n => n !== name)
    }));
  };

  /** 특정 담당자에게 제출자 수동 추가 */
  const handleAddAssigneeSubmit = (manager, e) => {
    e.preventDefault();
    const name = newAssigneeInputs[manager]?.trim();
    if (!name) return;

    // 중복 체크 및 추가
    if (editingAssignments[manager]?.includes(name)) {
      alert('이미 배정된 이름입니다.');
      return;
    }

    // 다른 매핑에 존재할 수도 있으니 삭제 처리는 정책에 따름 (일단 중복 허용 또는 경고)
    setEditingAssignments(prev => ({
      ...prev,
      [manager]: [...(prev[manager] || []), name]
    }));

    setNewAssigneeInputs(prev => ({ ...prev, [manager]: '' }));
  };

  /** 미배정 사용자 원클릭 할당 */
  const handleQuickAssign = (requester) => {
    const targetManager = unmappedSelections[requester];
    if (!targetManager) {
      alert('담당자를 선택해주세요.');
      return;
    }

    setEditingAssignments(prev => ({
      ...prev,
      [targetManager]: [...(prev[targetManager] || []), requester]
    }));

    // 할당 완료된 미배정 셀렉션 소거
    setUnmappedSelections(prev => {
      const copy = { ...prev };
      delete copy[requester];
      return copy;
    });
  };

  /** 변경 여부 체크 */
  const hasChanges = () => {
    if (!assignments || !editingAssignments) return false;
    
    const origKeys = Object.keys(assignments);
    const editKeys = Object.keys(editingAssignments);
    if (origKeys.length !== editKeys.length) return true;

    for (let key of origKeys) {
      const origList = assignments[key] || [];
      const editList = editingAssignments[key] || [];
      if (origList.length !== editList.length) return true;
      
      const origSorted = [...origList].sort().join(',');
      const editSorted = [...editList].sort().join(',');
      if (origSorted !== editSorted) return true;
    }
    return false;
  };

  /** 변경사항 구글 시트에 최종 저장 */
  const handleSaveAssignments = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setToast(null);

    try {
      const res = await fetch('/api/config/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: editingAssignments })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '저장 실패');

      setToast({ type: 'success', text: '✅ 구글 시트 배정표를 성공적으로 업데이트했습니다!' });
      
      // 설정 데이터 부모 리프레시 트리거
      if (onRefreshConfig) {
        onRefreshConfig();
      }
    } catch (err) {
      console.error('[ConfigGrid] Save assignments error:', err);
      setToast({ type: 'error', text: `❌ 저장 실패: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  /** 편집 수정 취소 / 리셋 */
  const handleReset = () => {
    const copy = {};
    Object.entries(assignments).forEach(([k, v]) => {
      copy[k] = [...v];
    });
    setEditingAssignments(copy);
    setUnmappedSelections({});
    setToast(null);
  };

  // 로딩 스켈레톤 UI
  if (isConfigLoading) {
    return (
      <Grid singleColumn={singleColumn}>
        <Card>
          <CardHeader><h3>📋 공통 기도제목 로딩 중...</h3></CardHeader>
          <CardBody>
            <SkeletonLine h="16px" w="40%" />
            <SkeletonLine h="40px" />
            <SkeletonLine h="40px" />
            <SkeletonLine h="40px" />
          </CardBody>
        </Card>
        {isAdmin && (
          <Card>
            <CardHeader><h3>👥 담당자 배정 로딩 중...</h3></CardHeader>
            <CardBody>
              <SkeletonLine h="24px" />
              <SkeletonLine h="24px" />
              <SkeletonLine h="24px" />
            </CardBody>
          </Card>
        )}
      </Grid>
    );
  }

  // 오류 UI
  if (configError) {
    return (
      <Grid singleColumn={singleColumn}>
        <Card>
          <CardHeader><h3>📋 공통 기도제목</h3></CardHeader>
          <CardBody><ErrorMessage>⚠ {configError}</ErrorMessage></CardBody>
        </Card>
        {isAdmin && (
          <Card>
            <CardHeader><h3>👥 담당자 배정</h3></CardHeader>
            <CardBody><ErrorMessage>⚠ {configError}</ErrorMessage></CardBody>
          </Card>
        )}
      </Grid>
    );
  }

  const managerEntries = Object.entries(editingAssignments);
  const managers = Object.keys(editingAssignments);

  // 미배정 사용자 중 이미 할당 완료되지 않은 실제 미배정 상태 필터링
  const actualUnmapped = unmappedRequesters.filter(req => {
    // editingAssignments의 어떤 담당자 배정 배열에도 포함되지 않았는지 확인
    return !Object.values(editingAssignments).some(list => list.includes(req));
  });

  return (
    <Grid singleColumn={singleColumn}>
      {/* ── 1. 공통 기도제목 카드 ── */}
      <Card>
        <CardHeader>
          <h3>📋 공통 기도제목</h3>
          {isAdmin && prayerSource && (
            <SourceTag isSheet={isSheetPrayer}>
              {isSheetPrayer ? '🟢 구글 시트' : '🟠 내장 기본값'}
            </SourceTag>
          )}
        </CardHeader>
        <CardBody>
          {commonPrayers.length > 0 ? (
            <PrayerList>
              {commonPrayers.map((prayer, idx) => (
                <PrayerItem key={idx} idx={idx}>
                  <PrayerNum>{idx + 1}.</PrayerNum>
                  <PrayerText><MarkdownText text={prayer} /></PrayerText>
                </PrayerItem>
              ))}
            </PrayerList>
          ) : (
            <EmptyState>로딩된 공통 기도제목이 없습니다.</EmptyState>
          )}
        </CardBody>
      </Card>

      {/* ── 2. 담당자 지정 및 편집 카드 (관리자 모드) ── */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <h3>👥 담당자 지정 및 할당 편집기</h3>
            {assignSource && (
              <SourceTag isSheet={isSheetAssign}>
                {isSheetAssign ? '🟢 구글 시트' : '🟠 내장 기본값'}
              </SourceTag>
            )}
          </CardHeader>
          <CardBody style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            
            {/* 미배정 사용자 긴급 할당 섹션 */}
            {actualUnmapped.length > 0 && (
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
                          style={{ background: colors.primary, color: '#fff', borderColor: colors.primary }}
                        >
                          할당
                        </MiniButton>
                      </div>
                    </UnmappedRow>
                  ))}
                </UnmappedGrid>
              </UnmappedSection>
            )}

            {/* 담당자 배정 편집 테이블 */}
            {managerEntries.length > 0 ? (
              <AssignmentTable style={{ flexGrow: 1 }}>
                {managerEntries.map(([manager, assignees], idx) => (
                  <AssignmentRow key={manager} idx={idx}>
                    <ManagerName onClick={() => onManagerClick && onManagerClick(manager)}>
                      {manager}
                    </ManagerName>
                    <AssigneeTags>
                      {assignees.length > 0 ? (
                        assignees.map((name, aIdx) => (
                          <AssigneeTag key={aIdx}>
                            {name}
                            <DeleteTagBtn 
                              type="button" 
                              onClick={() => handleDeleteAssignee(manager, name)}
                              title="삭제"
                            >
                              ✕
                            </DeleteTagBtn>
                          </AssigneeTag>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: colors.textMuted, fontStyle: 'italic', paddingLeft: '4px' }}>
                          제출자 없음
                        </span>
                      )}
                    </AssigneeTags>
                    
                    {/* 개별 추가 폼 */}
                    <QuickAddForm onSubmit={(e) => handleAddAssigneeSubmit(manager, e)}>
                      <MiniInput
                        type="text"
                        placeholder="이름 추가..."
                        value={newAssigneeInputs[manager] || ''}
                        onChange={(e) => setNewAssigneeInputs(prev => ({ ...prev, [manager]: e.target.value }))}
                      />
                      <MiniButton type="submit">추가</MiniButton>
                    </QuickAddForm>
                  </AssignmentRow>
                ))}
              </AssignmentTable>
            ) : (
              <EmptyState>배정된 담당자 정보가 없습니다.</EmptyState>
            )}
          </CardBody>
          
          {/* 하단 변경사항 저장 제어바 */}
          <ActionFooter>
            {toast && <ToastMessage type={toast.type}>{toast.text}</ToastMessage>}
            <ResetButton 
              type="button" 
              onClick={handleReset} 
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
      )}
    </Grid>
  );
}
