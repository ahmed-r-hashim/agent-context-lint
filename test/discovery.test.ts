import { describe, expect, it } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverContextFiles } from '../src/discovery.js';

const TMP = join(tmpdir(), 'acl-test-discovery');

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

describe('discoverContextFiles', () => {
  it('finds CLAUDE.md', () => {
    const dir = setup(['CLAUDE.md']);
    try {
      const files = discoverContextFiles(dir);
      expect(files).toHaveLength(1);
      expect(files[0]).toContain('CLAUDE.md');
    } finally {
      cleanup();
    }
  });

  it('finds multiple context files', () => {
    const dir = setup(['CLAUDE.md', 'AGENTS.md', '.cursorrules']);
    try {
      const files = discoverContextFiles(dir);
      expect(files).toHaveLength(3);
    } finally {
      cleanup();
    }
  });

  it('finds .github/copilot-instructions.md', () => {
    const dir = setup(['.github/copilot-instructions.md']);
    try {
      const files = discoverContextFiles(dir);
      expect(files).toHaveLength(1);
      expect(files[0]).toContain('copilot-instructions.md');
    } finally {
      cleanup();
    }
  });

  it('returns empty for repos with no context files', () => {
    const dir = setup(['README.md']);
    try {
      const files = discoverContextFiles(dir);
      expect(files).toHaveLength(0);
    } finally {
      cleanup();
    }
  });
<<<<<<< Updated upstream
=======
<<<<<<< Updated upstream
=======
>>>>>>> Stashed changes

  it('finds .github/agents/*.agent.md files', () => {
    const dir = setup(['.github/agents/agile-coach.agent.md']);
    try {
      const files = discoverContextFiles(dir);
      expect(files).toHaveLength(1);
      expect(files[0]).toContain('agile-coach.agent.md');
    } finally {
      cleanup();
    }
  });

  it('finds top-level agents/*.agent.md files by default', () => {
    const dir = setup(['agents/api-designer.agent.md']);
    try {
      const files = discoverContextFiles(dir);
      expect(files).toHaveLength(1);
      expect(files[0]).toContain('api-designer.agent.md');
    } finally {
      cleanup();
    }
  });

  it('finds agent files across both default dirs at once', () => {
    const dir = setup([
      '.github/agents/agile-coach.agent.md',
      'agents/api-designer.agent.md',
    ]);
    try {
      const files = discoverContextFiles(dir);
      expect(files).toHaveLength(2);
    } finally {
      cleanup();
    }
  });

  it('respects a custom agentDirs override', () => {
    const dir = setup(['custom-agents/my-agent.agent.md', 'agents/ignored.agent.md']);
    try {
      const files = discoverContextFiles(dir, ['custom-agents']);
      expect(files).toHaveLength(1);
      expect(files[0]).toContain('my-agent.agent.md');
    } finally {
      cleanup();
    }
  });

<<<<<<< Updated upstream
=======
  it('dedupes a file reachable via two overlapping agentDirs entries', () => {
    const dir = setup(['agents/dup.agent.md']);
    try {
      const files = discoverContextFiles(dir, ['agents', 'agents']);
      expect(files).toHaveLength(1);
    } finally {
      cleanup();
    }
  });

>>>>>>> Stashed changes
  it('does not error when .github/agents does not exist', () => {
    const dir = setup(['CLAUDE.md']);
    try {
      const files = discoverContextFiles(dir);
      expect(files).toHaveLength(1);
    } finally {
      cleanup();
    }
  });
<<<<<<< Updated upstream
=======
>>>>>>> Stashed changes
>>>>>>> Stashed changes
});
