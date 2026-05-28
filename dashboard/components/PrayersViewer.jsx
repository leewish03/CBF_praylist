/**
 * PrayersViewer.jsx
 * 수집된 개별 구도자 기도제목을 조회할 수 있는 카드 뷰어 컴포넌트
 * 담당자(Manager)별 필터 탭 기능을 탑재하고 있습니다.
 */

import React from 'react';
import styled, { keyframes } from 'styled-components';
import colors from '../styles/colors';
import MarkdownText from './MarkdownText';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0);   }
`;

const SectionWrapper = styled.section`
  margin-bottom: 24px;
  animation: ${fadeIn} 0.4s ease;
`;

const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  
  h2 {
    font-size: 1rem;
    font-weight: 600;
    color: ${colors.textPrimary};
    letter-spacing: -0.01em;
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;

const UpdateBadge = styled.span`
  font-size: 0.72rem;
  color: ${colors.textSecondary};
  background: ${colors.bg};
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid ${colors.border};
`;

// Shadcn/ui TabsList 에뮬레이션
const FilterTabContainer = styled.div`
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 4px;
  margin-bottom: 16px;
  background: ${colors.bg};
  border-radius: 8px;
  border: 1px solid ${colors.border};
  scrollbar-width: none;
  
  &::-webkit-scrollbar {
    display: none;
  }
`;

// Shadcn/ui TabsTrigger 에뮬레이션
const TabButton = styled.button`
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 500;
  border: none;
  background: ${({ active }) => active ? colors.cardBg : 'transparent'};
  color: ${({ active }) => active ? colors.textPrimary : colors.textSecondary};
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease-in-out;
  box-shadow: ${({ active }) => active ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none'};
  letter-spacing: -0.01em;

  &:hover {
    color: ${colors.textPrimary};
    ${({ active }) => !active && `background: hsla(240, 4.8%, 95.9%, 0.5);`}
  }
`;

const PrayerGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

// Shadcn/ui Card 에뮬레이션
const PrayerCard = styled.div`
  background: ${colors.cardBg};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.02);
  transition: all 0.2s ease-in-out;
  animation: ${fadeIn} 0.3s ease both;
  
  &:hover {
    box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.05);
    border-color: ${colors.primary}33;
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid ${colors.bg};
  padding-bottom: 10px;
  margin-bottom: 12px;
`;

const RequesterInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  justify-content: space-between;
`;

const RequesterName = styled.span`
  font-size: 0.82rem;
  font-weight: 600;
  color: ${colors.textPrimary};
`;

// Shadcn/ui Badge 에뮬레이션
const ManagerBadge = styled.span`
  font-size: 0.7rem;
  font-weight: 500;
  background: ${colors.primaryLight};
  color: ${colors.primary};
  padding: 2px 8px;
  border-radius: 9999px;
  border: 1px solid ${colors.primary}22;
`;

const TargetMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 0.72rem;
  color: ${colors.textSecondary};
`;

const MetaTag = styled.span`
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.72rem;
`;

const TargetInfoSection = styled.div`
  margin-bottom: 12px;
`;

const TargetName = styled.h4`
  font-size: 0.88rem;
  font-weight: 600;
  color: ${colors.primaryDark};
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  
  span {
    font-size: 0.75rem;
    font-weight: normal;
    color: ${colors.textSecondary};
  }
`;

const ContentBox = styled.div`
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 6px;
  padding: 12px;
  font-size: 0.82rem;
  color: ${colors.textPrimary};
  line-height: 1.6;
  min-height: 80px;
`;

const EmptyState = styled.div`
  background: ${colors.cardBg};
  border: 1px dashed ${colors.border};
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  color: ${colors.textSecondary};
  font-size: 0.8rem;
