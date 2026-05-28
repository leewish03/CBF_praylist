import React from 'react';
import styled from 'styled-components';

const MarkdownContainer = styled.div`
  line-height: 1.6;
  font-size: 0.85rem;
`;

const Paragraph = styled.p`
  margin-bottom: 6px;
  white-space: pre-wrap;
  color: inherit;
  font-size: inherit;
`;

const BulletList = styled.ul`
  margin-left: 20px;
  margin-bottom: 6px;
  list-style-type: disc;
  color: inherit;
`;

const BulletItem = styled.li`
  margin-bottom: 4px;
  color: inherit;
  font-size: 0.82rem;
`;

export default function MarkdownText({ text }) {
  if (!text) return null;

  // 줄바꿈으로 분할하여 마크다운 글머리 기호(-, *, +) 해석
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
    if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('+')) {
      const content = trimmed.substring(1).trim();
      currentList.push(content);
    } else {
      flushList(idx);
      if (trimmed) {
        elements.push(<Paragraph key={idx}>{line}</Paragraph>);
      }
    }
  });

  flushList('final');

  return <MarkdownContainer>{elements}</MarkdownContainer>;
}
