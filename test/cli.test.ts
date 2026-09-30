import { describe, expect, it, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  expandFileArg,
  getGitHubActionInputs,
  globToRegExp,
  isContextFileName,
  parseArgs,
} from '../src/cli.js';

const TMP = join(tmpdir(), 'acl-test-cli');

function setup(files: string[]): string {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  for (const name of files) {
    const dir = join(TMP, name.includes('/') ? name.split('/').slice(0, -1).join('/') : '');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(TMP, name), '# placeholder');
  }
  return TMP;
}

function cleanup(): void {
  rmSync(TMP, { recursive: true, force: true });
}

describe('isContextFileName', () => {
  it('recognizes well-known context file names', () => {
    expect(isContextFileName('CLAUDE.md')).toBe(true);
    expect(isContextFileName('AGENTS.md')).toBe(true);
    expect(isContextFileName('.cursorrules')).toBe(true);
  });

  it('recognizes *.agent.md files', () => {
    expect(isContextFileName('my-agent.agent.md')).toBe(true);
  });

  it('rejects unrelated file names', () => {
    expect(isContextFileName('README.md')).toBe(false);
  });
});

describe('globToRegExp', () => {
  it('matches * against any non-separator characters', () => {
    const re = globToRegExp('*.md');
    expect(re.test('foo.md')).toBe(true);
    expect(re.test('foo.agent.md')).toBe(true);
    expect(re.test('foo.txt')).toBe(false);
  });

  it('matches ? against a single character', () => {
    const re = globToRegExp('a?c.md');
    expect(re.test('abc.md')).toBe(true);
    expect(re.test('ac.md')).toBe(false);
  });

  it('escapes regex special characters literally', () => {
    const re = globToRegExp('file(1).md');
    expect(re.test('file(1).md')).toBe(true);
    expect(re.test('file1.md')).toBe(false);
  });
});

describe('expandFileArg', () => {
  it('returns a single resolved path for a plain file arg', () => {
    const dir = setup(['CLAUDE.md']);
    try {
      const result = expandFileArg(dir, 'CLAUDE.md');
      expect(result).toHaveLength(1);
      expect(result[0]).toContain('CLAUDE.md');
    } finally {
      cleanup();
    }
  });

  it('recursively walks a directory arg for context files', () => {
    const dir = setup(['agents/a.agent.md', 'agents/nested/b.agent.md', 'README.md']);
    try {
      const result = expandFileArg(dir, 'agents');
      expect(result).toHaveLength(2);
    } finally {
      cleanup();
    }
  });

  it('expands a glob arg against its containing directory', () => {
    const dir = setup(['agents/a.agent.md', 'agents/b.agent.md', 'agents/c.txt']);
    try {
      const result = expandFileArg(dir, './agents/*.md');
      expect(result).toHaveLength(2);
    } finally {
      cleanup();
    }
  });

  it('returns an empty array for a glob whose directory does not exist', () => {
    const dir = setup(['CLAUDE.md']);
    try {
      const result = expandFileArg(dir, './missing/*.md');
      expect(result).toEqual([]);
    } finally {
      cleanup();
    }
  });
});

describe('parseArgs', () => {
  it('parses positional file arguments', () => {
    const options = parseArgs(['node', 'cli.js', 'CLAUDE.md', 'AGENTS.md']);
    expect(options.files).toEqual(['CLAUDE.md', 'AGENTS.md']);
    expect(options.format).toBe('text');
    expect(options.fix).toBe(false);
  });

  it('parses --format json', () => {
    const options = parseArgs(['node', 'cli.js', '--format', 'json']);
    expect(options.format).toBe('json');
  });

  it('parses --json shorthand', () => {
    const options = parseArgs(['node', 'cli.js', '--json']);
    expect(options.format).toBe('json');
  });

  it('parses --fix', () => {
    const options = parseArgs(['node', 'cli.js', '--fix', 'CLAUDE.md']);
    expect(options.fix).toBe(true);
    expect(options.files).toEqual(['CLAUDE.md']);
  });

  it('ignores an invalid --format value', () => {
    const options = parseArgs(['node', 'cli.js', '--format', 'xml']);
    expect(options.format).toBe('text');
  });
});

describe('getGitHubActionInputs', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns null when not running as the packaged GitHub Action', () => {
    delete process.env.GITHUB_ACTION_PATH;
    expect(getGitHubActionInputs()).toBeNull();
  });

  it('returns null even when GITHUB_ACTIONS=true but GITHUB_ACTION_PATH is unset (plain run: step)', () => {
    process.env.GITHUB_ACTIONS = 'true';
    delete process.env.GITHUB_ACTION_PATH;
    expect(getGitHubActionInputs()).toBeNull();
  });

  it('reads INPUT_FILES and INPUT_FORMAT when running as the packaged action', () => {
    process.env.GITHUB_ACTION_PATH = '/some/action/path';
    process.env.INPUT_FILES = 'CLAUDE.md AGENTS.md';
    process.env.INPUT_FORMAT = 'json';
    const options = getGitHubActionInputs();
    expect(options).not.toBeNull();
    expect(options?.files).toEqual(['CLAUDE.md', 'AGENTS.md']);
    expect(options?.format).toBe('json');
  });
});
