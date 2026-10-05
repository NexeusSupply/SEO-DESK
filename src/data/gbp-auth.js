// One-time helper: prints a Google sign-in URL, then exchanges the code for a refresh token.
// Run: npm run gbp:auth   (GBP_CLIENT_ID / GBP_CLIENT_SECRET must be in .env first)
import 'dotenv/config';
import { google } from 'googleapis';
import readline from 'node:readline/promises';

const o = new google.auth.OAuth2(process.env.GBP_CLIENT_ID, process.env.GBP_CLIENT_SECRET, 'urn:ietf:wg:oauth:2.0:oob');
const url = o.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: ['https://www.googleapis.com/auth/business.manage'] });
console.log('\n1. Open this URL, sign in as an owner/manager of the Business Profiles:\n\n' + url + '\n');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const code = (await rl.question('2. Paste the code shown: ')).trim();
rl.close();
const { tokens } = await o.getToken(code);
console.log('\nAdd this to .env:\n\nGBP_REFRESH_TOKEN=' + tokens.refresh_token + '\n');
