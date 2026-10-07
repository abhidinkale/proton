const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(`
    <div style="font-family: sans-serif; padding: 20px; max-width: 600px; background: white;">
      <h1>Clinic Notes - Follow Up</h1>
      <p><strong>Date:</strong> 2026-09-01</p>
      <p><strong>Patient:</strong> Jane Smith</p>
      <hr />
      <h3>Observations</h3>
      <p>Patient mentioned she *might* have had a mild rash with penicillin years ago, but she is completely unsure. Needs verification.</p>
      <p>Blood pressure today was 135/85. Elevated, but not enough to confirm hypertension without further monitoring.</p>
      <p>Possible mild anemia, requested iron studies.</p>
    </div>
  `);
  await page.screenshot({ path: path.join(__dirname, 'test_doc_ambiguous.png') });
  await browser.close();
  console.log("Created test_doc_ambiguous.png");
})();
