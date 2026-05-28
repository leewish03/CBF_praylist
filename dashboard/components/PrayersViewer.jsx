/**
 * PrayersViewer.jsx
 * 수집된 개별 구도자 기도제목을 조회할 수 있는 카드 뷰어 컴포넌트
 * 담당자(Manager)별 필터 탭 기능을 탑재하고 있습니다.
 */

import React from 'react';
import styled, { keyframes } from 'styled-components';
import colors from '../styles/colors';

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
  margin-bottom: 16px;
  
  h2 {
    font-size: 1.1rem;
    font-weight: 700;
    color: ${colors.primary};
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;

const UpdateBadge = styled.span`
  font-size: 0.76rem;
  color: ${colors.textSecondary};
  background: ${colors.bg};
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid ${colors.border};
`;

const FilterTabContainer = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 8px;
  margin-bottom: 16px;
  scrollbar-width: thin;
  
  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${colors.border};
    border-radius: 4px;
  }
`;

const TabButton = styled.button`
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.82rem;
  font-weight: 600;
  border: 1px solid ${({ active }) => active ? colors.primary : colors.border};
  background: ${({ active }) => active ? colors.primary : colors.cardBg};
  color: ${({ active }) => active ? '#fff' : colors.textPrimary};
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  box-shadow: ${({ active }) => active ? '0 2px 6px hsla(142, 35%, 28%, 0.25)' : 'none'};

  &:hover {
    background: ${({ active }) => active ? colors.primaryDark : colors.primaryLight};
    border-color: ${colors.primary};
    color: ${({ active }) => active ? '#fff' : colors.primary};
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

const PrayerCard = styled.div`
  background: ${colors.cardBg};
  border: 1px solid ${colors.border};
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px hsla(0, 0%, 0%, 0.04);
  transition: transform 0.2s, box-shadow 0.2s;
  animation: ${fadeIn} 0.3s ease both;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px hsla(0, 0%, 0%, 0.08);
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
`;

const RequesterName = styled.span`
  font-size: 0.88rem;
  font-weight: 700;
  color: ${colors.textPrimary};
`;

const ManagerBadge = styled.span`
  font-size: 0.72rem;
  font-weight: 600;
  background: ${colors.primaryLight};
  color: ${colors.primary};
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid ${colors.primary}22;
`;

const TargetMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 0.78rem;
  color: ${colors.textSecondary};
`;

const MetaTag = styled.span`
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  padding: 1px 6px;
  border-radius: 4px;
`;

const TargetInfoSection = styled.div`
  margin-bottom: 12px;
`;

const TargetName = styled.h4`
  font-size: 0.95rem;
  font-weight: 700;
  color: ${colors.primaryDark};
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  
  span {
    font-size: 0.8rem;
    font-weight: normal;
    color: ${colors.textSecondary};
  }
`;

const ContentBox = styled.div`
  background: ${colors.primaryLight}44;
  border: 1px solid ${colors.primaryLight};
  border-radius: 8px;
  padding: 12px;
  font-size: 0.82rem;
  color: ${colors.textPrimary};
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  min-height: 80px;
`;

const EmptyState = styled.div`
  background: ${colors.cardBg};
  border: 1px dashed ${colors.border};
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  color: ${colors.textSecondary};
  font-size: 0.85rem;
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
                {prayer.prayer_content || '기도제목 내용이 없습니다.'}
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
