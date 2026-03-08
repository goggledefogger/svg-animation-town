#!/usr/bin/env node

/**
 * Movie Generation Test (E2E)
 * 
 * Tests the full movie generation pipeline:
 *   1. Initialize a generation session (creates storyboard with multiple scenes)
 *   2. Start the generation (generates SVG clips for each scene)
 *   3. Poll for completion
 *   4. Verify the saved movie has all clips
 * 
 * Usage:
 *   node backend/tests/test-movie-generation.js [--base-url=URL] [--local] [--scenes=N] [--provider=NAME]
 */

// --- CLI arg parsing ---
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, val] = arg.replace(/^--/, '').split('=');
  acc[key] = val ?? true;
  return acc;
}, {});

const BASE_URL = args.local
  ? 'http://localhost:3001/api'
  : (args['base-url'] || 'http://34.82.192.210/api');
const TIMEOUT_MS = parseInt(args.timeout, 10) || 300_000; // 5 min for full movie
const NUM_SCENES = parseInt(args.scenes, 10) || 3;
const PROVIDER = args.provider || 'google';

// Load curated providers to get a known-working model
const providers = require('../../shared/ai-providers.json');
const MODEL = args.model || providers[PROVIDER]?.defaultModel || null;

const PROMPT = 'A cat learns to fly: first it watches birds, then it builds wings from cardboard, finally it soars through the sky';

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

function log(msg) { console.log(`  ${msg}`); }
function pass(msg) { console.log(`  ${c.green}✓${c.reset} ${msg}`); }
function fail(msg) { console.log(`  ${c.red}✗${c.reset} ${msg}`); }

