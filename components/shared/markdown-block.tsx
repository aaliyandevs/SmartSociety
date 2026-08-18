import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Minimal, safe Markdown renderer for society guidelines and long-form notices.
 *
 * It builds real React elements rather than injecting HTML, so nothing entered
 * by an administrator can execute as script (XSS protection). Supported syntax:
 * `#`–`####` headings, `-`/`*` bullets, `1.` numbered lists, `**bold**`,
 * `*italic*`, `` `code` `` and blank-line-separated paragraphs.
 */

type Block =
  | { kind: 'heading'; level: 2 | 3 | 4 | 5; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'numbers'; items: string[] }
  | { kind: 'paragraph'; text: string };

function parse(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  let numbers: string[] = [];

  const flush = () => {
    if (paragraph.length) {
      blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
    if (bullets.length) {
      blocks.push({ kind: 'bullets', items: bullets });
      bullets = [];
    }
    if (numbers.length) {
      blocks.push({ kind: 'numbers', items: numbers });
      numbers = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim() === '') {
      flush();
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const level = Math.min(5, heading[1].length + 1) as 2 | 3 | 4 | 5;
      blocks.push({ kind: 'heading', level, text: heading[2] });
      continue;
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (paragraph.length || numbers.length) flush();
      bullets.push(bullet[1]);
      continue;
    }

    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      if (paragraph.length || bullets.length) flush();
      numbers.push(numbered[1]);
      continue;
    }

    if (bullets.length || numbers.length) flush();
    paragraph.push(line.trim());
  }

  flush();
  return blocks;
}

/** Renders `**bold**`, `*italic*` and `` `code` `` as elements, never HTML. */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;

    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

const HEADING_CLASSES: Record<number, string> = {
  2: 'mt-8 text-xl font-semibold tracking-tight first:mt-0',
  3: 'mt-6 text-base font-semibold tracking-tight first:mt-0',
  4: 'mt-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground first:mt-0',
  5: 'mt-4 text-sm font-semibold first:mt-0',
};

export function MarkdownBlock({ content, className }: { content: string; className?: string }) {
  const blocks = React.useMemo(() => parse(content), [content]);

  return (
    <div className={cn('space-y-3 text-sm leading-relaxed', className)}>
      {blocks.map((block, index) => {
        const key = `block-${index}`;

        if (block.kind === 'heading') {
          const Tag = `h${block.level}` as 'h2' | 'h3' | 'h4' | 'h5';
          return (
            <Tag key={key} className={HEADING_CLASSES[block.level]}>
              {inline(block.text, key)}
            </Tag>
          );
        }

        if (block.kind === 'bullets') {
          return (
            <ul key={key} className="list-disc space-y-1.5 pl-5 text-muted-foreground">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{inline(item, `${key}-${itemIndex}`)}</li>
              ))}
            </ul>
          );
        }

        if (block.kind === 'numbers') {
          return (
            <ol key={key} className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{inline(item, `${key}-${itemIndex}`)}</li>
              ))}
            </ol>
          );
        }

        return (
          <p key={key} className="text-muted-foreground">
            {inline(block.text, key)}
          </p>
        );
      })}
    </div>
  );
}
