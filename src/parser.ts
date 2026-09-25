import { readFileSync } from 'node:fs';
import type { Frontmatter } from './types.js';

export interface ParsedFile {
  content: string;
  lines: string[];
  paths: PathReference[];
  commands: CommandReference[];
  sections: string[];
  codeBlocks: CodeBlock[];
  inlineCode: InlineCode[];
  frontmatter?: Frontmatter;
}

export interface PathReference {
  value: string;
  line: number;
  column: number;
}

export interface CommandReference {
  value: string;
  line: number;
  column: number;
}

export interface CodeBlock {
  content: string;
  lang: string;
  line: number;
}

export interface InlineCode {
  content: string;
  line: number;
  column: number;
}

const PATH_PATTERN = /(?:^|\s|`)(\.?\.?\/[\w./@-]+[\w/@-])/g;
const COMMAND_PATTERN = /(?:npm|npx|pnpm|yarn|bun|bunx)\s+(?:run\s+)?[\w:@./-]+/g;
const HEADING_PATTERN = /^#{1,6}\s+(.+)$/;
const FENCED_BLOCK_START = /^```(\w*)/;
const FENCED_BLOCK_END = /^```\s*$/;
const INLINE_CODE_PATTERN = /`([^`]+)`/g;
const FRONTMATTER_FIELD_PATTERN = /^([A-Za-z0-9_-]+):\s*(.*)$/;

// Only handles a top-level --- delimited block with flat `key: value` lines;
// indented/nested values (e.g. under `hooks`) are intentionally not parsed.
function parseFrontmatter(lines: string[]): Frontmatter | undefined {
  if (lines[0]?.trim() !== '---') return undefined;

  let endLine = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endLine = i + 1;
      break;
    }
  }
  if (endLine === -1) return undefined;

  const fields: Record<string, string> = {};
  for (let i = 1; i < endLine - 1; i++) {
    const match = FRONTMATTER_FIELD_PATTERN.exec(lines[i]);
    if (match) {
      fields[match[1]] = match[2].trim();
    }
  }

  return { raw: lines.slice(0, endLine).join('\n'), startLine: 1, endLine, fields };
}

export function parseFile(filePath: string): ParsedFile {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const frontmatter = parseFrontmatter(lines);

  const paths: PathReference[] = [];
  const commands: CommandReference[] = [];
  const sections: string[] = [];
  const codeBlocks: CodeBlock[] = [];
  const inlineCode: InlineCode[] = [];

  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockContent = '';
  let codeBlockStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Track fenced code blocks
    if (!inCodeBlock) {
      const blockStart = FENCED_BLOCK_START.exec(line);
      if (blockStart && line.trimStart().startsWith('```')) {
        inCodeBlock = true;
        codeBlockLang = blockStart[1] || '';
        codeBlockContent = '';
        codeBlockStart = lineNum;
        continue;
      }
    } else {
      if (FENCED_BLOCK_END.test(line) && line.trimStart() === '```') {
        codeBlocks.push({
          content: codeBlockContent,
          lang: codeBlockLang,
          line: codeBlockStart,
        });
        inCodeBlock = false;
        continue;
      }
      codeBlockContent += (codeBlockContent ? '\n' : '') + line;
    }

    // Extract headings as sections
    const headingMatch = HEADING_PATTERN.exec(line);
    if (headingMatch) {
      sections.push(headingMatch[1].trim());
    }

    // Extract paths from both inline code and plain text
    let pathMatch: RegExpExecArray | null;
    PATH_PATTERN.lastIndex = 0;
    while ((pathMatch = PATH_PATTERN.exec(line)) !== null) {
      const value = pathMatch[1];
      // Skip URLs
      if (value.includes('://')) continue;
      paths.push({
        value,
        line: lineNum,
        column: pathMatch.index + (pathMatch[0].length - value.length) + 1,
      });
    }

    // Extract npm/pnpm/yarn/bun commands
    let cmdMatch: RegExpExecArray | null;
    COMMAND_PATTERN.lastIndex = 0;
    while ((cmdMatch = COMMAND_PATTERN.exec(line)) !== null) {
      commands.push({
        value: cmdMatch[0],
        line: lineNum,
        column: cmdMatch.index + 1,
      });
    }

    // Extract inline code spans
    if (!inCodeBlock) {
      let inlineMatch: RegExpExecArray | null;
      INLINE_CODE_PATTERN.lastIndex = 0;
      while ((inlineMatch = INLINE_CODE_PATTERN.exec(line)) !== null) {
        inlineCode.push({
          content: inlineMatch[1],
          line: lineNum,
          column: inlineMatch.index + 2,
        });
      }
    }
  }

  return { content, lines, paths, commands, sections, codeBlocks, inlineCode, frontmatter };
}
