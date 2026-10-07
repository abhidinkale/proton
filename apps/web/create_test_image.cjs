const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(`
    <div style="font-family: sans-serif; padding: 20px; max-width: 600px; background: white;">
      <h1>Blood Test Report</h1>
      <p><strong>Date:</strong> 2026-08-12</p>
      <p><strong>Patient:</strong> John Doe</p>
      <hr />
      <h3>Findings</h3>
      <ul>
        <li><strong>HbA1c:</strong> 7.2%</li>
        <li><strong>Diagnosis:</strong> Type 2 diabetes</li>
      </ul>
      <h3>Prescription</h3>
      <p>Metformin 500 mg twice daily.</p>
    </div>
  `);
  await page.screenshot({ path: path.join(__dirname, 'medical_report.png') });
  await browser.close();
  console.log("Created medical_report.png");
})();
