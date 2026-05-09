/**
 * Benchmark parse chunking throughput and chunk-stage timings.
 *
 * Usage:
 *   PROF_PARSE_CHUNKS=1 npx tsx scripts/bench-parse-chunks.ts
 *
 * Optional env vars:
 *   BENCH_FILES=160
 *   BENCH_KB_PER_FILE=160
 *   BENCH_ITERS=3
 *   BENCH_SKIP_WORKERS=0|1
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runChunkedParseAndResolve } from '../src/core/ingestion/pipeline-phases/parse-impl.js';
import { createKnowledgeGraph } from '../src/core/graph/graph.js';

const BENCH_FILES = Number(process.env.BENCH_FILES ?? '160');
const BENCH_KB_PER_FILE = Number(process.env.BENCH_KB_PER_FILE ?? '160');
const BENCH_ITERS = Number(process.env.BENCH_ITERS ?? '3');
const BENCH_SKIP_WORKERS = process.env.BENCH_SKIP_WORKERS === '1';

const bytesForContent = (text: string): number => Buffer.byteLength(text, 'utf8');

const padContent = (base: string, targetBytes: number): string => {
  if (bytesForContent(base) >= targetBytes) return base;
  const fillerLine = '// bench filler for parse chunk throughput calibration\n';
  let out = base;
  while (bytesForContent(out) < targetBytes) out += fillerLine;
  return out;
};

const makeFileContent = (index: number, targetBytes: number): string => {
  const prev = index > 0 ? `import { fn${index - 1} } from './file-${index - 1}';\n` : '';
  const base = `${prev}export function fn${index}(): number {\n  return ${index};\n}\n\nexport function use${index}(): number {\n  return fn${index}();\n}\n`;
  return padContent(base, targetBytes);
};

async function buildFixtureRepo(): Promise<{ repoPath: string; relativePaths: string[] }> {
  const repoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'p4nexus-bench-parse-'));
  const relativePaths: string[] = [];
  const bytesPerFile = BENCH_KB_PER_FILE * 1024;
  for (let i = 0; i < BENCH_FILES; i++) {
    const rel = `src/file-${i}.ts`;
    const abs = path.join(repoPath, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, makeFileContent(i, bytesPerFile), 'utf8');
    relativePaths.push(rel.replace(/\\/g, '/'));
  }
  return { repoPath, relativePaths };
}

async function runOne(repoPath: string, relativePaths: string[]): Promise<number> {
  const scanned = await Promise.all(
    relativePaths.map(async (p) => {
      const abs = path.join(repoPath, p);
      const stat = await fs.stat(abs);
      return { path: p, size: stat.size };
    }),
  );
  const graph = createKnowledgeGraph();
  const started = process.hrtime.bigint();
  await runChunkedParseAndResolve(
    graph,
    scanned,
    relativePaths,
    relativePaths.length,
    repoPath,
    Date.now(),
    () => {},
    { skipWorkers: BENCH_SKIP_WORKERS },
  );
  const ended = process.hrtime.bigint();
  return Number(ended - started) / 1_000_000;
}

async function main() {
  if (process.env.PROF_PARSE_CHUNKS !== '1') {
    process.env.PROF_PARSE_CHUNKS = '1';
  }

  const { repoPath, relativePaths } = await buildFixtureRepo();
  try {
    const totalMB = (BENCH_FILES * BENCH_KB_PER_FILE) / 1024;
    console.log(
      `bench parse-chunks: files=${BENCH_FILES} kbPerFile=${BENCH_KB_PER_FILE} (~${totalMB.toFixed(1)}MB) iters=${BENCH_ITERS} workers=${BENCH_SKIP_WORKERS ? 'off' : 'on'}`,
    );

    // warmup
    await runOne(repoPath, relativePaths);

    const samples: number[] = [];
    for (let i = 0; i < BENCH_ITERS; i++) {
      const ms = await runOne(repoPath, relativePaths);
      samples.push(ms);
      console.log(`  iter ${i + 1}: ${ms.toFixed(1)} ms`);
    }

    samples.sort((a, b) => a - b);
    const min = samples[0]!;
    const median = samples[Math.floor(samples.length / 2)]!;
    const avg = samples.reduce((sum, n) => sum + n, 0) / samples.length;
    console.log(
      `summary: min=${min.toFixed(1)} ms median=${median.toFixed(1)} ms avg=${avg.toFixed(1)} ms`,
    );
  } finally {
    await fs.rm(repoPath, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
