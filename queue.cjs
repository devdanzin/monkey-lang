#!/usr/bin/env node
'use strict';

/**
 * queue.js — Deterministic Queue Manager for Work System V2
 * 
 * All schedule.json mutations go through this script.
 * Validates structure, auto-generates stable IDs, logs adjustments.
 * 
 * Usage:
 *   node queue.js next [--peek-all]
 *   node queue.js start --task T3
 *   node queue.js done --task T3 --summary "..." --duration 240000
 *   node queue.js fill --plan T2 --tasks "task1" "task2" "task3"
 *   node queue.js yield --at T5 --reason "blocked on X"
 *   node queue.js move --task T14 --after T8
 *   node queue.js remove --task T12 --reason "no longer needed"
 *   node queue.js add --after T6 --mode BUILD --task "do thing" [--goal "parent goal"] [--plan-ref T2]
 *   node queue.js backlog --add "new idea" | --pop
 *   node queue.js validate
 *   node queue.js init --date 2026-03-24
 */

const fs = require('fs');
const path = require('path');

const SCHEDULE_PATH = path.join(__dirname, 'schedule.json');
const DASHBOARD_URL = 'http://localhost:3000';

// --- Dashboard webhook (fire-and-forget, never blocks work) ---

function dashboardPost(endpoint, body) {
  try {
    const token = process.env.DASHBOARD_TOKEN || '';
    const payload = JSON.stringify(body);
    const { execSync } = require('child_process');
    execSync(
      `curl -s -X POST "${DASHBOARD_URL}${endpoint}" -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" -d '${payload.replace(/'/g, "'\\''")}' --max-time 2`,
      { stdio: 'ignore', timeout: 3000 }
    );
  } catch (_) {
    // Dashboard never blocks work
  }
}

// --- Helpers ---

