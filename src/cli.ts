import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixFile } from './fixer.js';
import { lint } from './index.js';
import { formatJson, formatText } from './reporter.js';
import { CONTEXT_FILE_NAMES, isAgentFile, type CLIOptions } from './types.js';

function getVersion(): string {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return pkg.version;
}

const GLOB_CHARS = /[*?[\]]/;
const SKIP_DIRS = new Set(['node_modules', '.git']);
const CONTEXT_BASENAMES = new Set(CONTEXT_FILE_NAMES.map((name) => basename(name)));

function isContextFileName(name: string): boolean {
  return isAgentFile(name) || CONTEXT_BASENAMES.has(name);
}

function globToRegExp(pattern: string): RegExp {
  let source = '';
  for (const ch of pattern) {
    if (ch === '*') source += '[^/\\\\]*';
    else if (ch === '?') source += '[^/\\\\]';
    else source += ch.replace(/[.+^${}()|\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
}

function walkDir(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walkDir(fullPath));
    } else if (isContextFileName(entry.name)) {
      found.push(fullPath);
    }
  }
  return found;
}

// Expands a CLI arg into concrete file paths: directories are walked recursively
// for recognized context files, simple globs (*, ?) are matched against their
// containing directory (for shells like PowerShell/cmd that don't expand globs
// themselves), and anything else is returned as-is.
function expandFileArg(cwd: string, arg: string): string[] {
  const resolved = resolve(cwd, arg);

  if (GLOB_CHARS.test(arg)) {
    const dir = dirname(resolved);
    const pattern = globToRegExp(basename(resolved));
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((name) => pattern.test(name))
      .map((name) => join(dir, name));
  }

  if (existsSync(resolved) && statSync(resolved).isDirectory()) {
    return walkDir(resolved);
  }

  return [resolved];
}

function getGitHubActionInputs(): CLIOptions | null {
  if (process.env.GITHUB_ACTIONS !== 'true') return null;

  const files = (process.env.INPUT_FILES || '').split(/\s+/).filter(Boolean);
  const format = process.env.INPUT_FORMAT === 'json' ? 'json' as const : 'text' as const;

  return {
    files,
    format,
    fix: false,
    cwd: process.cwd(),
  };
}

function parseArgs(argv: string[]): CLIOptions {
  const args = argv.slice(2);
  const options: CLIOptions = {
    files: [],
    format: 'text',
    fix: false,
    cwd: process.cwd(),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--format' && args[i + 1]) {
      const fmt = args[++i];
      if (fmt === 'json' || fmt === 'text') {
        options.format = fmt;
      }
    } else if (arg === '--json') {
      options.format = 'json';
    } else if (arg === '--fix') {
      options.fix = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--version' || arg === '-V') {
      console.log(getVersion());
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      options.files.push(arg);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
  agent-context-lint — Lint AI coding agent context files

  Usage:
    npx agent-context-lint              Auto-discover and lint all context files
    npx agent-context-lint CLAUDE.md    Lint a specific file
    npx agent-context-lint ./agents     Lint a directory of custom-agent files
    npx agent-context-lint ./agents/*.md  Lint files matching a glob
    npx agent-context-lint --format json  Machine-readable output for CI
    npx agent-context-lint --fix CLAUDE.md  Auto-fix safe issues then lint

  Options:
    --format <text|json>  Output format (default: text)
    --json                Shorthand for --format json
    --fix                 Auto-fix safe issues (trailing whitespace, blank lines, trailing newline)
    -V, --version         Show version
    -h, --help            Show this help

  Context files detected:
    CLAUDE.md, AGENTS.md, .cursorrules, copilot-instructions.md,
    .github/copilot-instructions.md

  Configuration:
    .agent-context-lint.json or "agentContextLint" key in package.json

  GitHub Action:
    uses: mattschaller/agent-context-lint@v0
    with:
      files: 'CLAUDE.md AGENTS.md'
      format: text
`);
}

function main(): void {
  const options = getGitHubActionInputs() || parseArgs(process.argv);
  const expandedFiles = options.files.flatMap((f) => expandFileArg(options.cwd, f));

  // Run fix before lint if requested
  if (options.fix) {
    for (const file of expandedFiles) {
      const fixResult = fixFile(file);
      if (fixResult.fixed) {
        console.log(`Fixed ${file}:`);
        for (const change of fixResult.changes) {
          console.log(`  line ${change.line}: ${change.description}`);
        }
        console.log();
      }
    }
  }

  const result = lint(
    options.cwd,
    expandedFiles.length > 0 ? expandedFiles : undefined,
  );

  if (result.files.length === 0) {
    console.log('No context files found.');
    process.exit(0);
  }

  const output =
    options.format === 'json'
      ? formatJson(result, options.cwd)
      : formatText(result, options.cwd);

  console.log(output);
  process.exit(result.errors > 0 ? 1 : 0);
}

main();