`;

export default function PrayersViewer({
  prayersData,
  assignments,
  selectedManager,
  setSelectedManager
}) {
  const syncSource = prayersData?.source;
  const lastUpdated = prayersData?.last_updated;
  const prayersByRequester = prayersData?.prayers_by_requester || {};

  // 전체 담당자 목록 가져오기
  const managers = Object.keys(assignments || {});
  
  // 1. 역매핑 맵 구성 (제출자 -> 담당자 이름)
  const requesterToManager = {};
  Object.entries(assignments || {}).forEach(([manager, requesters]) => {
    requesters.forEach(req => {
      requesterToManager[req] = manager;
    });
  });

  // 2. 전체 기도제목 평탄화(Flatten) 및 담당자 연결
  const allPrayers = [];
  Object.entries(prayersByRequester).forEach(([requester, items]) => {
    const manager = requesterToManager[requester] || '미배정';
    items.forEach(item => {
      allPrayers.push({
        ...item,
        requesterName: requester,
        managerName: manager
      });
    });
  });

  // 3. 필터링된 기도제목 목록 생성
  const filteredPrayers = allPrayers.filter(p => {
    if (!selectedManager || selectedManager === 'ALL') return true;
    return p.managerName === selectedManager;
  });

  return (
    <SectionWrapper>
      <SectionTitle>
        <h2>📋 수집된 구도자 기도제목 현황</h2>
        {lastUpdated && (
          <UpdateBadge>
            업데이트: {lastUpdated} ({syncSource === 'database' ? '데이터베이스' : '로컬 캐시'})
          </UpdateBadge>
        )}
      </SectionTitle>

      {/* 담당자 필터 탭 */}
      {managers.length > 0 && (
        <FilterTabContainer>
          <TabButton 
            active={!selectedManager || selectedManager === 'ALL'} 
            onClick={() => setSelectedManager('ALL')}
          >
            전체보기 ({allPrayers.length})
          </TabButton>
          {managers.map(m => {
            const count = allPrayers.filter(p => p.managerName === m).length;
            return (
              <TabButton
                key={m}
                active={selectedManager === m}
                onClick={() => setSelectedManager(m)}
              >
                {m} ({count})
              </TabButton>
            );
          })}
          {/* 미배정된 인원이 있는 경우 탭 추가 */}
          {allPrayers.some(p => p.managerName === '미배정') && (
            <TabButton
              active={selectedManager === '미배정'}
              onClick={() => setSelectedManager('미배정')}
              style={{ borderColor: colors.danger, color: selectedManager === '미배정' ? '#fff' : colors.danger }}
            >
              미배정 ({allPrayers.filter(p => p.managerName === '미배정').length})
            </TabButton>
          )}
        </FilterTabContainer>
      )}

      {/* 기도제목 그리드 */}
      {filteredPrayers.length > 0 ? (
        <PrayerGrid>
          {filteredPrayers.map((prayer, idx) => (
            <PrayerCard key={idx} style={{ animationDelay: `${idx * 0.03}s` }}>
              <CardHeader>
                <RequesterInfo>
                  <RequesterName>제출자: {prayer.requesterName}</RequesterName>
                  <ManagerBadge>{prayer.managerName} 담당</ManagerBadge>
                </RequesterInfo>
              </CardHeader>
              
              <TargetInfoSection>
                <TargetName>
                  {prayer.target_name || '이름 없음'} 
                  <span>(구도자)</span>
                </TargetName>
                
                <TargetMeta>
                  {prayer.relationship && <MetaTag>{prayer.relationship}</MetaTag>}
                  {prayer.gender && <MetaTag>{prayer.gender}</MetaTag>}
                  {prayer.age && <MetaTag>{prayer.age}</MetaTag>}
                  {prayer.church && <MetaTag>{prayer.church}</MetaTag>}
                </TargetMeta>
              </TargetInfoSection>
              
              <ContentBox>
                {prayer.prayer_content ? (
                  <MarkdownText text={prayer.prayer_content} />
                ) : (
                  '기도제목 내용이 없습니다.'
                )}
              </ContentBox>
            </PrayerCard>
          ))}
        </PrayerGrid>
      ) : (
        <EmptyState>
          {selectedManager && selectedManager !== 'ALL' 
            ? `담당자 [${selectedManager}]의 수집된 기도제목이 없습니다.`
            : "수집된 기도제목 데이터가 없습니다. 동기화를 시작해 보세요."}
        </EmptyState>
      )}
    </SectionWrapper>
  );
}