function loadSchedule() {
  if (!fs.existsSync(SCHEDULE_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
}

function saveSchedule(data) {
  fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(data, null, 2) + '\n');
}

function now() {
  return new Date().toISOString();
}

function nextId(queue) {
  let max = 0;
  for (const t of queue) {
    const n = parseInt(t.id.slice(1), 10);
    if (n > max) max = n;
  }
  return `T${max + 1}`;
}

function findTask(queue, id) {
  const idx = queue.findIndex(t => t.id === id);
  if (idx === -1) throw new Error(`Task ${id} not found`);
  return { task: queue[idx], idx };
}

function findAfterIdx(queue, afterId) {
  if (!afterId) return queue.length; // append
  const idx = queue.findIndex(t => t.id === afterId);
  if (idx === -1) throw new Error(`Task ${afterId} not found for --after`);
  return idx + 1;
}

function addAdjustment(data, msg) {
  if (!data.adjustments) data.adjustments = [];
  data.adjustments.push({ time: now(), msg });
}

function output(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

// --- Commands ---

// Auto-resolve orphaned in-progress tasks (started 30+ min ago)
function resolveOrphans(data) {
  const ORPHAN_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
  const cutoff = Date.now() - ORPHAN_THRESHOLD_MS;
  const resolved = [];
  for (const task of data.queue) {
    if (task.status === 'in-progress' && task.started) {
      const startedMs = new Date(task.started).getTime();
      if (startedMs < cutoff) {
        task.status = 'done';
        task.completed = now();
        task.summary = (task.summary || '') + ' [auto-resolved: orphaned in-progress task]';
        resolved.push(task);
        dashboardPost('/api/task-update', { action: 'complete', task });
      }
    }
  }
  if (resolved.length > 0) {
    saveSchedule(data);
    console.error(`Auto-resolved ${resolved.length} orphaned task(s): ${resolved.map(t => t.id).join(', ')}`);
  }
  return resolved;
}

function cmdNext(args, data) {
  const peekAll = args.includes('--peek-all');
  
  // Always check for orphans before returning next task
  const orphans = resolveOrphans(data);
  
  if (peekAll) {
    const result = { queue: data.queue, backlog: data.backlog || [] };
    if (orphans.length > 0) result.orphansResolved = orphans.map(t => t.id);
    output(result);
    return;
  }
  const next = data.queue.find(t => t.status === 'upcoming' || t.status === 'in-progress');
  if (!next) {
    output({ next: null, message: 'Queue empty', orphansResolved: orphans.map(t => t.id) });
  } else {
    output({ next, orphansResolved: orphans.length > 0 ? orphans.map(t => t.id) : undefined });
  }
}

function cmdStart(args, data) {
  const taskId = getArg(args, '--task');
  const { task } = findTask(data.queue, taskId);
  if (task.status !== 'upcoming') {
    throw new Error(`Task ${taskId} status is '${task.status}', expected 'upcoming'`);
  }
  task.status = 'in-progress';
  task.started = now();
  saveSchedule(data);
  output({ started: task });
  dashboardPost('/api/task-update', { action: 'start', task });
}

function cmdDone(args, data) {
  const taskId = getArg(args, '--task');
  const summary = getArg(args, '--summary', '');
  const duration = parseInt(getArg(args, '--duration', '0'), 10);
  const { task } = findTask(data.queue, taskId);
  if (task.status !== 'in-progress') {
    throw new Error(`Task ${taskId} status is '${task.status}', expected 'in-progress'`);
  }
  task.status = 'done';
  task.completed = now();
  task.duration_ms = duration;
  task.summary = summary;
  saveSchedule(data);
  output({ done: task });
  dashboardPost('/api/task-update', { action: 'complete', task });
}

function cmdFill(args, data) {
  const planId = getArg(args, '--plan');
  findTask(data.queue, planId); // validate plan exists
  
  // Collect all --tasks values (everything after --tasks until next --)
  const tasksIdx = args.indexOf('--tasks');
  if (tasksIdx === -1) throw new Error('--tasks required');
  const tasks = [];
  for (let i = tasksIdx + 1; i < args.length; i++) {
    if (args[i].startsWith('--')) break;
    tasks.push(args[i]);
  }
  if (tasks.length === 0) throw new Error('No tasks provided after --tasks');

  // Find unfilled BUILD placeholders with this plan_ref
  const placeholders = data.queue.filter(t => t.plan_ref === planId && t.task === null && t.status === 'upcoming');
  
  // Fill existing placeholders, add new ones if needed, remove extras
  let filled = 0;
  for (let i = 0; i < Math.min(tasks.length, placeholders.length); i++) {
    placeholders[i].task = tasks[i];
    filled++;
  }
  
  // If more tasks than placeholders, insert new BUILD tasks after last placeholder
  if (tasks.length > placeholders.length) {
    const lastPlaceholderIdx = placeholders.length > 0 
      ? data.queue.indexOf(placeholders[placeholders.length - 1])
      : data.queue.indexOf(data.queue.find(t => t.id === planId));
    
    for (let i = placeholders.length; i < tasks.length; i++) {
      const newTask = {
        id: nextId(data.queue),
        mode: 'BUILD',
        task: tasks[i],
        status: 'upcoming',
        plan_ref: planId
      };
      data.queue.splice(lastPlaceholderIdx + 1 + (i - placeholders.length), 0, newTask);
      filled++;
    }
  }
  
  // If fewer tasks than placeholders, remove extras
  if (tasks.length < placeholders.length) {
    for (let i = tasks.length; i < placeholders.length; i++) {
      const idx = data.queue.indexOf(placeholders[i]);
      data.queue.splice(idx, 1);
    }
  }

  addAdjustment(data, `PLAN ${planId} filled ${filled} BUILD tasks`);
  saveSchedule(data);
  output({ filled, tasks: tasks.length });
  dashboardPost('/api/queue-update', data);
}

function cmdYield(args, data) {
  const atId = getArg(args, '--at');
  const reason = getArg(args, '--reason', 'unspecified');
  const { idx } = findTask(data.queue, atId);

  const thinkTask = {
    id: nextId(data.queue),
    mode: 'THINK',
    task: `Yield: ${reason}`,
    status: 'upcoming'
  };
  const planTask = {
    id: `T${parseInt(thinkTask.id.slice(1), 10) + 1}`,
    mode: 'PLAN',
    goal: reason,
    task: null,
    status: 'upcoming'
  };

  data.queue.splice(idx, 0, thinkTask, planTask);
  addAdjustment(data, `Yield at ${atId}: ${reason}. Inserted ${thinkTask.id} (THINK) + ${planTask.id} (PLAN)`);
  saveSchedule(data);
  output({ yielded: { think: thinkTask.id, plan: planTask.id, reason } });
}

function cmdMove(args, data) {
  const taskId = getArg(args, '--task');
  const afterId = getArg(args, '--after');
  const { task, idx } = findTask(data.queue, taskId);
  data.queue.splice(idx, 1);
  const newIdx = findAfterIdx(data.queue, afterId);
  data.queue.splice(newIdx, 0, task);
  addAdjustment(data, `Moved ${taskId} after ${afterId}`);
  saveSchedule(data);
  output({ moved: taskId, after: afterId });
}

function cmdRemove(args, data) {
  const taskId = getArg(args, '--task');
  const reason = getArg(args, '--reason', '');
  const { task, idx } = findTask(data.queue, taskId);
  if (task.status === 'in-progress') throw new Error(`Cannot remove in-progress task ${taskId}`);
  task.status = 'skipped';
  task.skip_reason = reason;
  addAdjustment(data, `Removed ${taskId}: ${reason}`);
  saveSchedule(data);
  output({ removed: taskId });
}

function cmdAdd(args, data) {
  const afterId = getArg(args, '--after', null);
  const mode = getArg(args, '--mode');
  const task = getArg(args, '--task', null);
  const goal = getArg(args, '--goal', null);
  const planRef = getArg(args, '--plan-ref', null);

  if (!['THINK', 'PLAN', 'BUILD', 'MAINTAIN', 'EXPLORE'].includes(mode)) {
    throw new Error(`Invalid mode: ${mode}`);
  }

  const newTask = {
    id: nextId(data.queue),
    mode,
    status: 'upcoming'
  };
  if (mode === 'PLAN') {
    newTask.goal = goal || task;
    newTask.task = null;
  } else {
    newTask.task = (task === null || task === 'null' || task === '') ? null : task;
  }
  if (planRef) newTask.plan_ref = planRef;

  const insertIdx = afterId ? findAfterIdx(data.queue, afterId) : data.queue.length;
  data.queue.splice(insertIdx, 0, newTask);
  addAdjustment(data, `Added ${newTask.id} (${mode}) after ${afterId || 'end'}: ${task || goal}`);
  saveSchedule(data);
  output({ added: newTask });
}

function cmdBacklog(args, data) {
  if (!data.backlog) data.backlog = [];
  
  if (args.includes('--add')) {
    const item = getArg(args, '--add');
    data.backlog.push(item);
    saveSchedule(data);
    output({ backlog: data.backlog });
  } else if (args.includes('--pop')) {
    if (data.backlog.length === 0) {
      output({ popped: null, message: 'Backlog empty' });
      return;
    }
    const item = data.backlog.shift();
    saveSchedule(data);
    output({ popped: item });
  } else {
    output({ backlog: data.backlog });
  }
}

function cmdValidate(args, data) {
  const warnings = [];
  const errors = [];

  // Check every BUILD stretch has a PLAN before it
  let lastPlanId = null;
  let buildStreak = 0;
  let hasMaintainInCycle = false;
  let hasThinkInCycle = false;
  let exploreCount = 0;

  for (const t of data.queue) {
    if (t.status === 'skipped') continue;
    
    if (t.mode === 'THINK') {
      hasThinkInCycle = true;
      lastPlanId = t.id; // THINK blocks include planning
      buildStreak = 0;
    } else if (t.mode === 'PLAN') {
      lastPlanId = t.id;
      buildStreak = 0;
    } else if (t.mode === 'BUILD') {
      buildStreak++;
      if (!t.plan_ref && !lastPlanId) {
        warnings.push(`BUILD ${t.id} has no preceding THINK/PLAN`);
      }
      if (buildStreak > 5) {
        warnings.push(`BUILD streak of ${buildStreak} at ${t.id} (recommended max: 5)`);
      }
    } else if (t.mode === 'MAINTAIN') {
      hasMaintainInCycle = true;
      buildStreak = 0;
      // Reset cycle tracking
      if (!hasThinkInCycle) warnings.push(`No THINK before MAINTAIN at ${t.id}`);
      hasThinkInCycle = false;
      hasMaintainInCycle = false;
    } else if (t.mode === 'EXPLORE') {
      exploreCount++;
      buildStreak = 0;
    }
  }

  if (exploreCount < 2) {
    warnings.push(`Only ${exploreCount} EXPLORE tasks (recommended: 2+)`);
  }

  // Check unique IDs
  const ids = data.queue.map(t => t.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length > 0) errors.push(`Duplicate IDs: ${dupes.join(', ')}`);

  // Check unfilled BUILDs
  const unfilled = data.queue.filter(t => t.mode === 'BUILD' && t.task === null && t.status === 'upcoming');
  if (unfilled.length > 0) {
    // This is expected before PLAN runs
    warnings.push(`${unfilled.length} unfilled BUILD placeholders: ${unfilled.map(t => t.id).join(', ')}`);
  }

  const valid = errors.length === 0;
  output({ valid, errors, warnings });
}

function cmdInit(args, data) {
  const date = getArg(args, '--date', new Date().toISOString().slice(0, 10));
  const newSchedule = {
    date,
    queue: [],
    backlog: data?.backlog || [],
    adjustments: []
  };
  saveSchedule(newSchedule);
  output({ initialized: date });
}

// --- Arg parsing ---

function getArg(args, flag, defaultVal) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) {
    if (defaultVal !== undefined) return defaultVal;
    throw new Error(`Missing required argument: ${flag}`);
  }
  return args[idx + 1];
}

