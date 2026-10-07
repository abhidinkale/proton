const puppeteer = require('puppeteer');

(async () => {
  console.log("=== PROTON PHYSICIAN WORKFLOW POLISH & FEEDBACK LOOP E2E TEST ===");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`BROWSER ERROR: ${msg.text()}`);
  });

  try {
    // [1] Login
    console.log("[1] Logging in as Physician...");
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

    // [2] Open Patients & Create Demo Patient
    console.log("[2] Generating Demo Patient for Polish Suite...");
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
      const btn = btns.find(b => b.textContent.includes('Create Clinical Brain Demo Patient'));
      if (btn) btn.click();
    });

    await page.waitForFunction(() => {
      return window.location.pathname.startsWith('/patients/') && 
             document.body.innerText.includes('Eleanor Vance');
    }, { timeout: 25000 });
    const patientUrl = page.url();
    const patientId = patientUrl.split('/patients/')[1].split('?')[0];
    console.log(`-> Demo Patient Ready. ID: ${patientId}`);

    // [3] Navigate to Consultation
    console.log("[3] Opening Consultation Workspace...");
    await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('Start Consultation'));
      if (link) link.click();
    });
    await page.waitForFunction(() => {
      return window.location.pathname.startsWith('/consultation') &&
             document.body.innerText.toLowerCase().includes('consultation');
    }, { timeout: 15000 });

    // [4] Verify Stage Guidance Banner & Primary CTA
    console.log("[4] Verifying Stage Guidance Banner & Primary CTA...");
    console.log("Current Page URL:", page.url());
    const bannerText = await page.evaluate(() => document.body.innerText);
    const bannerLower = bannerText.toLowerCase();
    if (!bannerLower.includes('current stage:') || !bannerText.includes('1. Capture') || !bannerText.includes('Primary Action:')) {
      throw new Error("Stage Guidance Banner or Primary Action missing.");
    }
    console.log("-> Stage Guidance Banner & Primary Action: PASS");

    // [5] Verify Pre-Consultation Clinical Brief Hierarchy
    console.log("[5] Verifying Pre-Consultation Brief Clinical Hierarchy...");
    const briefText = await page.evaluate(() => document.body.innerText.toLowerCase());
    if (
      briefText.includes('pre-consultation patient brief') &&
      briefText.includes('what changed since last visit') &&
      briefText.includes('active problems') &&
      briefText.includes('current meds')
    ) {
      console.log("-> Pre-Consultation Brief Hierarchy: PASS");
    } else {
      throw new Error("Pre-Consultation Brief hierarchy elements missing.");
    }

    // [6] Simulate Dialogue & Generate AI Draft
    console.log("[6] Generating AI Draft via Sample Dialogue...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const sampleBtn = btns.find(b => b.textContent.includes('Use Sample Dialogue'));
      if (sampleBtn) sampleBtn.click();
    });

    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes('Clinical Note Draft') && text.includes('Prescription Builder') && text.includes('Doctor Review & Safety');
    }, { timeout: 15000 });
    console.log("-> AI Draft & Prescription Builder Render: PASS");

    // [7] Verify Stage 3 & Autosave in SessionStorage
    console.log("[7] Verifying Draft Autosave in sessionStorage...");
    const savedDraft = await page.evaluate((pid) => {
      return sessionStorage.getItem(`proton_draft_consultation_${pid}`);
    }, patientId);

    if (!savedDraft) {
      throw new Error("Draft not found in sessionStorage.");
    }
    const parsedDraft = JSON.parse(savedDraft);
    if (!parsedDraft.note || !parsedDraft.status) {
      throw new Error("Draft missing note content or status.");
    }
    console.log("-> Draft Autosave to sessionStorage: PASS");

    // [8] Test Physician Edit Provenance
    console.log("[8] Modifying Note Draft and Verifying Provenance...");
    await page.focus('textarea');
    await page.type('textarea', ' Additional physician note.');
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Edited by physician');
    }, { timeout: 5000 });
    const editedBadge = await page.evaluate(() => {
      return document.body.innerText.includes('Edited by physician');
    });
    if (!editedBadge) {
      throw new Error("Physician edit badge not displayed after note modification.");
    }
    console.log("-> Physician Edited Provenance Badge: PASS");

    // [9] Accept Suggestion & Confirm Review
    console.log("[9] Accepting Prescription Suggestion and Checking Safety Gates...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const acceptBtn = btns.find(b => b.textContent.trim() === 'Accept');
      if (acceptBtn) acceptBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    // Acknowledge any safety verification warnings
    await page.evaluate(() => {
      const ackAllBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Acknowledge All'));
      ackAllBtns.forEach(b => b.click());
    });
    await new Promise(r => setTimeout(r, 400));

    // Confirm review checkbox
    await page.evaluate(() => {
      const cbs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      cbs.forEach(cb => {
        if (!cb.checked) cb.click();
      });
    });
    await new Promise(r => setTimeout(r, 400));

    // [10] Approve & Save to FHIR
    console.log("[10] Approving and Saving Consultation...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const saveBtn = btns.find(b => b.textContent.includes('Approve & Save to FHIR'));
      if (saveBtn) saveBtn.click();
    });

    await page.waitForFunction(() => {
      return document.body.innerText.includes('Consultation Approved & Saved') || document.body.innerText.includes('Approved by doctor');
    }, { timeout: 15000 });
    console.log("-> Consultation Approved & Saved: PASS");

    // [11] Verify Draft Cleanup after Completion
    console.log("[11] Verifying Draft Cleanup from sessionStorage after Approval...");
    const draftAfterComplete = await page.evaluate((pid) => {
      return sessionStorage.getItem(`proton_draft_consultation_${pid}`);
    }, patientId);
    if (draftAfterComplete !== null) {
      throw new Error("Draft was not cleaned up after approved save.");
    }
    console.log("-> Draft Cleanup on Completion: PASS");

    // [12] Test Physician Feedback Loop
    console.log("[12] Testing Post-Consultation Physician Feedback Widget...");
    const hasFeedbackWidget = await page.evaluate(() => {
      return document.body.innerText.includes('Physician Feedback Loop') &&
             document.body.innerText.includes('How useful was Proton for this consultation?');
    });
    if (!hasFeedbackWidget) {
      throw new Error("Physician Feedback Widget missing from completion screen.");
    }

    // Click 5 stars / Essential rating
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const score5Btn = btns.find(b => b.textContent.includes('Essential'));
      if (score5Btn) score5Btn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // Select correction tag
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const tagBtn = btns.find(b => b.textContent.includes('Note Phrasing'));
      if (tagBtn) tagBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // Submit Feedback
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submitBtn = btns.find(b => b.textContent.includes('Submit Feedback'));
      if (submitBtn) submitBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    await page.waitForFunction(() => {
      return document.body.innerText.includes('Your feedback has been recorded');
    }, { timeout: 8000 });
    console.log("-> Physician Feedback Submission: PASS");

    console.log("=== ALL PHYSICIAN WORKFLOW POLISH & FEEDBACK TESTS PASSED ===");
    process.exit(0);

  } catch (err) {
    console.error("=== TEST FAILED ===");
    console.error(err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
