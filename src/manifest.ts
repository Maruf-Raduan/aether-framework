// src/manifest.ts
// Loads and parses project.manifest from the project root.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { AetherManifest } from './types.js';

export type ManifestLoadResult =
  | { ok: true;  manifest: AetherManifest; raw: string }
  | { ok: false; error: string; code: 2 | 3 };

export function loadManifest(cwd: string): ManifestLoadResult {
  const manifestPath = join(cwd, 'project.manifest');

  if (!existsSync(manifestPath)) {
    return {
      ok: false,
      error: `project.manifest not found at ${manifestPath}`,
      code: 2,
    };
  }

  let raw: string;
  try {
    raw = readFileSync(manifestPath, 'utf-8');
  } catch (e) {
    return {
      ok: false,
      error: `Failed to read project.manifest: ${String(e)}`,
      code: 3,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return {
      ok: false,
      error: `project.manifest is not valid JSON: ${String(e)}`,
      code: 2,
    };
  }

  return {
    ok: true,
    manifest: parsed as AetherManifest,
    raw,
  };
}
