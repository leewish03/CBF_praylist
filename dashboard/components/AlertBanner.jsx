/**
 * AlertBanner.jsx
 * 담당자 미지정 제출자가 존재할 때 표시되는 빨간 경고 배너 컴포넌트
 */

import React from 'react';
import styled, { keyframes } from 'styled-components';
import colors from '../styles/colors';

const pulse = keyframes`
  0%   { opacity: 1;   transform: scale(1);    }
  50%  { opacity: 0.7; transform: scale(1.02); }
  100% { opacity: 1;   transform: scale(1);    }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0);    }
`;

const AlertBannerWrapper = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 18px;
  background: ${colors.dangerLight};
  border: 1px solid ${colors.danger}44;
  border-radius: 6px;
  margin-bottom: 16px;
  animation: ${fadeIn} 0.35s ease;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.02);
`;

const AlertIcon = styled.span`
  font-size: 1.15rem;
  flex-shrink: 0;
  color: ${colors.danger};
`;

const AlertContent = styled.div`
  h4 {
    font-size: 0.88rem;
    font-weight: 600;
    color: ${colors.danger};
    margin-bottom: 4px;
    letter-spacing: -0.01em;
  }

  p {
    font-size: 0.78rem;
    color: ${colors.danger};
    opacity: 0.9;
    line-height: 1.5;
    letter-spacing: -0.01em;
  }

  ul {
    margin-top: 8px;
    padding-left: 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    list-style: none;
    
    li {
      font-size: 0.75rem;
      background: ${colors.danger};
      color: #fff;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 500;
    }
  }
`;

export default function AlertBanner({ unmappedRequesters }) {
  if (!unmappedRequesters || unmappedRequesters.length === 0) return null;

  return (
    <AlertBannerWrapper>
      <AlertIcon>⚠️</AlertIcon>
      <AlertContent>
        <h4>담당자 미지정 제출자 감지됨</h4>
        <p>구글 스프레드시트의 <strong>[설정_담당자배정]</strong> 시트에 아래 제출자들의 담당자 매핑을 추가해 주세요. 지정되지 않은 제출자의 기도제목은 동기화 파이프라인에서 제외됩니다.</p>
        <ul>
          {unmappedRequesters.map((name, idx) => (
            <li key={idx}>{name}</li>
          ))}
        </ul>
      </AlertContent>
    </AlertBannerWrapper>
  );
}
