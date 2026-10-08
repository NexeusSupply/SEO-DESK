import { jobs } from './jobs.js';
const [job, only] = process.argv.slice(2);
if (!jobs[job]) { console.log('Usage: node src/cli.js <audit|ranks|gsc|competitors|gbp|local|ads|ai|keywords|meta|meta-comments|digest> [site-slug]'); process.exit(1); }
console.log((await jobs[job](only)).join('\n'));
process.exit(0);
