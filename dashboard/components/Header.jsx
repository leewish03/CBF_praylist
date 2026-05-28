/**
 * Header.jsx
 * 대시보드 타이틀 및 Notion 페이지 바로가기 링크 버튼 컴포넌트
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
  background: ${colors.primary};
  border-radius: 16px;
  box-shadow: 0 4px 20px hsla(142, 35%, 28%, 0.25);
  animation: ${fadeIn} 0.4s ease;

  @media (max-width: 768px) {
    padding: 16px;
    border-radius: 12px;
  }
`;

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const HeaderEmoji = styled.span`
  font-size: 2rem;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
`;

const HeaderText = styled.div`
  h1 {
    font-size: 1.3rem;
    font-weight: 700;
    color: #fff;
    line-height: 1.3;
    
    @media (max-width: 768px) {
      font-size: 1.1rem;
    }
  }
  
  p {
    font-size: 0.8rem;
    color: hsla(0, 0%, 100%, 0.75);
    margin-top: 2px;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const HeaderButton = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: hsla(0, 0%, 100%, 0.15);
  color: #fff;
  border: 1px solid hsla(0, 0%, 100%, 0.3);
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.2s, border-color 0.2s;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: hsla(0, 0%, 100%, 0.25);
    border-color: hsla(0, 0%, 100%, 0.5);
  }
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
          >
            📓 Notion 페이지
          </HeaderButton>
        )}
        {isAdmin ? (
          <HeaderButton
            href="/"
            onClick={(e) => handleNav('/', e)}
            style={{ background: 'hsla(142, 30%, 45%, 0.4)', borderColor: 'hsla(142, 30%, 45%, 0.6)' }}
          >
            🙏 기도팀 화면으로
          </HeaderButton>
        ) : (
          <HeaderButton
            href="/admin"
            onClick={(e) => handleNav('/admin', e)}
          >
            ⚙️ 관리자 도구
          </HeaderButton>
        )}
      </ButtonContainer>
    </HeaderWrapper>
  );
}