// --- JSON stdin mode ---
// Usage: echo '{"command":"done","task":"T3","summary":"it's done"}' | node queue.cjs --json
// Avoids all shell quoting issues with apostrophes, quotes, etc.

function argsFromJson(json) {
  const obj = JSON.parse(json);
  const cmd = obj.command;
  delete obj.command;
  const args = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'tasks' && Array.isArray(v)) {
      args.push('--tasks', ...v);
    } else if (typeof v === 'boolean') {
      if (v) args.push(`--${k}`);
    } else if (v === null) {
      args.push(`--${k}`, 'null');
    } else {
      args.push(`--${k}`, String(v));
    }
  }
  return { cmd, args };
}

// --- Main ---

let command, restArgs;

if (process.argv.includes('--json')) {
  // Read JSON from stdin
  const input = fs.readFileSync(0, 'utf8').trim();
  const parsed = argsFromJson(input);
  command = parsed.cmd;
  restArgs = parsed.args;
} else {
  const args = process.argv.slice(2);
  command = args[0];
  restArgs = args.slice(1);
}

try {
  const data = loadSchedule();
  
  if (command === 'init') {
    cmdInit(restArgs, data);
    process.exit(0);
  }
  
  if (!data) {
    console.error('Error: schedule.json not found. Run `node queue.js init` first.');
    process.exit(1);
  }

  switch (command) {
    case 'next': cmdNext(restArgs, data); break;
    case 'start': cmdStart(restArgs, data); break;
    case 'done': cmdDone(restArgs, data); break;
    case 'fill': cmdFill(restArgs, data); break;
    case 'yield': cmdYield(restArgs, data); break;
    case 'move': cmdMove(restArgs, data); break;
    case 'remove': cmdRemove(restArgs, data); break;
    case 'add': cmdAdd(restArgs, data); break;
    case 'backlog': cmdBacklog(restArgs, data); break;
    case 'validate': cmdValidate(restArgs, data); break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Commands: next, start, done, fill, yield, move, remove, add, backlog, validate, init');
      process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
