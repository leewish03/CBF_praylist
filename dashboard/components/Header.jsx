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

const NotionButton = styled.a`
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

export default function Header({ notionPageUrl }) {
  return (
    <HeaderWrapper>
      <HeaderTitle>
        <HeaderEmoji>🙏</HeaderEmoji>
        <HeaderText>
          <h1>CBF 기도제목 자동화 대시보드</h1>
          <p>Google Sheets → Notion 자동 동기화 파이프라인</p>
        </HeaderText>
      </HeaderTitle>
      {notionPageUrl && (
        <NotionButton
          href={notionPageUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          📓 Notion 페이지 열기
        </NotionButton>
      )}
    </HeaderWrapper>
  );
}
