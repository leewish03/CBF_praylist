/**
 * Header.jsx
 * 대시보드 타이틀 및 Notion 페이지 바로가기 링크 버튼 컴포넌트 (Shadcn/ui 스타일 리팩토링)
 */

import React from 'react';
import styled, { keyframes } from 'styled-components';
import colors from '../styles/colors';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0);    }
`;

const HeaderWrapper = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 24px;
  padding: 20px 24px;
  background: ${colors.cardBg};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05);
  animation: ${fadeIn} 0.4s ease;

  @media (max-width: 768px) {
    padding: 16px;
  }
`;

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const HeaderEmoji = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 6px;
  background: ${colors.primaryLight};
  font-size: 1.4rem;
  border: 1px solid ${colors.primary}22;
`;

const HeaderText = styled.div`
  h1 {
    font-size: 1.25rem;
    font-weight: 600;
    color: ${colors.textPrimary};
    line-height: 1.2;
    letter-spacing: -0.02em;
    
    @media (max-width: 768px) {
      font-size: 1.1rem;
    }
  }
  
  p {
    font-size: 0.78rem;
    color: ${colors.textSecondary};
    margin-top: 4px;
    letter-spacing: -0.01em;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

// Shadcn/ui Button Variants 에뮬레이션
const HeaderButton = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s ease-in-out;
  cursor: pointer;
  white-space: nowrap;
  letter-spacing: -0.01em;

  /* default / primary variant */
  ${({ variant }) => variant === 'primary' && `
    background: ${colors.primary};
    color: #ffffff;
    border: 1px solid ${colors.primary};
    box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);
    
    &:hover {
      background: ${colors.primaryDark};
      border-color: ${colors.primaryDark};
    }
  `}

  /* outline variant */
  ${({ variant }) => variant === 'outline' && `
    background: ${colors.cardBg};
    color: ${colors.textPrimary};
    border: 1px solid ${colors.border};
    
    &:hover {
      background: ${colors.bg};
      color: ${colors.textPrimary};
    }
  `}

  /* secondary variant */
  ${({ variant }) => variant === 'secondary' && `
    background: ${colors.bg};
    color: ${colors.textPrimary};
    border: 1px solid ${colors.border};
    
    &:hover {
      background: ${colors.border};
    }
  `}
`;

export default function Header({ notionPageUrl, isAdmin, onNavigate }) {
  const handleNav = (path, e) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    }
  };

  return (
    <HeaderWrapper>
      <HeaderTitle>
        <HeaderEmoji>{isAdmin ? '⚙️' : '🙏'}</HeaderEmoji>
        <HeaderText>
          <h1>{isAdmin ? 'CBF 기도제목 관리자 대시보드' : 'CBF 기도제목 뷰어'}</h1>
          <p>
            {isAdmin 
              ? '설정 변경, 파이프라인 트리거 및 로그 모니터링' 
              : '오늘의 CBF 공동 기도제목 및 구도자 기도제목'}
          </p>
        </HeaderText>
      </HeaderTitle>
      <ButtonContainer>
        {notionPageUrl && (
          <HeaderButton
            href={notionPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
          >
            📓 Notion 페이지
          </HeaderButton>
        )}
        {isAdmin ? (
          <HeaderButton
            href="/"
            onClick={(e) => handleNav('/', e)}
            variant="secondary"
          >
            🙏 기도팀 화면
          </HeaderButton>
        ) : (
          <HeaderButton
            href="/admin"
            onClick={(e) => handleNav('/admin', e)}
            variant="primary"
          >
            ⚙️ 관리자 도구
          </HeaderButton>
        )}
      </ButtonContainer>
    </HeaderWrapper>
  );
}
