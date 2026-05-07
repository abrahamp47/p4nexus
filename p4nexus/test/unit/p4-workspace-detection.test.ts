import { beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'child_process';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

const mockedExecFileSync = vi.mocked(execFileSync);

const taggedInfo = (fields: Record<string, string>): string =>
  Object.entries(fields)
    .map(([k, v]) => `... ${k} ${v}`)
    .join('\n');

describe('Perforce workspace detection', () => {
  beforeEach(() => {
    mockedExecFileSync.mockReset();
  });

  it('accepts mapped Perforce workspace even without .p4config', async () => {
    mockedExecFileSync.mockImplementation((cmd, args) => {
      const argv = args as string[];
      if (cmd === 'p4' && argv[0] === '-ztag' && argv[1] === 'info') {
        return taggedInfo({
          clientName: 'mdm_develop',
          clientRoot: 'C:\\p4',
        });
      }
      if (cmd === 'p4' && argv[0] === 'where') {
        return '//prod_depot/10.5.0/maintHF3/... //mdm_develop/prod_depot/10.5.0/maintHF3/... C:\\p4\\prod_depot\\10.5.0\\maintHF3\\...';
      }
      return '';
    });

    const { hasGitDir } = await import('../../src/storage/git.js');
    expect(hasGitDir('C:\\p4\\prod_depot\\10.5.0\\maintHF3')).toBe(true);
  });

  it('rejects path not mapped in client view', async () => {
    mockedExecFileSync.mockImplementation((cmd, args) => {
      const argv = args as string[];
      if (cmd === 'p4' && argv[0] === '-ztag' && argv[1] === 'info') {
        return taggedInfo({
          clientName: 'mdm_develop',
          clientRoot: 'C:\\p4',
        });
      }
      if (cmd === 'p4' && argv[0] === 'where') {
        return '//depot/... - file(s) not in client view.';
      }
      return '';
    });

    const { hasGitDir } = await import('../../src/storage/git.js');
    expect(hasGitDir('C:\\p4\\prod_depot\\10.5.0\\maintHF3')).toBe(false);
  });

  it('returns null git root when path is outside client view', async () => {
    mockedExecFileSync.mockImplementation((cmd, args) => {
      const argv = args as string[];
      if (cmd === 'p4' && argv[0] === '-ztag' && argv[1] === 'info') {
        return taggedInfo({
          clientName: 'mdm_develop',
          clientRoot: 'C:\\p4',
        });
      }
      if (cmd === 'p4' && argv[0] === 'where') {
        return '//depot/... - file(s) not in client view.';
      }
      return '';
    });

    const { getGitRoot } = await import('../../src/storage/git.js');
    expect(getGitRoot('C:\\outside')).toBeNull();
  });
});
