import cron from 'node-cron';
import { config } from './config.js';
import { jobs } from './jobs.js';

export function startScheduler() {
  const running = new Set();
  const wrap = (name) => async () => {
    if (running.has(name)) return console.log(`[cron] ${name} still running, skipped`);
    running.add(name);
    console.log(`[cron] ${name} start`);
    try { console.log(`[cron] ${name}:`, (await jobs[name]()).join(' | ')); } finally { running.delete(name); }
  };
  for (const name of Object.keys(config.cron)) cron.schedule(config.cron[name], wrap(name));
  console.log('[cron] schedules:', config.cron);
}
