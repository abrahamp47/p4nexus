/**
 * Perforce workspace vs indexed changelist staleness detection.
 * Used by MCP resources, group status, etc.
 */

import path from 'path';
import { readRegistry, type RegistryEntry, type CwdMatch } from '../storage/repo-manager.js';
import { findGitRootByDotGit, getCurrentCommit, getRemoteUrl } from '../storage/git.js';

export interface StalenessInfo {
  isStale: boolean;
  commitsBehind: number;
  hint?: string;
}

/**
 * Check how many changelists the index is behind the latest submitted CL.
 */
export function checkStaleness(repoPath: string, lastCommit: string): StalenessInfo {
  if (!lastCommit) {
    return { isStale: false, commitsBehind: 0 };
  }

  const currentCl = getCurrentCommit(repoPath);
  if (!currentCl) {
    return { isStale: false, commitsBehind: 0 };
  }

  const lastNum = parseInt(lastCommit, 10);
  const currentNum = parseInt(currentCl, 10);
  const commitsBehind = !isNaN(lastNum) && !isNaN(currentNum) ? currentNum - lastNum : 0;

  if (commitsBehind > 0) {
    return {
      isStale: true,
      commitsBehind,
      hint: `⚠️ Index is ${commitsBehind} changelist${commitsBehind > 1 ? 's' : ''} behind current workspace head. Run analyze tool to update.`,
    };
  }

  return { isStale: false, commitsBehind: 0 };
}

/**
 * Resolve a working directory against the global registry.
 */
export async function checkCwdMatch(cwd: string): Promise<CwdMatch> {
  const entries = await readRegistry();
  if (entries.length === 0) return { match: 'none' };

  const isWin = process.platform === 'win32';
  const norm = (p: string) => (isWin ? path.resolve(p).toLowerCase() : path.resolve(p));
  const sep = path.sep;
  const cwdResolved = path.resolve(cwd);
  const cwdNorm = norm(cwdResolved);

  // Path-based match (longest prefix wins, boundary-safe)
  let bestPath: RegistryEntry | undefined;
  let bestLen = -1;
  for (const e of entries) {
    const p = norm(e.path);
    if (cwdNorm === p || cwdNorm.startsWith(p + sep)) {
      if (p.length > bestLen) {
        bestPath = e;
        bestLen = p.length;
      }
    }
  }
  if (bestPath) return { match: 'path', entry: bestPath };

  // Server-based match: same P4PORT but different workspace root
  const cwdRoot = findGitRootByDotGit(cwdResolved);
  if (!cwdRoot) return { match: 'none' };

  const cwdRemote = getRemoteUrl(cwdRoot);
  if (!cwdRemote) return { match: 'none' };

  const sibling = entries.find(
    (e) => e.remoteUrl === cwdRemote && norm(e.path) !== norm(cwdRoot),
  );
  if (!sibling) return { match: 'none' };

  const cwdHead = getCurrentCommit(cwdRoot) || undefined;

  // Calculate drift by changelist/commit distance
  const lastNum = parseInt(sibling.lastCommit, 10);
  const headNum = cwdHead ? parseInt(cwdHead, 10) : undefined;
  const drift = headNum && lastNum ? Math.max(0, headNum - lastNum) : undefined;

  let hint: string | undefined;
  if (cwdHead && cwdHead === sibling.lastCommit) {
    hint = undefined;
  } else if (drift && drift > 0) {
    hint =
      `⚠️ Index for "${sibling.name}" was built at changelist ${sibling.lastCommit}; ` +
      `your workspace is ${drift} changelist${drift > 1 ? 's' : ''} ahead. ` +
      `Results may be stale — re-run \`p4nexus analyze\` to refresh.`;
  } else {
    hint =
      `⚠️ Index for "${sibling.name}" was built from a different sibling clone/workspace. ` +
      `Results may be stale — re-run \`p4nexus analyze\` to refresh.`;
  }

  return {
    match: 'sibling-by-remote',
    entry: sibling,
    cwdGitRoot: cwdRoot,
    cwdHead,
    drift,
    hint,
  };
}
