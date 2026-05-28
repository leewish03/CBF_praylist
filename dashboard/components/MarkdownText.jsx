import React from 'react';
import styled from 'styled-components';
import colors from '../styles/colors';

const MarkdownContainer = styled.div`
  line-height: 1.6;
  font-size: 0.85rem;
  color: ${colors.textPrimary};
`;

const Paragraph = styled.p`
  margin-bottom: 8px;
  white-space: pre-wrap;
  color: ${colors.textPrimary};
  font-size: 0.85rem;
  font-weight: 400;
`;

const Heading3 = styled.h3`
  font-size: 0.95rem;
  font-weight: 600;
  color: ${colors.primary};
  margin-top: 2px;
  margin-bottom: 12px;
  line-height: 1.45;
  letter-spacing: -0.02em;
`;

const BulletList = styled.ul`
  margin-left: 2px;
  margin-bottom: 6px;
  list-style-type: none;
  padding-left: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const BulletItem = styled.li`
  position: relative;
  padding-left: 18px;
  font-size: 0.82rem;
  color: ${colors.textSecondary};
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: -0.01em;

  &::before {
    content: "•";
    position: absolute;
    left: 4px;
    top: -1px;
    color: ${colors.primaryMid};
    font-size: 0.95rem;
  }
`;

const NumberedItem = styled.div`
  margin-top: 8px;
  margin-bottom: 8px;
  display: flex;
  gap: 8px;
  align-items: flex-start;
  color: ${colors.textPrimary};
`;

const NumberText = styled.span`
  min-width: 18px;
  font-weight: 700;
  color: ${colors.primary};
`;

const NumberContent = styled.span`
  font-weight: 500;
  color: inherit;
`;

export default function MarkdownText({ text }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let currentList = [];

  const flushList = (key) => {
    if (currentList.length > 0) {
      elements.push(
        <BulletList key={`list-${key}`}>
          {currentList.map((item, idx) => (
            <BulletItem key={idx}>{item}</BulletItem>
          ))}
        </BulletList>
      );
      currentList = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    
    // 1. ## 헤더 감지
    if (trimmed.startsWith('##')) {
      flushList(idx);
      const content = trimmed.substring(2).trim();
      elements.push(<Heading3 key={idx}>{content}</Heading3>);
    }
    // 2. 글머리 기호 (-, *, +) 감지
    else if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('+')) {
      const content = trimmed.substring(1).trim();
      currentList.push(content);
    } 
    // 3. 번호 리스트 (1., 2. 등) 감지
    else if (/^\d+\.\s/.test(trimmed)) {
      flushList(idx);
      const match = trimmed.match(/^(\d+)\.\s*(.*)/);
      if (match) {
        elements.push(
          <NumberedItem key={idx}>
            <NumberText>{match[1]}.</NumberText>
            <NumberContent>{match[2]}</NumberContent>
          </NumberedItem>
        );
      }
    } 
    // 4. 일반 텍스트
    else {
      flushList(idx);
      if (trimmed) {
        elements.push(<Paragraph key={idx}>{line}</Paragraph>);
      }
    }
  });

  flushList('final');

  return <MarkdownContainer>{elements}</MarkdownContainer>;
}
