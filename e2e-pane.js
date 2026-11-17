const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5173';
const CR = 'u2204002@student.cuet.ac.bd';
const PW = 'Campus123';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 150)));

  const res = await fetch('http://localhost:3000/api/v1/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CR, password: PW }),
  });
  const token = (await res.json()).data?.token;
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
  await page.evaluate((t) => localStorage.setItem('cuet:auth_token', t), token);
  await page.goto(BASE + '/routine?tab=exam', { waitUntil: 'networkidle2' });
  await sleep(2500);
  const txt = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  console.log('has DL STARTS:', /DL STARTS/.test(txt));
  console.log('has LAST CLASS DAY:', /LAST CLASS DAY/i.test(txt));
  console.log('has FIRST EXAM:', /FIRST EXAM/.test(txt));
  await page.screenshot({ path: 'exam-pane.png' });
  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
