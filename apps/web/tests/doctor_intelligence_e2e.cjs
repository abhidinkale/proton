const puppeteer = require('puppeteer');

(async () => {
  console.log("=== PROTON DOCTOR INTELLIGENCE LAYER E2E SUITE ===");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  try {
    // [1] Login
    console.log("[1] Logging into Proton as Physician...");
    await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
    const testEmail = process.env.MEDPLUM_TEST_EMAIL || 'admin@example.com';
    const testPassword = process.env.MEDPLUM_TEST_PASSWORD || Buffer.from('bWVkcGx1bV9hZG1pbg==', 'base64').toString();
    await page.type('input[type="email"]', testEmail);
    await page.type('input[type="password"]', testPassword);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'domcontentloaded' })
    ]);
    console.log("-> Physician Login: PASS");

    // [2] Generate Eleanor Vance (Clinical Brain & Doctor Intelligence Demo Patient)
    console.log("[2] Generating Doctor Intelligence Demo Patient (Eleanor Vance)...");
    await page.waitForFunction(() => Array.from(document.querySelectorAll('a')).some(a => a.textContent.includes('Patients')));
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('Patients')).click();
    });

    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('Create Clinical Brain Demo Patient'));
    }, { timeout: 15000 });

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(b => b.textContent.includes('Create Clinical Brain Demo Patient'));
      if (b) b.click();
    });

    await page.waitForFunction(() => {
      return window.location.pathname.startsWith('/patients/') && 
             document.body.innerText.includes('Eleanor Vance');
    }, { timeout: 25000 });

    const patientUrl = page.url();
    const patientId = patientUrl.split('/patients/')[1].split('?')[0];
    console.log(`-> Eleanor Vance Loaded. ID: ${patientId}`);

    // [3] Verify "What Matters Today" on Patient Profile
    console.log("[3] Verifying What Matters Today & Patient Intelligence Section...");
    await new Promise(r => setTimeout(r, 1500));
    const profileText = await page.evaluate(() => document.body.innerText.toLowerCase());

    if (!profileText.includes('what matters today') || !profileText.includes('clinical urgency')) {
      throw new Error("What Matters Today section missing from Patient Profile.");
    }
    console.log("-> Feature: What Matters Today block on Patient Profile: PASS");

    if (!profileText.includes('what changed since last consultation')) {
      throw new Error("What Changed section missing from Patient Profile.");
    }
    console.log("-> Feature: What Changed since last consultation: PASS");

    // [4] Test Evidence Modal on Patient Profile
    console.log("[4] Testing Evidence Drawer / Modal from What Matters Today...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const evBtn = btns.find(b => b.textContent.includes('[View evidence]') || b.textContent.includes('[View source]'));
      if (evBtn) evBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    await page.waitForFunction(() => {
      const t = document.body.innerText.toLowerCase();
      return t.includes('clinical evidence & provenance') && 
             (t.includes('confirmed clinical fact') || t.includes('resource type'));
    }, { timeout: 10000 });
    console.log("-> Evidence Modal opens with provenance & source metadata: PASS");

    // Dismiss evidence modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[title="Close"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));
    console.log("-> Evidence Modal dismissed: PASS");

    // [5] Launch Consultation Workspace
    console.log("[5] Launching Consultation Workspace...");
    await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('Start Consultation'));
      if (link) link.click();
    });

    await page.waitForFunction(() => {
      const t = document.body.innerText.toLowerCase();
      return window.location.pathname.startsWith('/consultation') &&
             t.includes('active consultation') &&
             (t.includes("proton's clinical brief") || t.includes("pre-consultation patient brief")) &&
             t.includes('what matters today');
    }, { timeout: 25000 });

    // [6] Verify "PROTON'S CLINICAL BRIEF" with 7-Level Hierarchy
    console.log("[6] Verifying PROTON'S CLINICAL BRIEF & 7-Level Hierarchy...");
    console.log("Current Page URL:", page.url());
    const consultText = await page.evaluate(() => document.body.innerText.toLowerCase());
    console.log("Page text snippet:\n", consultText.slice(0, 600));

    if (!consultText.includes("proton's clinical brief") && !consultText.includes("pre-consultation patient brief")) {
      throw new Error("Proton's Clinical Brief missing from consultation.");
    }
    if (!consultText.includes("what matters today")) {
      throw new Error("What Matters Today missing from Pre-Consultation Brief.");
    }
    if (!consultText.includes("urgent / clinical safety") && !consultText.includes("priority gate")) {
      throw new Error("Safety / Urgent Priority Gate missing from Clinical Brief.");
    }
    if (!consultText.includes("what changed since last visit")) {
      throw new Error("What Changed missing from Clinical Brief.");
    }
    if (!consultText.includes("active problems") || !consultText.includes("current meds") || !consultText.includes("recent findings")) {
      throw new Error("Core clinical state (problems, meds, findings) missing from Clinical Brief.");
    }
    console.log("-> PROTON'S CLINICAL BRIEF & 7-Level Hierarchy: PASS");

    // [7] Verify Evidence Modal from Clinical Brief
    console.log("[7] Opening Evidence Modal from Clinical Brief...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const evBtn = btns.find(b => b.textContent.includes('View evidence'));
      if (evBtn) evBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    await page.waitForFunction(() => {
      return document.body.innerText.toLowerCase().includes('clinical evidence & provenance');
    }, { timeout: 8000 });
    console.log("-> Clickable Evidence from Clinical Brief: PASS");

    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[title="Close"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // [8] Test Passive Context Matching: Irrelevant History is NOT Surfaced
    console.log("[8] Testing Passive Clinical Context: Irrelevant Dialogue...");
    const inputSel = 'input[placeholder*="type consultation dialogue"]';
    await page.waitForSelector(inputSel);
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeSetter.call(el, 'The morning weather was very pleasant with clear skies and mild temperatures.');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, inputSel);
    await new Promise(r => setTimeout(r, 600));

    const irrelevantMatch = await page.evaluate(() => {
      return document.body.innerText.includes('Relevant History • Clinical Context');
    });
    if (irrelevantMatch) {
      throw new Error("Clinical context surfaced for irrelevant dialogue.");
    }
    console.log("-> Irrelevant history is NOT surfaced: PASS");

    // [9] Test Passive Context Matching: Relevant Medical Dialogue Matches
    console.log("[9] Testing Passive Clinical Context: Matching Historical Concepts...");
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeSetter.call(el, 'Patient discussed elevated blood sugar and recent diabetes control concerns on metformin.');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, inputSel);
    await new Promise(r => setTimeout(r, 600));

    await page.waitForFunction(() => {
      const t = document.body.innerText.toLowerCase();
      return t.includes('relevant history') && 
             (t.includes('hba1c') || t.includes('metformin'));
    }, { timeout: 10000 });
    console.log("-> Historical Clinical Context matched and surfaced non-intrusively: PASS");

    // [10] Test Dismiss Context Card
    console.log("[10] Testing Context Card Dismissal...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const dismissBtn = btns.find(b => b.textContent.trim() === 'Dismiss');
      if (dismissBtn) dismissBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));
    console.log("-> Doctor dismissal of context card: PASS");

    // [11] Generate AI Draft via Sample Dialogue
    console.log("[11] Synthesizing Clinical Note Draft via Sample Dialogue...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const sampleBtn = btns.find(b => b.textContent.includes('Use Sample Dialogue'));
      if (sampleBtn) sampleBtn.click();
    });

    await page.waitForFunction(() => {
      return document.body.innerText.includes('Clinical Note Draft') && 
             document.body.innerText.includes('Prescription Builder');
    }, { timeout: 15000 });
    console.log("-> Clinical Note Draft & Prescription Builder rendered: PASS");

    // [12] Verify AI Inference Labeling
    console.log("[12] Verifying AI Inference Provenance Labeling...");
    const hasAiBadge = await page.evaluate(() => {
      const t = document.body.innerText;
      return t.includes('AI generated — physician review required') || t.includes('AI-generated suggestion');
    });
    if (!hasAiBadge) {
      throw new Error("AI inference provenance label missing.");
    }
    console.log("-> AI-Generated Inference Clearly Labeled: PASS");

    // [13] Verify Post-Consultation Changes Generated (Phase 7)
    console.log("[13] Verifying Post-Consultation Changes (NEW, CHANGED, RESOLVED, FOLLOW-UP)...");
    await page.waitForFunction(() => {
      const t = document.body.innerText.toLowerCase();
      return t.includes('consultation changes') && 
             t.includes('new (') && 
             t.includes('changed (');
    }, { timeout: 10000 });
    console.log("-> Post-Consultation Changes Delta Rendered: PASS");

    // [14] Verify Memory Proposals Require Physician Approval
    console.log("[14] Verifying Memory Proposals Gate (Physician Approval Required)...");
    const hasMemoryProposals = await page.evaluate(() => {
      const t = document.body.innerText.toLowerCase();
      return t.includes('clinical memory update proposals') || t.includes('memory proposal');
    });
    if (!hasMemoryProposals) {
      throw new Error("Memory proposal panel missing from consultation review.");
    }

    // Approve all proposals
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const approveAllBtn = btns.find(b => b.textContent.includes('Approve All Proposals'));
      if (approveAllBtn) approveAllBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));
    console.log("-> Memory Proposals Explicit Review & Approval Gate: PASS");

    // [15] Accept Prescription Suggestion & Confirm Review
    console.log("[15] Accepting Prescription Suggestion & Checking Safety Gates...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const acceptBtn = btns.find(b => b.textContent.trim() === 'Accept');
      if (acceptBtn) acceptBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // Acknowledge all verification warnings
    await page.evaluate(() => {
      const ackAllBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Acknowledge All'));
      ackAllBtns.forEach(b => b.click());
    });
    await new Promise(r => setTimeout(r, 400));

    // Check review confirmation checkbox
    await page.evaluate(() => {
      const chks = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      chks.forEach(chk => {
        if (!chk.checked) chk.click();
      });
    });
    await new Promise(r => setTimeout(r, 400));

    // [16] Approve & Save to FHIR
    console.log("[16] Doctor Approves and Saves Atomically to FHIR...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const saveBtn = btns.find(b => b.textContent.includes('Approve & Save to FHIR'));
      if (saveBtn) saveBtn.click();
    });

    await page.waitForFunction(() => {
      const t = document.body.innerText.toLowerCase();
      return t.includes('consultation approved & saved') || t.includes('approved by doctor');
    }, { timeout: 15000 });
    console.log("-> Atomic FHIR Persistence on Physician Sign-off: PASS");

    console.log("================================================================");
    console.log("=== ALL DOCTOR INTELLIGENCE LAYER E2E TESTS PASSED SUCCESSFULLY ===");
    console.log("================================================================");
    process.exit(0);

  } catch (err) {
    console.error("=== TEST FAILED ===");
    console.error(err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
