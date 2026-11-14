// Retakes the routine page screenshot (Figure C.5): dismiss reminder popup,
// select WEEKLY GRID view, full-page screenshot.
const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--window-size=1440,900', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
  const token = await page.evaluate(async () => {
    const r = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'u2204001@student.cuet.ac.bd',
        password: 'Campus123',
      }),
    });
    const j = await r.json();
    return j.data.token;
  });
  if (!token) throw new Error('no token');
  await page.evaluate((t) => localStorage.setItem('cuet:auth_token', t), token);
  await page.goto('http://localhost:5173/routine', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));
  // dismiss reminder popup if present
  const dismissed = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find((x) => /dismiss/i.test(x.innerText));
    if (b) { b.click(); return true; }
    return false;
  });
  console.log('dismissed popup:', dismissed);
  await new Promise((r) => setTimeout(r, 800));
  // ensure WEEKLY GRID segment is active
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find((x) => /weekly grid/i.test(x.innerText));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({
    path: 'D:/ALL CODE/CUET-react/report/screen-05-routine.png',
    fullPage: true,
  });
  await browser.close();
  console.log('routine weekly-grid screenshot saved');
})();
