#!/usr/bin/env node

/**
 * Model Provider Test Suite
 * 
 * Tests a simple "fire" SVG animation generation across all configured
 * providers and their curated models. Runs sequentially to avoid rate limiting.
 * 
 * Usage:
 *   node backend/tests/test-all-models.js [options]
 * 
 * Options:
 *   --base-url=URL    API base URL (default: http://34.82.192.210/api)
 *   --provider=NAME   Test only this provider: openai, anthropic, google
 *   --timeout=MS      Request timeout in ms (default: 120000)
 *   --local           Use localhost:3001 as base URL
 */

const providers = require('../../shared/ai-providers.json');

// --- CLI arg parsing ---
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, val] = arg.replace(/^--/, '').split('=');
  acc[key] = val ?? true;
  return acc;
}, {});

const BASE_URL = args.local
  ? 'http://localhost:3001/api'
  : (args['base-url'] || 'http://34.82.192.210/api');
const FILTER_PROVIDER = args.provider || null;
const TIMEOUT_MS = parseInt(args.timeout, 10) || 120_000;
const PROMPT = 'Create a simple animated fire with flickering orange and red flames';

// --- Colors ---
const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

// --- Helpers ---
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function checkConfig() {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/config`, {}, 10_000);
    const data = await res.json();
    return data?.config?.configuredProviders || {};
  } catch (e) {
    console.error(`${c.red}✗ Could not reach server at ${BASE_URL}/config: ${e.message}${c.reset}`);
    process.exit(1);
  }
}

async function testModel(providerName, model) {
  const label = `${providerName}/${model.id}`;
  const startTime = Date.now();

  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/animation/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: PROMPT,
          provider: providerName,
          model: model.id,
        }),
      },
      TIMEOUT_MS
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const data = await res.json();

    if (res.ok && data.success && data.svg) {
      const svgLen = data.svg.length;
      const hasAnimation = /<animate|<animateTransform|<animateMotion|@keyframes|animation:/i.test(data.svg);
      const resolvedModel = data.metadata?.model || model.id;

      console.log(
        `  ${c.green}✓${c.reset} ${c.bold}${label}${c.reset}` +
        `  ${c.dim}→ ${resolvedModel}${c.reset}` +
        `  ${c.dim}(${elapsed}s, ${svgLen} chars, animated: ${hasAnimation ? 'yes' : 'no'})${c.reset}`
      );

      return { status: 'pass', provider: providerName, model: model.id, resolvedModel, elapsed, svgLen, hasAnimation };
    } else {
      const errMsg = data?.error || data?.message || `HTTP ${res.status}`;
      console.log(`  ${c.red}✗${c.reset} ${c.bold}${label}${c.reset} ${c.dim}(${elapsed}s)${c.reset} — ${c.red}${errMsg}${c.reset}`);
      return { status: 'fail', provider: providerName, model: model.id, elapsed, error: errMsg };
    }
  } catch (e) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const errMsg = e.name === 'AbortError' ? `Timeout after ${TIMEOUT_MS / 1000}s` : e.message;
    console.log(`  ${c.red}✗${c.reset} ${c.bold}${label}${c.reset} ${c.dim}(${elapsed}s)${c.reset} — ${c.red}${errMsg}${c.reset}`);
    return { status: 'error', provider: providerName, model: model.id, elapsed, error: errMsg };
  }
}

// --- Main ---
async function main() {
  console.log(`\n${c.cyan}${c.bold}═══════════════════════════════════════════════${c.reset}`);
  console.log(`${c.cyan}${c.bold}  SVG Animation — Model Provider Test Suite${c.reset}`);
  console.log(`${c.cyan}${c.bold}═══════════════════════════════════════════════${c.reset}`);
  console.log(`${c.dim}  Base URL:  ${BASE_URL}${c.reset}`);
  console.log(`${c.dim}  Prompt:    "${PROMPT}"${c.reset}`);
  console.log(`${c.dim}  Timeout:   ${TIMEOUT_MS / 1000}s per request${c.reset}`);
  if (FILTER_PROVIDER) {
    console.log(`${c.dim}  Filter:    ${FILTER_PROVIDER} only${c.reset}`);
  }
  console.log();

  // Check which providers have API keys
  const configured = await checkConfig();
  console.log(`${c.cyan}Provider API keys:${c.reset}`);
  for (const [name, hasKey] of Object.entries(configured)) {
    const icon = hasKey ? `${c.green}✓` : `${c.red}✗`;
    console.log(`  ${icon} ${name}${c.reset}`);
  }
  console.log();

  const results = [];
  const skipped = [];

  const TEST_ALL = !!args.all;

  // Use curated models from the static ai-providers.json
  for (const [providerName, providerData] of Object.entries(providers)) {
    if (FILTER_PROVIDER && providerName !== FILTER_PROVIDER) continue;

    const hasKey = configured[providerName];
    
    // Filter models based on the --all flag
    const modelsToTest = TEST_ALL 
      ? providerData.models 
      : providerData.models.filter(m => m.showInUi);

    console.log(`${c.cyan}${c.bold}─── ${providerData.displayName} (${modelsToTest.length} models) ───${c.reset}`);

    if (!hasKey) {
      console.log(`  ${c.yellow}⚠ Skipping — no API key configured${c.reset}\n`);
      modelsToTest.forEach(m => skipped.push({ provider: providerName, model: m.id }));
      continue;
    }

    for (const model of modelsToTest) {
      const result = await testModel(providerName, model);
      results.push(result);

      // Small delay between requests to be gentle on rate limits
      await new Promise(r => setTimeout(r, 2000));
    }
    console.log();
  }

  // --- Summary ---
  const passed = results.filter(r => r.status === 'pass');
  const failed = results.filter(r => r.status !== 'pass');

  console.log(`${c.cyan}${c.bold}═══════════════════════════════════════════════${c.reset}`);
  console.log(`${c.cyan}${c.bold}  Summary${c.reset}`);
  console.log(`${c.cyan}${c.bold}═══════════════════════════════════════════════${c.reset}`);
  console.log(`  ${c.green}Passed:  ${passed.length}${c.reset}`);
  console.log(`  ${c.red}Failed:  ${failed.length}${c.reset}`);
  console.log(`  ${c.yellow}Skipped: ${skipped.length}${c.reset}`);
  console.log(`  Total:   ${results.length + skipped.length}`);
  console.log();

  if (failed.length > 0) {
    console.log(`${c.red}${c.bold}Failed models:${c.reset}`);
    for (const f of failed) {
      console.log(`  ${c.red}✗ ${f.provider}/${f.model}: ${f.error}${c.reset}`);
    }
    console.log();
  }

  if (passed.length > 0) {
    const sorted = [...passed].sort((a, b) => parseFloat(a.elapsed) - parseFloat(b.elapsed));
    console.log(`${c.green}${c.bold}Leaderboard (fastest → slowest):${c.reset}`);
    sorted.forEach((r, i) => {
      console.log(
        `  ${i + 1}. ${r.provider}/${r.resolvedModel} — ${r.elapsed}s (${r.svgLen} chars)`
      );
    });
    console.log();
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(`\n${c.red}Fatal error: ${e.message}${c.reset}`);
  process.exit(2);
});