async function main() {
  console.log(`\n${c.cyan}${c.bold}═══════════════════════════════════════════════${c.reset}`);
  console.log(`${c.cyan}${c.bold}  Movie Generation E2E Test${c.reset}`);
  console.log(`${c.cyan}${c.bold}═══════════════════════════════════════════════${c.reset}`);
  console.log(`${c.dim}  Base URL:  ${BASE_URL}${c.reset}`);
  console.log(`${c.dim}  Provider:  ${PROVIDER}${c.reset}`);
  console.log(`${c.dim}  Model:     ${MODEL || '(server default)'}${c.reset}`);
  console.log(`${c.dim}  Scenes:    ${NUM_SCENES}${c.reset}`);
  console.log(`${c.dim}  Prompt:    "${PROMPT}"${c.reset}\n`);

  let sessionId, storyboardId, numScenes;
  const startTime = Date.now();

  // ─── Step 1: Initialize Generation ───
  console.log(`${c.cyan}${c.bold}─── Step 1: Initialize Generation ───${c.reset}`);

  try {
    const t0 = Date.now();
    const res = await fetchWithTimeout(`${BASE_URL}/movie/generate/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: PROMPT,
        provider: PROVIDER,
        model: MODEL,
        numScenes: NUM_SCENES,
      }),
    }, TIMEOUT_MS);

    const data = await res.json();
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    if (!res.ok || !data.success) {
      fail(`Initialize failed (${elapsed}s): ${data?.error || `HTTP ${res.status}`}`);
      process.exit(1);
    }

    sessionId = data.sessionId;
    storyboardId = data.storyboard?.id;
    numScenes = data.storyboard?.originalScenes?.length || NUM_SCENES;
    const title = data.storyboard?.name || 'Untitled';

    pass(`Session created ${c.dim}(${elapsed}s)${c.reset}`);
    log(`${c.dim}  Session ID:    ${sessionId}${c.reset}`);
    log(`${c.dim}  Storyboard ID: ${storyboardId}${c.reset}`);
    log(`${c.dim}  Title:         ${title}${c.reset}`);
    log(`${c.dim}  Scenes:        ${numScenes}${c.reset}`);

    // Show scene descriptions
    if (data.storyboard?.originalScenes) {
      data.storyboard.originalScenes.forEach((scene, i) => {
        const desc = scene.description || scene.id || 'No description';
        log(`${c.dim}    Scene ${i + 1}: ${desc.substring(0, 80)}${c.reset}`);
      });
    }
  } catch (e) {
    fail(`Initialize error: ${e.message}`);
    process.exit(1);
  }

  console.log();

  // ─── Step 2: Start Generation ───
  console.log(`${c.cyan}${c.bold}─── Step 2: Start Generation ───${c.reset}`);

  try {
    const t0 = Date.now();
    const res = await fetchWithTimeout(`${BASE_URL}/movie/generate/${sessionId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, TIMEOUT_MS);

    const data = await res.json();
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    if (!res.ok || !data.success) {
      fail(`Start generation failed (${elapsed}s): ${data?.error || `HTTP ${res.status}`}`);
      process.exit(1);
    }

    pass(`Generation completed ${c.dim}(${elapsed}s)${c.reset}`);
    log(`${c.dim}  Status: ${data.status}${c.reset}`);
    log(`${c.dim}  Progress: ${data.progress?.current}/${data.progress?.total}${c.reset}`);

    if (data.errors?.length > 0) {
      log(`${c.yellow}  Errors: ${data.errors.length}${c.reset}`);
      data.errors.forEach(e => log(`${c.yellow}    Scene ${e.scene}: ${e.error}${c.reset}`));
    }
  } catch (e) {
    const errMsg = e.name === 'AbortError' ? `Timeout after ${TIMEOUT_MS / 1000}s` : e.message;
    fail(`Start generation error: ${errMsg}`);
    process.exit(1);
  }

  console.log();

  // ─── Step 3: Verify Saved Movie ───
  console.log(`${c.cyan}${c.bold}─── Step 3: Verify Saved Movie ───${c.reset}`);

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/movie/${storyboardId}`, {}, 10_000);
    const data = await res.json();

    if (!res.ok || !data.success || !data.movie) {
      fail(`Could not fetch movie: ${data?.error || `HTTP ${res.status}`}`);
      process.exit(1);
    }

    const movie = data.movie;
    const clipCount = movie.clips?.length || 0;
    const genStatus = movie.generationStatus;

    pass(`Movie retrieved: "${movie.name}"`);
    log(`${c.dim}  Clips: ${clipCount}/${numScenes}${c.reset}`);
    log(`${c.dim}  Generation status: ${genStatus?.status}${c.reset}`);
    log(`${c.dim}  In progress: ${genStatus?.inProgress}${c.reset}`);

    // Validate each clip by fetching its animation via animationId
    let validClips = 0;
    if (movie.clips) {
      for (let i = 0; i < movie.clips.length; i++) {
        const clip = movie.clips[i];
        const hasAnimId = !!clip.animationId;

        if (!hasAnimId) {
          fail(`Clip ${i + 1}: "${clip.name}" — missing animationId`);
          continue;
        }

        // Fetch the actual SVG via the clip-animation endpoint (how the frontend does it)
        try {
          const animRes = await fetchWithTimeout(
            `${BASE_URL}/movie/clip-animation/${clip.animationId}`, {}, 10_000
          );
          const animData = await animRes.json();

          if (animRes.ok && animData.success && animData.animation?.svg) {
            const svgLen = animData.animation.svg.length;
            const hasAnim = /<animate|<animateTransform|@keyframes|animation:/i.test(animData.animation.svg);
            validClips++;
            pass(`Clip ${i + 1}: "${clip.name}" ${c.dim}(${svgLen} chars, animated: ${hasAnim ? 'yes' : 'no'})${c.reset}`);
          } else {
            fail(`Clip ${i + 1}: "${clip.name}" — animation fetch failed: ${animData?.error || animData?.message || 'no SVG'}`);
          }
        } catch (e) {
          fail(`Clip ${i + 1}: "${clip.name}" — error fetching animation: ${e.message}`);
        }
      }
    }

    console.log();

    // ─── Final Summary ───
    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`${c.cyan}${c.bold}═══════════════════════════════════════════════${c.reset}`);
    console.log(`${c.cyan}${c.bold}  Result${c.reset}`);
    console.log(`${c.cyan}${c.bold}═══════════════════════════════════════════════${c.reset}`);
    console.log(`  Total time: ${totalElapsed}s`);
    console.log(`  Clips generated: ${validClips}/${numScenes}`);

    if (validClips === numScenes) {
      console.log(`  ${c.green}${c.bold}✓ PASS — All ${numScenes} clips generated successfully${c.reset}\n`);
      process.exit(0);
    } else {
      console.log(`  ${c.red}${c.bold}✗ FAIL — Only ${validClips}/${numScenes} clips valid${c.reset}\n`);
      process.exit(1);
    }
  } catch (e) {
    fail(`Verify error: ${e.message}`);
    process.exit(1);
  }
}

main().catch(e => {
  console.error(`${c.red}Fatal: ${e.message}${c.reset}`);
  process.exit(2);
});
