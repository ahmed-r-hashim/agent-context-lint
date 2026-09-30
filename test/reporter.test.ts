import { describe, expect, it } from 'vitest';
import { formatJson, formatText } from '../src/reporter.js';
import type { LintResult } from '../src/types.js';

const cwd = '/repo';

function makeResult(): LintResult {
  return {
    files: [
      {
        file: '/repo/CLAUDE.md',
        score: 70,
        findings: [
          {
            file: '/repo/CLAUDE.md',
            rule: 'check:paths',
            line: 3,
            column: 5,
            severity: 'error',
            message: 'Path does not exist: ./src/old-module.ts',
          },
          {
            file: '/repo/CLAUDE.md',
            rule: 'check:vague',
            line: 7,
            column: 1,
            severity: 'warning',
            message: 'Vague instruction: "follow best practices"',
          },
        ],
      },
    ],
    totalFindings: 2,
    errors: 1,
    warnings: 1,
  };
}

describe('formatText', () => {
  it('renders file path, score, and findings', () => {
    const output = formatText(makeResult(), cwd);
    expect(output).toContain('CLAUDE.md');
    expect(output).toContain('score: 70/100');
    expect(output).toContain('x Path does not exist: ./src/old-module.ts  [check:paths]');
    expect(output).toContain('! Vague instruction: "follow best practices"  [check:vague]');
    expect(output).toContain('2 problems (1 errors, 1 warnings)');
  });

  it('renders "No issues found." for a clean file', () => {
    const result: LintResult = {
      files: [{ file: '/repo/AGENTS.md', score: 100, findings: [] }],
      totalFindings: 0,
      errors: 0,
      warnings: 0,
    };
    const output = formatText(result, cwd);
    expect(output).toContain('No issues found.');
    expect(output).toContain('0 problems (0 errors, 0 warnings)');
  });
});

describe('formatJson', () => {
  it('produces valid JSON with relative file paths', () => {
    const output = formatJson(makeResult(), cwd);
    const parsed = JSON.parse(output);
    expect(parsed.totalFindings).toBe(2);
    expect(parsed.errors).toBe(1);
    expect(parsed.warnings).toBe(1);
    expect(parsed.files[0].file).toBe('CLAUDE.md');
    expect(parsed.files[0].findings).toHaveLength(2);
  });
});
