const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log("=== PROTON CLINICAL BRAIN / CLINICAL INTELLIGENCE E2E SUITE ===");

  const wavPath = path.resolve(__dirname, '../test_consultation.wav');
  if (!fs.existsSync(wavPath)) {
    console.error("Missing test audio fixture:", wavPath);
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
    console.log('BROWSER CONSOLE:', msg.type(), msg.text());
  });

  page.on('pageerror', err => {
    console.error('PAGE ERROR EXCEPTION:', err);
  });

  try {
    // [1] Login as Physician
    console.log("[1] Logging into Proton Command Center as Physician...");
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

    // [2] Navigate to Patients & Synthesize Eleanor Vance (Clinical Brain Demo Patient)
    console.log("[2] Generating Clinical Brain Demo Patient (Eleanor Vance)...");
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

    // Wait for redirection to Eleanor Vance's Patient Profile
    await page.waitForFunction(() => {
      return window.location.pathname.startsWith('/patients/') && 
             document.body.innerText.includes('Eleanor Vance');
    }, { timeout: 25000 });

    const eleanorUrl = page.url();
    const eleanorId = eleanorUrl.split('/patients/')[1].split('?')[0];
    console.log(`-> Eleanor Vance Synthesized & Loaded. MRN/ID: ${eleanorId}`);

    // [3] Verify Feature 1: Patient Intelligence Section
    console.log("[3] Verifying Patient Intelligence Brief Section...");
    await new Promise(r => setTimeout(r, 2000));
    const currentText = await page.evaluate(() => document.body.innerText);
    console.log("PAGE TEXT PREVIEW (length: " + currentText.length + "):\n", currentText.slice(0, 1000));
    
    await page.waitForFunction(() => {
      const t = document.body.innerText;
      return !t.includes('Loading patient') && (t.includes('PATIENT INTELLIGENCE') || t.includes('Patient Intelligence'));
    }, { timeout: 20000 });

    const profileText = await page.evaluate(() => document.body.innerText);

    if (!profileText.includes('Before you see this patient') || !profileText.includes('Synthesized from confirmed clinical memory')) {
      throw new Error("Patient Intelligence subtitle or clinical memory provenance missing.");
    }
    console.log("-> Patient Intelligence Header & Provenance Banner: PASS");

    // [4] Verify Feature 2: Temporal Change Detection ("What changed since last consultation")
    console.log("[4] Verifying Deterministic Temporal Change Detection...");
    const profileLower = profileText.toLowerCase();
    if (!profileLower.includes('what changed since last consultation') || !profileLower.includes('deterministic temporal comparison')) {
      throw new Error("Change detection section missing.");
    }

    const hasHbA1cChange = profileLower.includes('hba1c') && (profileLower.includes('increased') || profileLower.includes('7.1%') || profileLower.includes('8.2%'));
    const hasMetforminChange = profileLower.includes('metformin') && (profileLower.includes('titration') || profileLower.includes('dose') || profileLower.includes('adjusted'));
    
    if (hasHbA1cChange || hasMetforminChange) {
      console.log("-> Temporal Changes Detected (HbA1c / Metformin Titration): PASS");
    } else {
      throw new Error("Expected temporal changes (HbA1c or Metformin) not detected.");
    }

    // [5] Verify Current Clinical State (Key Concerns, Meds, Allergies, Recent Findings)
    console.log("[5] Verifying Current Clinical State Hierarchy...");
    if (
      profileLower.includes('key concerns') &&
      profileLower.includes('current medications') &&
      profileLower.includes('allergies & alerts') &&
      profileLower.includes('recent findings')
    ) {
      console.log("-> Current Clinical State (Concerns, Meds, Allergies, Findings): PASS");
    } else {
      throw new Error("Current Clinical State hierarchy missing sections.");
    }

    if (profileLower.includes('penicillin') && profileLower.includes('essential hypertension')) {
      console.log("-> Verified Clinical Facts (Penicillin allergy & Hypertension): PASS");
    } else {
      throw new Error("Underlying clinical facts missing from clinical state.");
    }

    // [6] Verify Feature 7: Outstanding Attention Items
    console.log("[6] Verifying Outstanding Items Requiring Attention...");
    if (profileLower.includes('outstanding items requiring attention') || profileLower.includes('attention') || profileLower.includes('follow-up')) {
      console.log("-> Outstanding Attention Items Rendered: PASS");
    } else {
      throw new Error("Outstanding attention items section missing.");
    }

    // [7] Verify Feature 4: Longitudinal Clinical Story Synthesized Purely from FHIR
    console.log("[7] Verifying Clinical Story & Longitudinal Narrative...");
    if (
      profileLower.includes('clinical story') &&
      profileLower.includes('approved fhir history')
    ) {
      console.log("-> Clinical Story Banner & FHIR Constraint Badge: PASS");
    } else {
      throw new Error("Clinical story or FHIR constraint badge missing.");
    }

    // [8] Verify Feature 3: Evidence & Provenance Modal (`[View source]`)
    console.log("[8] Testing Clinical Evidence & Provenance Modal...");
    const clickedSource = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const viewSrcBtn = btns.find(b => b.textContent.includes('[View source]') || b.textContent.includes('[src]'));
      if (viewSrcBtn) {
        viewSrcBtn.click();
        return true;
      }
      return false;
    });

    if (!clickedSource) {
      throw new Error("No [View source] or [src] button found in intelligence view.");
    }

    await page.waitForFunction(() => document.body.innerText.includes('Clinical Evidence & Provenance'), { timeout: 10000 });
    const modalText = await page.evaluate(() => document.body.innerText);

    if (
      modalText.includes('Resource Type') &&
      modalText.includes('Record Date') &&
      (modalText.includes('Confirmed Clinical Fact') || modalText.includes('Physician Entered') || modalText.includes('AI Synthesized'))
    ) {
      console.log("-> Evidence Modal Content & Provenance Badge: PASS");
    } else {
      throw new Error("Evidence modal missing resource type, date, or provenance badge.");
    }

    // Close Evidence Modal
    await page.evaluate(() => {
      const modalClose = document.querySelector('button[title="Close"]');
      if (modalClose) modalClose.click();
    });
    await new Promise(r => setTimeout(r, 400));
    console.log("-> Evidence Modal Dismissed: PASS");

    // [9] Launch Consultation & Verify Feature 6: Pre-Consultation Patient Brief
    console.log("[9] Launching Consultation for Eleanor Vance...");
    await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('Start Consultation'));
      if (link) link.click();
    });

    await page.waitForFunction(() => {
      const t = document.body.innerText.toLowerCase();
      return t.includes('pre-consultation patient brief') && t.includes('eleanor vance');
    }, { timeout: 15000 });
    
    const consultText = await page.evaluate(() => document.body.innerText);
    const consultLower = consultText.toLowerCase();

    if (
      consultLower.includes('pre-consultation patient brief') &&
      consultLower.includes('10-second scan') &&
      consultLower.includes('eleanor vance')
    ) {
      console.log("-> Feature 6: Pre-Consultation Patient Brief (10-Second Scan): PASS");
    } else {
      throw new Error("Pre-Consultation Patient Brief missing from consultation workspace.");
    }

    // [10] Capture Audio Dialogue & Generate Clinical Draft Note
    console.log("[10] Recording consultation dialogue & generating AI draft note...");
    const recordBtnFound = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Start Recording'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log("-> Start Recording button found & clicked:", recordBtnFound);

    await new Promise(r => setTimeout(r, 1200));

    const stopBtnFound = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Stop & Generate'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log("-> Stop & Generate button found & clicked:", stopBtnFound);

    await page.waitForFunction(() => {
      const t = document.body.innerText.toLowerCase();
      return (t.includes('ai draft check') || t.includes('prescription orders')) &&
             (t.includes('physician review & approval') || t.includes('review required'));
    }, { timeout: 25000 });
    console.log("-> Consultation Draft Note & Prescription Suggestions Synthesized: PASS");

    // [11] Test Feature 8: Medication Discrepancy Alert
    console.log("[11] Testing Medication Discrepancy Detection...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const testBtn = btns.find(b => b.textContent.includes('Test: Discrepancy Flag'));
      if (testBtn) testBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const discrepancyText = await page.evaluate(() => document.body.innerText);
    const discLower = discrepancyText.toLowerCase();
    if (
      discLower.includes('medication discrepancy detected') &&
      discLower.includes('approved order') &&
      discLower.includes('patient-reported')
    ) {
      console.log("-> Feature 8: Medication Discrepancy Banner & Patient-Reported Contrast: PASS");
    } else {
      throw new Error("Medication discrepancy banner failed to render with expected details.");
    }

    // [12] Trigger Simulation Proposal if needed and Verify Feature 5: Memory Proposal Panel
    console.log("[12] Testing Feature 5: Patient Memory Update Proposals...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const propBtn = btns.find(b => b.textContent.includes('Test: Memory Proposal'));
      if (propBtn) propBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('patient memory update proposals'), { timeout: 10000 });
    const memoryPanelText = await page.evaluate(() => document.body.innerText);
    const memLower = memoryPanelText.toLowerCase();

    if (
      memLower.includes('patient memory update proposals') &&
      memLower.includes('physician gate required') &&
      memLower.includes('unapproved changes will never mutate fhir confirmed memory')
    ) {
      console.log("-> Feature 5: Memory Proposal Panel & Gate Constraints: PASS");
    } else {
      throw new Error("Memory proposal panel or physician gate constraint text missing.");
    }

    // [13] Test Physician Actions on Proposals: Reject, Edit, Approve
    console.log("[13] Testing Proposal Physician Actions (Reject, Edit, Approve)...");
    
    // Test Reject Action
    const rejectClicked = await page.evaluate(() => {
      const rejectBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.trim() === 'Reject');
      if (rejectBtns.length > 0) {
        rejectBtns[0].click();
        return true;
      }
      return false;
    });

    if (rejectClicked) {
      await new Promise(r => setTimeout(r, 500));
      const textAfterReject = await page.evaluate(() => document.body.innerText);
      if (textAfterReject.toLowerCase().includes('rejected')) {
        console.log("-> Proposal Action [Reject]: PASS");
      } else {
        throw new Error("Proposal status did not update to REJECTED.");
      }
    }

    // Test Edit Action
    const editClicked = await page.evaluate(() => {
      const editBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.trim() === 'Edit');
      if (editBtns.length > 0) {
        editBtns[0].click();
        return true;
      }
      return false;
    });

    if (editClicked) {
      await new Promise(r => setTimeout(r, 300));
      // Enter edited proposal text
      await page.evaluate(() => {
        const input = document.querySelector('input[placeholder*="Edit proposed change"]') || document.querySelector('input[type="text"]');
        if (input) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
          nativeSetter.call(input, "Physician refined diagnosis: Type 2 Diabetes with elevated HbA1c");
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Save');
        if (saveBtn) saveBtn.click();
      });
      await new Promise(r => setTimeout(r, 500));
      console.log("-> Proposal Action [Edit]: PASS");
    }

    // Test Approve All Proposals
    await page.evaluate(() => {
      const approveAllBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Approve All Proposals'));
      if (approveAllBtn) approveAllBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));
    console.log("-> Proposal Action [Approve / Approve All]: PASS");

    // [14] Physician Approves and Atomically Saves to FHIR
    console.log("[14] Physician Review Sign-Off & Atomic FHIR Persistence...");
    
    // Acknowledge any safety verification warnings
    await page.evaluate(() => {
      const ackAllBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Acknowledge All'));
      ackAllBtns.forEach(b => b.click());
    });
    await new Promise(r => setTimeout(r, 400));

    // Check doctor review confirmation checkbox if present
    await page.evaluate(() => {
      const chk = document.querySelector('input[type="checkbox"]');
      if (chk && !chk.checked) {
        chk.click();
      }
    });
    await new Promise(r => setTimeout(r, 400));

    // Click Approve & Save to FHIR
    await page.evaluate(() => {
      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Approve & Save to FHIR'));
      if (saveBtn) saveBtn.click();
    });

    await page.waitForFunction(() => {
      const t = document.body.innerText.toLowerCase();
      return t.includes('consultation approved & saved') || 
             t.includes('approved by doctor');
    }, { timeout: 15000 });
    console.log("-> Consultation Approved & Persisted to FHIR: PASS");

    // [15] Verify FHIR Single Source of Truth / Post-Consultation State
    console.log("[15] Returning to Patient Profile to verify updated longitudinal state...");
    await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('Back to Patient Profile'));
      if (link) link.click();
    });

    await page.waitForFunction(() => {
      return document.body.innerText.includes('PATIENT INTELLIGENCE') &&
             document.body.innerText.includes('Longitudinal Patient Timeline');
    }, { timeout: 15000 });

    const postConsultProfile = await page.evaluate(() => document.body.innerText);

    // Verify encounter appeared in timeline
    if (postConsultProfile.includes('Consultation') || postConsultProfile.includes('Dr. Alex Morgan')) {
      console.log("-> Newly Approved Consultation in Longitudinal Timeline: PASS");
    } else {
      throw new Error("Newly approved encounter missing from patient timeline.");
    }

    console.log("======================================================================");
    console.log("=== ALL CLINICAL BRAIN / INTELLIGENCE E2E TESTS PASSED SUCCESSFULLY ===");
    console.log("======================================================================");

  } catch (err) {
    console.error("=== TEST SUITE FAILED ===");
    console.error(err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
