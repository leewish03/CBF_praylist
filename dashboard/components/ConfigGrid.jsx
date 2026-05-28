/**
 * ConfigGrid.jsx
 * 구글 시트에서 가져온 설정 데이터(공통 기도제목, 담당자 매핑)를 렌더링하는 그리드 카드 컴포넌트
 */

import React from 'react';
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
  gap: 16px;
  margin-bottom: 16px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div`
  background: ${colors.cardBg};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  animation: ${fadeIn} 0.35s ease;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid ${colors.border};
  background: transparent;

  h3 {
    font-size: 0.88rem;
    font-weight: 600;
    color: ${colors.textPrimary};
    letter-spacing: -0.01em;
  }
`;

const CardBody = styled.div`
  padding: 20px;
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
  margin-left: auto;
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
  gap: 10px;
  padding: 12px 14px;
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 6px;
  animation: ${slideIn} 0.3s ease both;
  animation-delay: ${({ idx }) => idx * 0.05}s;
`;

const PrayerNum = styled.span`
  font-size: 0.8rem;
  font-weight: 700;
  color: ${colors.primary};
  min-width: 18px;
  padding-top: 1px;
`;

const PrayerText = styled.div`
  font-size: 0.82rem;
  color: ${colors.textPrimary};
  line-height: 1.6;
`;

const AssignmentTable = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const AssignmentRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: ${colors.cardBg};
  border: 1px solid ${colors.border};
  border-radius: 6px;
  animation: ${slideIn} 0.3s ease both;
  animation-delay: ${({ idx }) => idx * 0.04}s;
  transition: all 0.2s ease;

  &:hover {
    background: ${colors.bg};
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.02);
  }
`;

const ManagerName = styled.span`
  font-size: 0.8rem;
  font-weight: 600;
  color: ${colors.primary};
  min-width: 60px;
  padding: 2px 6px;
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
  gap: 5px;
  padding-top: 1px;
`;

const AssigneeTag = styled.span`
  padding: 2px 8px;
  background: ${colors.bg};
  color: ${colors.textSecondary};
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 500;
  border: 1px solid ${colors.border};
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
  font-size: 0.82rem;
`;

export default function ConfigGrid({
  isConfigLoading,
  configError,
  commonPrayers,
  prayerSource,
  assignments,
  assignSource,
  onManagerClick,
  isAdmin = true
}) {
  const isSheetPrayer = prayerSource === 'google_sheets';
  const isSheetAssign = assignSource === 'google_sheets';
  const singleColumn = !isAdmin;

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

  const managerEntries = Object.entries(assignments);

  return (
    <Grid singleColumn={singleColumn}>
      {/* ── 공통 기도제목 카드 ── */}
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

      {/* ── 담당자 배정 현황 카드 ── */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <h3>👥 담당자 지정 현황</h3>
            {assignSource && (
              <SourceTag isSheet={isSheetAssign}>
                {isSheetAssign ? '🟢 구글 시트' : '🟠 내장 기본값'}
              </SourceTag>
            )}
          </CardHeader>
          <CardBody>
            {managerEntries.length > 0 ? (
              <AssignmentTable>
                {managerEntries.map(([manager, assignees], idx) => (
                  <AssignmentRow key={manager} idx={idx}>
                    <ManagerName onClick={() => onManagerClick && onManagerClick(manager)}>
                      {manager}
                    </ManagerName>
                    <AssigneeTags>
                      {assignees.length > 0 ? (
                        assignees.map((name, aIdx) => (
                          <AssigneeTag key={aIdx}>{name}</AssigneeTag>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: colors.textMuted, fontStyle: 'italic' }}>
                          배정 없음
                        </span>
                      )}
                    </AssigneeTags>
                  </AssignmentRow>
                ))}
              </AssignmentTable>
            ) : (
              <EmptyState>배정된 담당자 정보가 없습니다.</EmptyState>
            )}
          </CardBody>
        </Card>
      )}
    </Grid>
  );
}
