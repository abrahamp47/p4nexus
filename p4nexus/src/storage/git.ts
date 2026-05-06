/**
 * VCS utilities for Perforce workspace detection, changelist tracking, and diff analysis.
 *
 * This module maintains the same export API as the original git-based implementation
 * so that callers across the codebase don't need changes. The semantics are adapted
 * for Perforce:
 *   - "commit" → changelist number
 *   - "remote URL" → P4PORT (server address)
 *   - "git root" → workspace root (clientRoot)
 *   - "worktree" → not applicable (simplified)
 */

import { execFileSync } from 'child_process';
import { statSync } from 'fs';
import path from 'path';

/**
 * Run a p4 command and return stdout. Returns empty string on failure.
 */
function runP4(args: string[], cwd?: string): string {
  try {
    return execFileSync('p4', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Run p4 with -ztag (tagged output) and parse into key-value pairs.
 */
function runP4Tagged(args: string[], cwd?: string): Record<string, string> {
  const output = runP4(['-ztag', ...args], cwd);
  const result: Record<string, string> = {};
  for (const line of output.split('\n')) {
    const match = line.match(/^\.\.\.\s+(\S+)\s+(.*)/);
    if (match) {
      result[match[1]] = match[2];
    }
  }
  return result;
}

/**
 * Check if a directory is inside a Perforce workspace.
 * Equivalent to the old isGitRepo.
 */
export const isGitRepo = (repoPath: string): boolean => {
  const info = runP4Tagged(['info'], repoPath);
  return !!(info.clientName && info.clientName !== '*unknown*');
};

/**
 * Get the current highest submitted changelist for the depot paths mapped to this workspace.
 * Equivalent to the old getCurrentCommit (returns a string identifier for "current state").
 */
export const getCurrentCommit = (repoPath: string): string => {
  try {
    const output = runP4(['-Mj', 'changes', '-m', '1', '-s', 'submitted', '//...'], repoPath);
    if (output) {
      const lines = output.split('\n').filter((l) => l.trim());
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          if (obj.change) return obj.change;
        } catch {}
      }
    }
  } catch {}
  return '';
};

/**
 * Get the P4PORT (server address) as the remote identifier.
 * Analogous to git remote.origin.url — identifies which server this workspace connects to.
 *
 * Normalisation: lower-case the host portion for case-insensitive comparison.
 */
export const getRemoteUrl = (repoPath: string): string | undefined => {
  const info = runP4Tagged(['info'], repoPath);
  const addr = info.serverAddress;
  if (!addr) return undefined;

  // Normalise: lower-case the host portion
  // Perforce addresses are typically host:port or ssl:host:port
  const parts = addr.split(':');
  if (parts.length >= 2) {
    // Lower-case the host segment (could be parts[0] for host:port or parts[1] for ssl:host:port)
    if (parts[0] === 'ssl' || parts[0] === 'tcp') {
      parts[1] = parts[1].toLowerCase();
    } else {
      parts[0] = parts[0].toLowerCase();
    }
    return parts.join(':');
  }
  return addr.toLowerCase();
};

/**
 * Get the workspace root directory.
 * Equivalent to the old getGitRoot.
 */
export const getGitRoot = (fromPath: string): string | null => {
  const info = runP4Tagged(['info'], fromPath);
  if (info.clientRoot) {
    return path.resolve(info.clientRoot);
  }
  return null;
};

/**
 * Get the canonical workspace root. In Perforce there's no worktree distinction,
 * so this is the same as getGitRoot.
 */
export const getCanonicalRepoRoot = (fromPath: string): string | null => {
  return getGitRoot(fromPath);
};

/**
 * Resolve the identity root for registry naming.
 * Uses workspace client name logic instead of git worktree dereferencing.
 */
export const resolveRepoIdentityRoot = (fromPath: string): string => {
  const resolved = path.resolve(fromPath);
  const root = getGitRoot(resolved);
  return root ?? resolved;
};

/**
 * Find workspace root by checking for P4CONFIG files on the ancestor chain.
 * Equivalent to findGitRootByDotGit — a cheap filesystem check without spawning p4.
 */
export const findGitRootByDotGit = (fromPath: string): string | null => {
  let current = path.resolve(fromPath);
  try {
    if (!statSync(current).isDirectory()) {
      current = path.dirname(current);
    }
  } catch {
    return null;
  }

  const p4config = process.env.P4CONFIG || '.p4config';

  while (true) {
    try {
      statSync(path.join(current, p4config));
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }

  // Fallback: try p4 info if no config file found
  return getGitRoot(fromPath);
};

/**
 * Check whether a directory has a P4CONFIG file.
 * Equivalent to hasGitDir.
 */
export const hasGitDir = (dirPath: string): boolean => {
  const p4config = process.env.P4CONFIG || '.p4config';
  try {
    statSync(path.join(dirPath, p4config));
    return true;
  } catch {
    return false;
  }
};

/**
 * Get the P4PORT as the "remote origin URL" equivalent.
 */
export const getRemoteOriginUrl = (repoPath: string): string | null => {
  const info = runP4Tagged(['info'], repoPath);
  return info.serverAddress || null;
};

/**
 * Parse a workspace/repo name from the P4 client name or server address.
 */
export const parseRepoNameFromUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  // For Perforce, the "URL" is either P4PORT or client name
  // If it contains a colon, it's a server address — take the last segment
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    return parts[parts.length - 1] || null;
  }
  return trimmed;
};

/**
 * Get the workspace client name as the inferred repo name.
 */
export const getInferredRepoName = (repoPath: string): string | null => {
  const info = runP4Tagged(['info'], repoPath);
  const client = info.clientName;
  return client && client !== '*unknown*' ? client : null;
};

// ─── Diff Parsing ─────────────────────────────────────────────────────────────

export interface DiffHunk {
  startLine: number;
  endLine: number;
}

export interface FileDiff {
  filePath: string;
  hunks: DiffHunk[];
}

/**
 * Parse unified diff output into per-file hunk ranges.
 * Handles both git-style (+++ b/path) and p4-style (==== //depot/path#rev) headers.
 */
export function parseDiffHunks(diffOutput: string): FileDiff[] {
  const files: FileDiff[] = [];
  let current: FileDiff | null = null;

  for (const line of diffOutput.split('\n')) {
    // p4 diff -du headers: --- /local/path\tTIMESTAMP and +++ /local/path\tTIMESTAMP
    if (line.startsWith('+++ ')) {
      const filePath = line.slice(4).split('\t')[0].trim();
      if (filePath) {
        // Strip leading b/ if present (git-style)
        const cleaned = filePath.startsWith('b/') ? filePath.slice(2) : filePath;
        current = { filePath: cleaned, hunks: [] };
        files.push(current);
      }
    } else if (line.startsWith('@@') && current) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        const start = parseInt(match[1], 10);
        const count = match[2] !== undefined ? parseInt(match[2], 10) : 1;
        if (count > 0) {
          current.hunks.push({ startLine: start, endLine: start + count - 1 });
        }
      }
    }
  }
  return files;
}
