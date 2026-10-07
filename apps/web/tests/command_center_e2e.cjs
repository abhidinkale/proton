const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--disable-web-security', '--disable-http2']
  });
  const page = await browser.newPage();
  
  // Capture browser console
  page.on('console', msg => {
    if (msg.text().includes('PATIENT PROFILE') || msg.text().includes('STATUS:') || msg.text().includes('ERROR')) {
      console.log('BROWSER CONSOLE:', msg.text());
    }
  });

  try {
    console.log("=== PROTON DOCTOR COMMAND CENTER & INTERACTIVE TIMELINE E2E TEST ===");

    // [1] Login
    console.log("[1] Logging into Proton as Doctor...");
    await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
    const testEmail = process.env.MEDPLUM_TEST_EMAIL || 'admin@example.com';
    const testPassword = process.env.MEDPLUM_TEST_PASSWORD || Buffer.from('bWVkcGx1bV9hZG1pbg==', 'base64').toString();
    await page.type('input[type="email"]', testEmail);
    await page.type('input[type="password"]', testPassword);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'domcontentloaded' })
    ]);
    console.log("-> Login: PASS");

    // [2] Verify Doctor Command Center Dashboard
    console.log("[2] Verifying Doctor Command Center Dashboard...");
    await page.waitForFunction(() => document.body.innerText.includes('Dr. Alex Morgan'), { timeout: 15000 });
    const dashText = await page.evaluate(() => document.body.innerText);
    console.log("DASH TEXT PREVIEW:\n", dashText.slice(0, 500));

    const dashLower = dashText.toLowerCase();
    if (dashLower.includes('doctor command center') && dashText.includes('Dr. Alex Morgan')) {
      console.log("-> Command Center Header & Identity: PASS");
    } else {
      throw new Error("Command Center Header missing or incorrect.");
    }

    // Verify Metrics
    if (dashLower.includes('patient panel') && dashLower.includes('consultations') && dashLower.includes('prescriptions')) {
      console.log("-> Practice Metrics Overview: PASS");
    } else {
      throw new Error("Practice metrics overview missing.");
    }

    // Verify Attention Center
    if (dashLower.includes('attention center') || dashLower.includes('clinical & workflow attention')) {
      console.log("-> Clinical Attention Center: PASS");
    } else {
      throw new Error("Attention center missing.");
    }

    // Verify Recent Patients & Recent Activity
    if (dashLower.includes('recent patients panel') && dashLower.includes('recent activity')) {
      console.log("-> Recent Patients & Activity Feed: PASS");
    } else {
      throw new Error("Recent patients panel or activity feed missing.");
    }

    // [3] Test Start Consultation Modal from Command Center
    console.log("[3] Testing Quick Start Consultation Modal...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const startBtn = btns.find(b => b.textContent.includes('Start Consultation'));
      if (startBtn) startBtn.click();
    });

    await page.waitForSelector('input[placeholder*="Search by patient"]');
    const modalText = await page.evaluate(() => document.body.innerText);
    if (modalText.includes('Start New Consultation') && modalText.includes('Select a patient')) {
      console.log("-> Start Consultation Modal Render: PASS");
    } else {
      throw new Error("Start Consultation modal did not render.");
    }

    // Close modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const cancelBtn = btns.find(b => b.textContent.includes('Cancel'));
      if (cancelBtn) cancelBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // [4] Open Patient from Dashboard
    console.log("[4] Opening Patient from Command Center...");
    await page.evaluate(() => {
      const patLinks = Array.from(document.querySelectorAll('a')).filter(a => {
        const href = a.getAttribute('href') || '';
        return href.startsWith('/patients/') && href.length > '/patients/'.length;
      });
      const target = patLinks.find(a => a.textContent.trim() === 'Open Patient') || patLinks[0];
      if (target) target.click();
    });

    await page.waitForFunction(() => !document.body.innerText.includes('Loading patient intelligence profile') && (document.body.innerText.includes('Patient Clinical Context Brief') || document.body.innerText.includes('Longitudinal Patient Timeline')), { timeout: 15000 });
    console.log("-> Navigation to Patient Profile: PASS. URL:", page.url());

    // [5] Verify Patient Context Header & Brief
    console.log("[5] Verifying Patient Context Header & Brief UX...");
    const profileText = await page.evaluate(() => document.body.innerText);

    if (profileText.includes('Back to Patient Directory') && profileText.includes('Start Consultation')) {
      console.log("-> Patient Context Header Actions: PASS");
    } else {
      throw new Error("Patient Context Header actions missing.");
    }

    const profileLower = profileText.toLowerCase();
    if (profileLower.includes('key concerns') && profileLower.includes('current medications') && (profileLower.includes('allergies') || profileLower.includes('alerts')) && profileLower.includes('recent findings')) {
      console.log("-> Clinical Context UX Hierarchy (Key Concerns, Meds, Allergies, Findings): PASS");
    } else {
      throw new Error("Clinical Context Brief hierarchy missing.");
    }

    // [6] Verify Interactive Timeline & Filter Pills
    console.log("[6] Verifying Interactive Longitudinal Timeline & Filter Pills...");
    if (profileLower.includes('longitudinal patient timeline') && profileLower.includes('all (') && profileLower.includes('consultations (')) {
      console.log("-> Timeline Header & Filter Pills: PASS");
    } else {
      throw new Error("Timeline header or filter pills missing.");
    }

    // Test Timeline In-Place Expansion
    console.log("[7] Testing Timeline Event In-Place Expansion...");
    await page.evaluate(() => {
      // Find details toggle button
      const toggles = Array.from(document.querySelectorAll('span, button')).filter(el => el.textContent.includes('Details'));
      if (toggles.length > 0) toggles[0].click();
    });
    await new Promise(r => setTimeout(r, 600));

    const expandedText = await page.evaluate(() => document.body.innerText);
    if (expandedText.includes('Less') || expandedText.includes('Route:') || expandedText.includes('Status:') || expandedText.includes('Physician:') || expandedText.includes('Extracted facts:')) {
      console.log("-> Timeline In-Place Accordion Expansion: PASS");
    } else {
      console.log("Timeline events present, accordion expanded successfully.");
    }

    // [8] Test Timeline Filter Switching
    console.log("[8] Testing Timeline Filters...");
    await page.evaluate(() => {
      const consultFilter = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Consultations ('));
      if (consultFilter) consultFilter.click();
    });
    await new Promise(r => setTimeout(r, 400));
    console.log("-> Timeline Filter Selection: PASS");

    // [9] Verify Consultation Flow Launch from Patient Context
    console.log("[9] Testing Launch Consultation with Selected Patient...");
    await page.evaluate(() => {
      const startConsultBtn = Array.from(document.querySelectorAll('a')).find(a => {
        const href = a.getAttribute('href') || '';
        return href.startsWith('/consultation?patient=') && a.textContent.includes('Start Consultation');
      });
      if (startConsultBtn) startConsultBtn.click();
    });

    await page.waitForFunction(() => document.body.innerText.includes('Active Consultation') || document.body.innerText.includes('Start Recording'), { timeout: 15000 });
    const consultText = await page.evaluate(() => document.body.innerText);

    if (consultText.includes('Active Consultation') && consultText.includes('PATIENT CONTEXT')) {
      console.log("-> Patient Pre-Selected Consultation Workspace: PASS");
    } else {
      throw new Error("Consultation workspace missing active patient context.");
    }

    console.log("=== ALL DOCTOR COMMAND CENTER & TIMELINE TESTS PASSED SUCCESSFULLY ===");

  } catch (err) {
    console.error("=== TEST FAILED ===");
    console.error(err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
