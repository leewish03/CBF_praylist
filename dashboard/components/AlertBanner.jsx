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
  border: 1px solid ${colors.danger}55;
  border-left: 4px solid ${colors.danger};
  border-radius: 10px;
  margin-bottom: 16px;
  animation: ${pulse} 2.5s ease-in-out infinite, ${fadeIn} 0.35s ease;
`;

const AlertIcon = styled.span`
  font-size: 1.3rem;
  flex-shrink: 0;
  margin-top: 1px;
`;

const AlertContent = styled.div`
  h4 {
    font-size: 0.9rem;
    font-weight: 700;
    color: ${colors.danger};
    margin-bottom: 4px;
  }

  p {
    font-size: 0.82rem;
    color: hsl(0, 50%, 40%);
  }

  ul {
    margin-top: 6px;
    padding-left: 18px;
    
    li {
      font-size: 0.82rem;
      color: hsl(0, 50%, 40%);
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
