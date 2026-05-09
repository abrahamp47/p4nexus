import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReadRegistry = vi.fn();
const mockFindWorkspaceRoot = vi.fn();
const mockGetCurrentCommit = vi.fn();
const mockGetRemoteUrl = vi.fn();

vi.mock('../../src/storage/repo-manager.js', () => ({
  readRegistry: mockReadRegistry,
}));

vi.mock('../../src/storage/git.js', () => ({
  findGitRootByDotGit: mockFindWorkspaceRoot,
  getCurrentCommit: mockGetCurrentCommit,
  getRemoteUrl: mockGetRemoteUrl,
}));

describe('Perforce staleness and sibling workspace matching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks index stale when workspace changelist is ahead', async () => {
    mockGetCurrentCommit.mockReturnValue('12350');
    const { checkStaleness } = await import('../../src/core/git-staleness.js');

    const result = checkStaleness('/repo', '12345');
    expect(result.isStale).toBe(true);
    expect(result.commitsBehind).toBe(5);
    expect(result.hint).toContain('5 changelists behind');
  });

  it('returns path match for cwd inside registered workspace path', async () => {
    mockReadRegistry.mockResolvedValue([
      {
        name: 'repo-a',
        path: '/work/repo-a',
        storagePath: '/work/repo-a/.p4nexus',
        indexedAt: '2026-01-01T00:00:00.000Z',
        lastCommit: '200',
        remoteUrl: 'ssl:perforce.company.net:1666',
      },
    ]);

    const { checkCwdMatch } = await import('../../src/core/git-staleness.js');
    const result = await checkCwdMatch('/work/repo-a/src/module');

    expect(result.match).toBe('path');
    expect(result.entry?.name).toBe('repo-a');
  });

  it('returns sibling-by-remote with drift hint when sibling workspace is ahead', async () => {
    mockReadRegistry.mockResolvedValue([
      {
        name: 'repo-a',
        path: '/indexes/repo-a-main',
        storagePath: '/indexes/repo-a-main/.p4nexus',
        indexedAt: '2026-01-01T00:00:00.000Z',
        lastCommit: '300',
        remoteUrl: 'ssl:perforce.company.net:1666',
      },
    ]);
    mockFindWorkspaceRoot.mockReturnValue('/workspaces/repo-a-dev');
    mockGetRemoteUrl.mockReturnValue('ssl:perforce.company.net:1666');
    mockGetCurrentCommit.mockReturnValue('307');

    const { checkCwdMatch } = await import('../../src/core/git-staleness.js');
    const result = await checkCwdMatch('/workspaces/repo-a-dev/src');

    expect(result.match).toBe('sibling-by-remote');
    expect(result.cwdHead).toBe('307');
    expect(result.drift).toBe(7);
    expect(result.hint).toContain('7 changelists ahead');
  });

  it('omits stale hint when sibling workspace changelist matches indexed changelist', async () => {
    mockReadRegistry.mockResolvedValue([
      {
        name: 'repo-a',
        path: '/indexes/repo-a-main',
        storagePath: '/indexes/repo-a-main/.p4nexus',
        indexedAt: '2026-01-01T00:00:00.000Z',
        lastCommit: '300',
        remoteUrl: 'ssl:perforce.company.net:1666',
      },
    ]);
    mockFindWorkspaceRoot.mockReturnValue('/workspaces/repo-a-dev');
    mockGetRemoteUrl.mockReturnValue('ssl:perforce.company.net:1666');
    mockGetCurrentCommit.mockReturnValue('300');

    const { checkCwdMatch } = await import('../../src/core/git-staleness.js');
    const result = await checkCwdMatch('/workspaces/repo-a-dev/src');

    expect(result.match).toBe('sibling-by-remote');
    expect(result.drift).toBe(0);
    expect(result.hint).toBeUndefined();
  });
});
