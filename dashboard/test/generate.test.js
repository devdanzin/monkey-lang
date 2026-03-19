#!/usr/bin/env node
// test/generate.test.js — Basic tests for generate.js parsers
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// We'll test by running generate.js against the real workspace and validating output
const OUTPUT = path.join(__dirname, '..', 'data', 'dashboard.json');

// Run generator first
require('child_process').execSync('node generate.js', { cwd: path.join(__dirname, '..') });

const data = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));

// --- Structure tests ---
assert(data.generated, 'should have generated timestamp');
assert(data.current, 'should have current');
assert(data.schedule, 'should have schedule');
assert(data.stats, 'should have stats');
assert(Array.isArray(data.schedule.blocks), 'blocks should be array');
assert(Array.isArray(data.schedule.backlog), 'backlog should be array');
assert(Array.isArray(data.artifacts), 'artifacts should be array');
assert(Array.isArray(data.recentDays), 'recentDays should be array');

// --- Current ---
assert(['done', 'in-progress', 'idle'].includes(data.current.status), 'valid status');
assert(['BUILD', 'THINK', 'EXPLORE', 'MAINTAIN'].includes(data.current.mode), 'valid mode');
assert(data.current.task.length > 0, 'current should have a task');

// --- Schedule ---
assert(data.schedule.date.match(/^\d{4}-\d{2}-\d{2}$/), 'valid date format');
assert(data.schedule.blocks.length > 10, 'should have many blocks');

for (const block of data.schedule.blocks) {
  assert(block.time.match(/^\d{2}:\d{2}$/), `valid time: ${block.time}`);
  assert(['BUILD', 'THINK', 'EXPLORE', 'MAINTAIN'].includes(block.mode), `valid mode: ${block.mode}`);
  assert(['done', 'in-progress', 'upcoming', 'skipped'].includes(block.status), `valid status: ${block.status}`);
  assert(typeof block.task === 'string', 'task is string');
  assert(Array.isArray(block.artifacts), 'block artifacts is array');
}

// --- Stats ---
assert(data.stats.blocksCompleted >= 0, 'blocksCompleted >= 0');
assert(data.stats.blocksTotal === data.schedule.blocks.length, 'blocksTotal matches blocks count');
assert(data.stats.blocksCompleted <= data.stats.blocksTotal, 'completed <= total');

// At least one in-progress block should exist if current is in-progress
if (data.current.status === 'in-progress') {
  const inProgress = data.schedule.blocks.filter(b => b.status === 'in-progress');
  assert(inProgress.length > 0, 'should have an in-progress block');
}

// --- Backlog ---
assert(data.schedule.backlog.length > 0, 'should have backlog items');
for (const item of data.schedule.backlog) {
  assert(typeof item === 'string' && item.length > 0, 'backlog items are non-empty strings');
}

// --- Recent days ---
for (const day of data.recentDays) {
  assert(day.date.match(/^\d{4}-\d{2}-\d{2}$/), 'valid recent day date');
  assert(typeof day.blocksCompleted === 'number', 'blocksCompleted is number');
  assert(Array.isArray(day.highlights), 'highlights is array');
}

console.log('✅ All tests passed!');
console.log(`   ${data.schedule.blocks.length} blocks, ${data.stats.blocksCompleted} done, ${data.schedule.backlog.length} backlog, ${data.recentDays.length} recent days`);
