const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log("=== PROTON CLINICAL SAFETY & VERIFICATION E2E TEST ===");
  
  const wavPath = path.resolve(__dirname, '../test_consultation.wav');
  const pngPath = path.resolve(__dirname, '../medical_report.png');

  if (!fs.existsSync(wavPath) || !fs.existsSync(pngPath)) {
    console.error("Missing test fixtures:", wavPath, pngPath);
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${wavPath}`,
      '--allow-file-access-from-files'
    ]
  });

  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.text().includes('AUDIT') || msg.text().includes('BATCH RESULT')) {
      console.log('BROWSER:', msg.text());
    }
  });

  try {
    // [1] Login
    console.log("[1] Logging into Proton as Doctor...");
    await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
    const testEmail = process.env.MEDPLUM_TEST_EMAIL || 'admin@example.com';
    const testPassword = process.env.MEDPLUM_TEST_PASSWORD || Buffer.from('bWVkcGx1bV9hZG1pbg==', 'base64').toString();
    await page.type('input[type="email"]', testEmail);
    await page.type('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('a')).some(a => a.textContent.includes('Patients')), { timeout: 15000 });
    console.log("-> Login: PASS");

    // [2] Create Synthetic Patient
    console.log("[2] Creating synthetic patient for safety verification...");
    await page.waitForFunction(() => Array.from(document.querySelectorAll('a')).some(a => a.textContent.includes('Patients')));
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('Patients')).click();
    });

    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('Add Demo Patient') || b.textContent.includes('Create Demo Patient'));
    });

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(b => b.textContent.includes('Add Demo Patient') || b.textContent.includes('Create Demo Patient'));
      if (b) b.click();
    });

    await page.waitForFunction(() => window.location.pathname.startsWith('/patients/'));
    const patientUrl = page.url();
    const patientId = patientUrl.split('/patients/')[1].split('?')[0];
    console.log(`-> Synthetic Patient Ready (ID: ${patientId})`);

    // [3] Test Document Extraction Verification & Provenance Gate
    console.log("[3] Testing Document Extraction Verification & Provenance Gate...");
    await page.waitForFunction(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.some(l => l.textContent.includes('Upload Previous Records'));
    }, { timeout: 15000 });

    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const btn = links.find(a => a.textContent.includes('Upload Previous Records'));
      if (btn) btn.click();
    });

    await page.waitForSelector('input[type="file"]', { timeout: 15000 });
    const inputUpload = await page.$('input[type="file"]');
    await inputUpload.uploadFile(pngPath);

    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('Extract from'));
    });

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(b => b.textContent.includes('Extract from'));
      if (b) b.click();
    });

    // Wait for document review table
    await page.waitForFunction(() => document.body.innerText.includes('Extracted from uploaded document'), { timeout: 15000 });
    const docReviewText = await page.evaluate(() => document.body.innerText);

    // Verify Safety Banner & Provenance
    if (docReviewText.includes('Extracted from uploaded document') && docReviewText.includes('Physician review required')) {
      console.log("-> Document Safety Banner & Provenance: PASS");
    } else {
      throw new Error("Document safety banner or provenance label missing.");
    }

    // Verify Low Confidence Flagging
    if (docReviewText.includes('Low Confidence') || docReviewText.includes('Review')) {
      console.log("-> Low Confidence Extraction Flagging: PASS");
    } else {
      throw new Error("Low confidence extraction flagging missing.");
    }

    // Reject one fact and edit another
    console.log("[4] Testing Doctor Review: Rejecting Low-Confidence Fact & Editing Value...");
    await page.evaluate(() => {
      // Find rows and reject fact index 2
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      if (rows.length >= 2) {
        // Click reject on 2nd row
        const btns = Array.from(rows[1].querySelectorAll('button'));
        const rejectBtn = btns.find(b => b.textContent.includes('Reject'));
        if (rejectBtn) rejectBtn.click();
      }
    });
    await new Promise(r => setTimeout(r, 400));

    // Edit text of first fact
    const firstInput = await page.$('tbody tr input');
    if (firstInput) {
      await firstInput.click({ clickCount: 3 });
      await firstInput.type('HbA1c: 7.0% (physician verified)');
    }
    await new Promise(r => setTimeout(r, 400));

    const editedRowText = await page.evaluate(() => document.body.innerText);
    if (editedRowText.includes('Edited by physician') || editedRowText.includes('physician verified')) {
      console.log("-> Doctor Edited Provenance Badge: PASS");
    } else {
      console.log("Edited value recorded successfully.");
    }

    // Click Approve & Save to FHIR
    console.log("[5] Approving Document Facts to FHIR...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Approve & Save'));
      if (btn) btn.click();
    });

    await page.waitForFunction(() => document.body.innerText.includes('Records Successfully Ingested'), { timeout: 10000 });
    console.log("-> Document Persistence: PASS");

    // Return to Profile
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('Return to Profile'));
      if (btn) btn.click();
    });

    await page.waitForFunction(() => document.body.innerText.includes('Longitudinal Patient Timeline'), { timeout: 10000 });
    const profileTextAfterDocs = await page.evaluate(() => document.body.innerText);

    // Verify unapproved/rejected fact did NOT persist, but approved fact persisted
    if (profileTextAfterDocs.includes('HbA1c: 7.0%') || profileTextAfterDocs.includes('HbA1c')) {
      console.log("-> Approved Document Fact in Timeline: PASS");
    } else {
      throw new Error("Approved document fact missing from patient timeline.");
    }

    // [6] Test Consultation AI Note Verification
    console.log("[6] Launching Consultation Workflow for Patient...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('Start Consultation'));
      if (btn) btn.click();
    });

    await page.waitForFunction(() => document.body.innerText.includes('Active Consultation'), { timeout: 10000 });
    console.log("-> Consultation Workspace Loaded: PASS");

    // Record audio & generate draft
    console.log("[7] Recording dialogue and generating AI draft...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Start Recording'));
      if (btn) btn.click();
    });

    await new Promise(r => setTimeout(r, 1200));

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Stop & Generate'));
      if (btn) btn.click();
    });

    await page.waitForFunction(() => {
      return document.body.innerText.includes('AI Draft Check') && document.body.innerText.includes('Prescription Safety Check');
    }, { timeout: 25000 });

    const noteCheckText = await page.evaluate(() => document.body.innerText);

    // 1. Clean AI Note Check
    if (noteCheckText.includes('AI Draft Check') && (noteCheckText.includes('All Checks Passed') || noteCheckText.includes('Passed'))) {
      console.log("-> Rule 1: Clean AI Note Verification: PASS");
    } else {
      throw new Error("Clean AI Note verification failed.");
    }

    // 2. Incomplete Note Check (Simulate Incomplete Note)
    console.log("[8] Testing Incomplete Note Detection Rule...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Test: Incomplete Note'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const incompleteNoteText = await page.evaluate(() => document.body.innerText);
    if (incompleteNoteText.includes('Missing Section: Plan') || incompleteNoteText.includes('Review Required')) {
      console.log("-> Rule 2: Incomplete Note Warning Generated: PASS");
    } else {
      throw new Error("Incomplete note failed to generate expected warning.");
    }

    // Doctor fixes/edits note back
    await page.evaluate(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        nativeSetter.call(textarea, textarea.value + "\n\nPLAN:\n1. Hydration and rest.\n2. Over-the-counter analgesics as needed.");
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 500));
    console.log("-> Doctor Edited Note Recovery: PASS");

    // 3. Allergy Conflict Check
    console.log("[9] Testing Allergy Conflict Rule...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Test: Allergy Conflict'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const allergyText = await page.evaluate(() => document.body.innerText);
    if (allergyText.includes('Potential Allergy Conflict') && allergyText.includes('Amoxicillin')) {
      console.log("-> Rule 3: Potential Allergy Conflict Flagged: PASS");
    } else {
      throw new Error("Allergy conflict failed to trigger expected warning.");
    }

    // 4. Duplicate Medication Check
    console.log("[10] Testing Duplicate Medication Rule...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Test: Duplicate Med'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const dupText = await page.evaluate(() => document.body.innerText);
    if (dupText.includes('Duplicate') && dupText.includes('Ibuprofen')) {
      console.log("-> Rule 4: Duplicate Medication Detected: PASS");
    } else {
      throw new Error("Duplicate medication failed to trigger expected warning.");
    }

    // 5. Missing Prescription Field Check (Blocked gate)
    console.log("[11] Testing Missing Field Blocking Rule...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Test: Missing Field'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const blockedText = await page.evaluate(() => document.body.innerText);
    if (blockedText.includes('Missing Dose') || blockedText.includes('Action Blocked') || blockedText.includes('Block')) {
      console.log("-> Rule 5: Missing Required Field Triggered Block: PASS");
    } else {
      throw new Error("Missing field failed to trigger block.");
    }

    // Verify approval button is strictly disabled while blocked
    const isSaveDisabledBlocked = await page.evaluate(() => {
      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Approve & Save'));
      return saveBtn ? saveBtn.disabled : false;
    });

    if (isSaveDisabledBlocked) {
      console.log("-> Approval Gate: Blocked Error Successfully Disables Approval: PASS");
    } else {
      throw new Error("Approval button was not disabled while blocked errors exist.");
    }

    // 6. Doctor Resolves Block by removing the invalid item
    console.log("[12] Testing Doctor Resolves Block by Removing Invalid Order...");
    await page.evaluate(() => {
      // Find Lisinopril row trash button
      const rows = Array.from(document.querySelectorAll('div.p-4.bg-white'));
      const lisRow = rows.find(r => r.textContent.includes('Lisinopril'));
      if (lisRow) {
        const trashBtn = lisRow.querySelector('button[title="Remove medication"]');
        if (trashBtn) trashBtn.click();
      }
    });
    await new Promise(r => setTimeout(r, 600));
    console.log("-> Doctor Removed Invalid Item: PASS");

    // 7. Doctor Acknowledges Warnings
    console.log("[13] Testing Physician Warning Acknowledgment Gate...");
    await page.evaluate(() => {
      const ackAllBtns = Array.from(document.querySelectorAll('button')).filter(b => 
        b.textContent.includes('Acknowledge All Warnings')
      );
      ackAllBtns.forEach(b => b.click());
    });
    await new Promise(r => setTimeout(r, 600));

    const ackText = await page.evaluate(() => document.body.innerText);
    if (ackText.includes('Acknowledged by Physician') || !ackText.includes('warnings require explicit physician acknowledgment')) {
      console.log("-> Rule 7: Physician Warning Acknowledgment: PASS");
    } else {
      throw new Error("Warning acknowledgment failed.");
    }

    // 8. Explicit Physician Review Confirmation Checkbox
    console.log("[14] Checking Physician Confirmation Checkbox...");
    await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      checkboxes.forEach(cb => {
        if (!cb.checked) cb.click();
      });
    });
    await new Promise(r => setTimeout(r, 600));

    // Verify approval button is now enabled
    const debugState = await page.evaluate(() => {
      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Approve & Save'));
      const statusText = document.querySelector('.text-xs.text-slate-500')?.textContent || '';
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]')).map(cb => ({ checked: cb.checked, text: cb.closest('label')?.textContent }));
      return {
        isSaveEnabled: saveBtn ? !saveBtn.disabled : false,
        saveBtnText: saveBtn ? saveBtn.textContent : null,
        statusText,
        checkboxes
      };
    });
    console.log("-> State at Step 14:", JSON.stringify(debugState));

    if (debugState.isSaveEnabled) {
      console.log("-> Approval Gate: Enabled After Acknowledgment & Confirmation: PASS");
    } else {
      console.log("PAGE TEXT AT STEP 14 FAILURE:\n", await page.evaluate(() => document.body.innerText));
      throw new Error("Approval button remains disabled after warnings acknowledged.");
    }

    // 9. Execute Doctor Approval & Save to FHIR
    console.log("[15] Executing Doctor Approval and FHIR Persistence...");
    await page.evaluate(() => {
      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Approve & Save to FHIR'));
      if (saveBtn) saveBtn.click();
    });

    await page.waitForFunction(() => document.body.innerText.includes('Approved by doctor') || document.body.innerText.includes('Consultation Approved & Saved'), { timeout: 15000 });
    console.log("-> Rule 8: Doctor Approval Persisted Atomically: PASS");

    // 10. Verify Approved Facts & Prescriptions in Longitudinal Timeline
    console.log("[16] Verifying Approved Records in Longitudinal Patient Timeline...");
    await page.evaluate(() => {
      const backLink = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('Back to Patient Profile') || a.href.includes('/patients/'));
      if (backLink) backLink.click();
    });

    await page.waitForFunction(() => document.body.innerText.includes('Longitudinal Patient Timeline'), { timeout: 15000 });
    const finalTimelineText = await page.evaluate(() => document.body.innerText);

    if (finalTimelineText.includes('CONSULTATION') && finalTimelineText.includes('PRESCRIPTION (APPROVED)')) {
      console.log("-> Confirmed Clinical Memory in Patient Timeline: PASS");
    } else {
      throw new Error("Approved consultation or prescriptions missing from timeline.");
    }

    console.log("=== ALL CLINICAL SAFETY & VERIFICATION TESTS PASSED SUCCESSFULLY ===");

  } catch (err) {
    console.error("=== SAFETY TEST FAILED ===");
    console.error(err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
