#!/usr/bin/env node

/**
 * scripts/show-tokens.js
 * Instant Token & Context Window Telemetry for Antigravity AI Pair Programmer
 *
 * Usage:
 *   node scripts/show-tokens.js
 *   npm run tokens
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Locate latest conversation transcript in ~/.gemini/antigravity/brain
const brainDir = path.join(process.env.USERPROFILE || process.env.HOME || '', '.gemini', 'antigravity', 'brain');

if (!fs.existsSync(brainDir)) {
  console.error('❌ Could not locate Antigravity brain directory at: ' + brainDir);
  process.exit(1);
}

const sessions = fs.readdirSync(brainDir)
  .filter(d => fs.statSync(path.join(brainDir, d)).isDirectory())
  .map(d => ({
    id: d,
    transcript: path.join(brainDir, d, '.system_generated', 'logs', 'transcript.jsonl')
  }))
  .filter(d => fs.existsSync(d.transcript))
  .sort((a, b) => fs.statSync(b.transcript).mtimeMs - fs.statSync(a.transcript).mtimeMs);

if (sessions.length === 0) {
  console.error('❌ No active session transcripts found.');
  process.exit(1);
}

const activeSession = sessions[0];

async function printTelemetry() {
  const fileStream = fs.createReadStream(activeSession.transcript);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let totalTurns = 0;
  let totalInput = 0;
  let totalCache = 0;
  let totalOutput = 0;
  const recentSteps = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.source === 'MODEL' && obj.type === 'PLANNER_RESPONSE' && (obj.input_tokens !== undefined || obj.output_tokens !== undefined)) {
        totalTurns++;
        const inp = obj.input_tokens || 0;
        const cache = obj.cache_read_tokens || 0;
        const out = obj.output_tokens || 0;
        totalInput += inp;
        totalCache += cache;
        totalOutput += out;

        recentSteps.push({
          step: obj.step_index,
          input: inp,
          cache: cache,
          output: out,
          context: inp + cache
        });
        if (recentSteps.length > 5) recentSteps.shift();
      }
    } catch (e) {}
  }

  const latest = recentSteps[recentSteps.steps - 1] || recentSteps[recentSteps.length - 1] || { input: 0, cache: 0, output: 0, context: 0 };
  const CONTEXT_LIMIT = 1000000; // 1M tokens window for Gemini Flash / Pro
  const pctUsed = ((latest.context / CONTEXT_LIMIT) * 100).toFixed(1);
  const cacheHitPct = (totalInput + totalCache) > 0 ? ((totalCache / (totalInput + totalCache)) * 100).toFixed(1) : 0;

  console.log('\n================================================================');
  console.log('           🤖 ANTIGRAVITY AI TOKEN & CONTEXT TELEMETRY          ');
  console.log('================================================================');
  console.log(`📌 Conversation ID    : ${activeSession.id}`);
  console.log(`🧠 Active Context Size: ${latest.context.toLocaleString()} / 1,000,000 tokens (${pctUsed}% of 1M limit)`);
  console.log(`⚡ Prompt Cache Ratio : ${cacheHitPct}% cache hit rate across session`);
  console.log('----------------------------------------------------------------');
  console.log('🎯 LATEST ITERATION BREAKDOWN:');
  console.log(`   • Fresh Input Tokens   : ${latest.input.toLocaleString()} (new prompt + files + command output)`);
  console.log(`   • Cached Context Tokens: ${latest.cache.toLocaleString()} (reused from prompt cache)`);
  console.log(`   • Model Output Tokens  : ${latest.output.toLocaleString()} (reasoning + code generation)`);
  console.log('----------------------------------------------------------------');
  console.log('📈 RECENT 5 ITERATIONS:');
  recentSteps.forEach(s => {
    const cPct = s.context > 0 ? ((s.cache / s.context) * 100).toFixed(0) : 0;
    console.log(`   Step #${String(s.step).padEnd(5)} | Context: ${String(s.context.toLocaleString()).padStart(8)} tokens | Fresh In: ${String(s.input.toLocaleString()).padStart(6)} | Cached: ${String(s.cache.toLocaleString()).padStart(7)} (${cPct}%) | Out: ${String(s.output).padStart(5)}`);
  });
  console.log('================================================================\n');
}

printTelemetry();

