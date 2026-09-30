import { describe, expect, it } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../src/config.js';
import { DEFAULT_CONFIG } from '../src/types.js';

const TMP = join(tmpdir(), 'acl-test-config');

function setup(): string {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  return TMP;
}

function cleanup(): void {
  rmSync(TMP, { recursive: true, force: true });
}

describe('loadConfig', () => {
  it('returns defaults when no config file exists', () => {
    const dir = setup();
    try {
      expect(loadConfig(dir)).toEqual(DEFAULT_CONFIG);
    } finally {
      cleanup();
    }
  });

  it('loads and merges .agent-context-lint.json overrides', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, '.agent-context-lint.json'),
        JSON.stringify({
          staleDateYears: 5,
          agentDirs: ['custom-agents'],
        }),
      );
      const config = loadConfig(dir);
      expect(config.staleDateYears).toBe(5);
      expect(config.agentDirs).toEqual(['custom-agents']);
      // Unspecified fields fall back to defaults
      expect(config.tokenBudget).toEqual(DEFAULT_CONFIG.tokenBudget);
    } finally {
      cleanup();
    }
  });

  it('falls back to defaults when .agent-context-lint.json is invalid JSON', () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, '.agent-context-lint.json'), '{ not valid json');
      expect(loadConfig(dir)).toEqual(DEFAULT_CONFIG);
    } finally {
      cleanup();
    }
  });

  it('loads overrides from package.json "agentContextLint" key', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({
          name: 'test-pkg',
          agentContextLint: { ignore: ['CHANGELOG.md'] },
        }),
      );
      const config = loadConfig(dir);
      expect(config.ignore).toEqual(['CHANGELOG.md']);
    } finally {
      cleanup();
    }
  });

  it('falls back to defaults when package.json is invalid JSON', () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, 'package.json'), '{ not valid json');
      expect(loadConfig(dir)).toEqual(DEFAULT_CONFIG);
    } finally {
      cleanup();
    }
  });

  it('prefers .agent-context-lint.json over package.json when both exist', () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, '.agent-context-lint.json'), JSON.stringify({ staleDateYears: 1 }));
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ agentContextLint: { staleDateYears: 9 } }),
      );
      expect(loadConfig(dir).staleDateYears).toBe(1);
    } finally {
      cleanup();
    }
  });
});
