// src/prompt-builder.ts
// Assembles the project context into a single prompt for the LLM.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type { AetherManifest } from './types.js';

export interface GenContext {
  manifestTokens: number;
  contractTokens: number;
  docsTokens: number;
  existingRouteCount: number;
  totalTokens: number;
  promptText: string;
}

// Very rough approximation for UI metrics
function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

export function buildPromptContext(cwd: string, manifest: AetherManifest, targetDesc: string): GenContext {
  let promptText = `TARGET: ${targetDesc}\n\n`;
  let manifestTokens = 0;
  let contractTokens = 0;
  let docsTokens = 0;
  let existingRouteCount = 0;

  // 1. Manifest
  const manifestRaw = readFileSync(join(cwd, 'project.manifest'), 'utf-8');
  promptText += `=== MANIFEST (project.manifest) ===\n${manifestRaw}\n\n`;
  manifestTokens = estimateTokens(manifestRaw);

  // 2. AI Context Docs
  const aiCtxPath = join(cwd, manifest.ai?.context ?? 'ai-context.md');
  if (existsSync(aiCtxPath)) {
    const aiCtxRaw = readFileSync(aiCtxPath, 'utf-8');
    promptText += `=== ARCHITECTURE (ai-context.md) ===\n${aiCtxRaw}\n\n`;
    docsTokens = estimateTokens(aiCtxRaw);
  }

  // 3. Contracts
  for (const mod of manifest.modules) {
    const cp = join(cwd, mod.path.replace(/^\//, ''), 'module.contract.ts');
    if (existsSync(cp)) {
      const cRaw = readFileSync(cp, 'utf-8');
      promptText += `=== CONTRACT (${mod.name}) ===\n${cRaw}\n\n`;
      contractTokens += estimateTokens(cRaw);
    }
    
    // Scan existing routes for style
    const routesDir = join(cwd, mod.path.replace(/^\//, ''), 'routes');
    if (existsSync(routesDir)) {
      existingRouteCount += readdirSync(routesDir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).length;
    }
  }

  const totalTokens = manifestTokens + contractTokens + docsTokens + 1500; // base system prompt 

  return {
    manifestTokens,
    contractTokens,
    docsTokens,
    existingRouteCount,
    totalTokens,
    promptText,
  };
}
