import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AGENT_FILE_SUFFIX, CONTEXT_FILE_NAMES, DEFAULT_CONFIG } from './types.js';

export function discoverContextFiles(
  cwd: string,
  agentDirs: string[] = DEFAULT_CONFIG.agentDirs,
): string[] {
  const found: string[] = [];
  for (const name of CONTEXT_FILE_NAMES) {
    const fullPath = resolve(cwd, name);
    if (existsSync(fullPath)) {
      found.push(fullPath);
    }
  }

  const seen = new Set<string>();
  for (const dirName of agentDirs) {
    const agentsDir = resolve(cwd, dirName);
    if (!existsSync(agentsDir)) continue;
    for (const entry of readdirSync(agentsDir)) {
      if (!entry.endsWith(AGENT_FILE_SUFFIX)) continue;
      const fullPath = resolve(agentsDir, entry);
      if (seen.has(fullPath)) continue;
      seen.add(fullPath);
      found.push(fullPath);
    }
  }

  return found;
}
