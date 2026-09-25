import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AGENT_AUTODISCOVER_DIR, AGENT_FILE_SUFFIX, CONTEXT_FILE_NAMES } from './types.js';

export function discoverContextFiles(cwd: string): string[] {
  const found: string[] = [];
  for (const name of CONTEXT_FILE_NAMES) {
    const fullPath = resolve(cwd, name);
    if (existsSync(fullPath)) {
      found.push(fullPath);
    }
  }

  const agentsDir = resolve(cwd, AGENT_AUTODISCOVER_DIR);
  if (existsSync(agentsDir)) {
    for (const entry of readdirSync(agentsDir)) {
      if (entry.endsWith(AGENT_FILE_SUFFIX)) {
        found.push(resolve(agentsDir, entry));
      }
    }
  }

  return found;
}
