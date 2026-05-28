import React from 'react';
import styled from 'styled-components';

const MarkdownContainer = styled.div`
  line-height: 1.65;
  font-size: 0.85rem;
  color: inherit;
`;

const Paragraph = styled.p`
  margin-bottom: 6px;
  white-space: pre-wrap;
  color: inherit;
  font-size: inherit;
`;

const BulletList = styled.ul`
  margin-left: 18px;
  margin-bottom: 8px;
  list-style-type: disc;
  color: inherit;
`;

const BulletItem = styled.li`
  margin-bottom: 4px;
  color: inherit;
  font-size: 0.82rem;
`;

const NumberedItem = styled.div`
  margin-top: 8px;
  margin-bottom: 6px;
  display: flex;
  gap: 6px;
  align-items: flex-start;
  color: inherit;
`;

const NumberText = styled.span`
  min-width: 18px;
  font-weight: 700;
  color: hsl(142, 35%, 28%);
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
    
    // 1. 글머리 기호 (-, *, +) 감지
    if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('+')) {
      const content = trimmed.substring(1).trim();
      currentList.push(content);
    } 
    // 2. 번호 리스트 (1., 2. 등) 감지
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
    // 3. 일반 텍스트
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
