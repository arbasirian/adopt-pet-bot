import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface State {
  initializedAt: string;
  /** IDs of matching dogs already notified about (or present at baseline). */
  seenIds: number[];
}

/**
 * Returns null only when the state file does not exist (first run → baseline).
 * A file that exists but cannot be parsed throws: silently re-baselining would hide
 * the problem, and treating it as empty would resend every listing.
 */
export async function loadState(path: string): Promise<State | null> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  const parsed = JSON.parse(raw) as Partial<State>;
  if (!Array.isArray(parsed.seenIds) || !parsed.seenIds.every((id) => typeof id === 'number')) {
    throw new Error(`State file ${path} is malformed: "seenIds" must be an array of numbers`);
  }
  return { initializedAt: parsed.initializedAt ?? 'unknown', seenIds: parsed.seenIds };
}

/** Atomic write (temp file + rename) so a crash can never leave a half-written file. */
export async function saveState(path: string, state: State): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const sorted: State = { ...state, seenIds: [...new Set(state.seenIds)].sort((a, b) => a - b) };
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(sorted, null, 2) + '\n');
  await rename(tmp, path);
}
