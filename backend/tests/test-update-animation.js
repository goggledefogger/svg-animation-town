#!/usr/bin/env node

/**
 * Update Animation Test (E2E)
 * 
 * Tests the animation update flow: generates a simple SVG, then asks each
 * provider's default model to add a background color to it.
 * 
 * Usage:
 *   node backend/tests/test-update-animation.js [--base-url=URL] [--local]
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
const TIMEOUT_MS = parseInt(args.timeout, 10) || 120_000;

const c = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m',
};

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
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

// --- Main ---
async function main() {
  console.log(`\n${c.cyan}${c.bold}═══════════════════════════════════════════════${c.reset}`);
  console.log(`${c.cyan}${c.bold}  Update Animation Test (Add Background)${c.reset}`);
  console.log(`${c.cyan}${c.bold}═══════════════════════════════════════════════${c.reset}`);
  console.log(`${c.dim}  Base URL: ${BASE_URL}${c.reset}\n`);

  const configured = await checkConfig();
  const results = [];

  // One model per provider — use defaults
  const testCases = [
    { provider: 'openai', model: providers.openai.defaultModel },
    { provider: 'anthropic', model: providers.anthropic.defaultModel },
    { provider: 'google', model: providers.google.defaultModel },
  ];

  for (const { provider, model } of testCases) {
    if (!configured[provider]) {
      console.log(`${c.yellow}⚠ Skipping ${provider} — no API key${c.reset}`);
      results.push({ provider, model, status: 'skipped' });
      continue;
    }

    const label = `${provider}/${model}`;

    // Step 1: Generate initial SVG
    console.log(`\n${c.cyan}${c.bold}─── ${label} ───${c.reset}`);
    console.log(`  ${c.dim}Step 1: Generating initial "fire" animation...${c.reset}`);

    let svg;
    try {
      const t0 = Date.now();
      const res = await fetchWithTimeout(`${BASE_URL}/animation/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Create a simple animated fire with orange flames',
          provider, model,
        }),
      }, TIMEOUT_MS);

      const data = await res.json();
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

      if (!res.ok || !data.success || !data.svg) {
        console.log(`  ${c.red}✗ Generate failed (${elapsed}s): ${data?.error || data?.message || `HTTP ${res.status}`}${c.reset}`);
        results.push({ provider, model, status: 'fail', step: 'generate', error: data?.error || data?.message });
        continue;
      }

      svg = data.svg;
      console.log(`  ${c.green}✓ Generated${c.reset} ${c.dim}(${elapsed}s, ${svg.length} chars)${c.reset}`);
    } catch (e) {
      console.log(`  ${c.red}✗ Generate error: ${e.message}${c.reset}`);
      results.push({ provider, model, status: 'error', step: 'generate', error: e.message });
      continue;
    }

    // Step 2: Update the animation — add a dark blue background
    console.log(`  ${c.dim}Step 2: Updating — adding dark blue background...${c.reset}`);

    try {
      const t0 = Date.now();
      const res = await fetchWithTimeout(`${BASE_URL}/animation/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Add a dark blue (#1a1a3e) background rectangle behind everything. Keep all existing animations.',
          currentSvg: svg,
          provider, model,
        }),
      }, TIMEOUT_MS);

      const data = await res.json();
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

      if (!res.ok || !data.success || !data.svg) {
        const errMsg = data?.error || data?.message || `HTTP ${res.status}`;
        console.log(`  ${c.red}✗ Update failed (${elapsed}s): ${errMsg}${c.reset}`);
        results.push({ provider, model, status: 'fail', step: 'update', error: errMsg });
        continue;
      }

      const updatedSvg = data.svg;
      const hasBackground = /1a1a3e|background|fill.*#1a|rect/i.test(updatedSvg);
      const hasAnimation = /<animate|<animateTransform|@keyframes|animation:/i.test(updatedSvg);

      console.log(
        `  ${c.green}✓ Updated${c.reset} ${c.dim}(${elapsed}s, ${updatedSvg.length} chars)${c.reset}\n` +
        `    ${c.dim}Background added: ${hasBackground ? 'likely yes' : 'unclear'}${c.reset}\n` +
        `    ${c.dim}Animations preserved: ${hasAnimation ? 'yes' : 'no'}${c.reset}`
      );

      results.push({
        provider, model, status: 'pass', elapsed,
        originalLen: svg.length, updatedLen: updatedSvg.length,
        hasBackground, hasAnimation,
      });
    } catch (e) {
      const errMsg = e.name === 'AbortError' ? 'Timeout' : e.message;
      console.log(`  ${c.red}✗ Update error: ${errMsg}${c.reset}`);
      results.push({ provider, model, status: 'error', step: 'update', error: errMsg });
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  // Summary
  const passed = results.filter(r => r.status === 'pass');
  const failed = results.filter(r => r.status === 'fail' || r.status === 'error');
  const skipped = results.filter(r => r.status === 'skipped');

  console.log(`\n${c.cyan}${c.bold}═══════════════════════════════════════════════${c.reset}`);
  console.log(`${c.cyan}${c.bold}  Summary${c.reset}`);
  console.log(`${c.cyan}${c.bold}═══════════════════════════════════════════════${c.reset}`);
  console.log(`  ${c.green}Passed:  ${passed.length}${c.reset}`);
  console.log(`  ${c.red}Failed:  ${failed.length}${c.reset}`);
  console.log(`  ${c.yellow}Skipped: ${skipped.length}${c.reset}\n`);

  if (failed.length > 0) {
    console.log(`${c.red}${c.bold}Failed:${c.reset}`);
    failed.forEach(f => console.log(`  ${c.red}✗ ${f.provider}/${f.model} (${f.step}): ${f.error}${c.reset}`));
    console.log();
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(`${c.red}Fatal: ${e.message}${c.reset}`);
  process.exit(2);
});
