const puppeteer = require('puppeteer-core');
const BASE = 'http://localhost:5173';
const OUT = 'D:/ALL CODE/CUET-react/report/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const API = 'http://localhost:3000/api/v1';

const login = async (email) => {
  const r = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Campus123' }),
  });
  return (await r.json()).data?.token;
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
    args: ['--no-sandbox'], defaultViewport: { width: 1180, height: 860 },
  });
  const page = await browser.newPage();

  const shot = (name) => page.screenshot({ path: OUT + name }).then(() => console.log('ok:', name));

  // 1. Login page (no token)
  await page.goto(BASE + '/login', { waitUntil: 'networkidle2' });
  await sleep(2200);
  await shot('screen-01-login.png');

  const student = await login('u2204001@student.cuet.ac.bd');
  const cr = await login('u2204002@student.cuet.ac.bd');
  const coord = await login('coordinator@cuet.ac.bd');

  const go = async (token, path, wait = 2800) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
    await page.evaluate((t) => localStorage.setItem('cuet:auth_token', t), token);
    await page.goto(BASE + path, { waitUntil: 'networkidle2' });
    await sleep(wait);
  };

  // Student pages
  await go(student, '/home');                          await shot('screen-02-home.png');
  await go(student, '/updates', 3400);                 await shot('screen-03-updates.png');
  await go(student, '/events', 3200);                  await shot('screen-04-events.png');
  await go(student, '/routine', 3400);                 await shot('screen-05-routine.png');
  await go(student, '/exams', 3200);                   await shot('screen-06-exams.png');
  await go(student, '/calendar', 3200);                await shot('screen-07-calendar.png');
  await go(student, '/campus-map', 4200);              await shot('screen-08-campus-map.png');
  await go(student, '/study-materials', 3200);         await shot('screen-09-study-materials.png');
  await go(student, '/assignments', 3200);             await shot('screen-10-assignments.png');
  await go(student, '/directory', 3200);               await shot('screen-11-directory.png');
  await go(student, '/ai-chat', 4200);                 await shot('screen-12-ai-chat.png');
  await go(student, '/profile', 3200);                 await shot('screen-13-profile.png');

  // CR pages
  await go(cr, '/cr-dashboard', 3600);                 await shot('screen-14-cr-dashboard.png');
  await go(cr, '/cr/compose', 3000);                   await shot('screen-15-cr-compose.png');

  // Coordinator pages
  await go(coord, '/coordinator', 3400);               await shot('screen-16-coordinator-home.png');
  await go(coord, '/coordinator/academics', 3200);     await shot('screen-17-coordinator-academics.png');
  await go(coord, '/coordinator/students', 3200);      await shot('screen-18-coordinator-students.png');
  await go(coord, '/coordinator/exams', 3200);         await shot('screen-19-coordinator-exams.png');
  await go(coord, '/coordinator/notices', 3000);       await shot('screen-20-coordinator-notices.png');
  await go(coord, '/coordinator/routine-proposals', 3600); await shot('screen-21-coordinator-proposals.png');
  await go(coord, '/coordinator/audit', 3200);         await shot('screen-22-coordinator-audit.png');

  await browser.close();
  console.log('ALL PAGE SCREENSHOTS DONE');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
