const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const wavPath = path.resolve('test_audio.wav');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: [
      '--disable-web-security', 
      '--proxy-server="direct://"', 
      '--proxy-bypass-list=*', 
      '--disable-http2',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${wavPath}`,
      '--allow-file-access-from-files'
    ]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  page.on('console', msg => {
    console.log('BROWSER CONSOLE:', msg.text());
  });
  
  try {
    console.log("=== PROTON STRUCTURED PRESCRIPTION WORKFLOW E2E TEST ===");
    
    // 1. Login
    console.log("[1] Logging in to Proton...");
    await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]');
    const testEmail = process.env.MEDPLUM_TEST_EMAIL || 'admin@example.com';
    const testPassword = process.env.MEDPLUM_TEST_PASSWORD || Buffer.from('bWVkcGx1bV9hZG1pbg==', 'base64').toString();
    await page.type('input[type="email"]', testEmail);
    await page.type('input[type="password"]', testPassword);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'domcontentloaded' })
    ]);
    console.log("-> Login PASS.");
    
    // 2. Patient Directory & Creation
    console.log("[2] Navigating to Patients & Selecting/Creating Synthetic Patient...");
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
    
    await new Promise(r => setTimeout(r, 4000));
    console.log("-> Synthetic Patient Ready. URL:", page.url());
    const patientProfileUrl = page.url();
    const patientId = patientProfileUrl.split('/').pop();
    console.log("[3] Starting Consultation Workflow for Patient ID:", patientId);
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const l = links.find(l => l.textContent.includes('Start Consultation'));
      if (l) l.click();
    });
    await page.waitForFunction(() => document.body.innerText.includes('Active Consultation'), { timeout: 10000 });
    console.log("-> Active Consultation Page Loaded.");
    const consultTitle = await page.evaluate(() => document.body.innerText);

    // Verify Patient Context in sidebar
    if (consultTitle.toLowerCase().includes('patient context')) {
      console.log("-> Patient Context Verification: PASS");
    } else {
      throw new Error("Patient Context missing from sidebar.");
    }

    // 4. Record & Synthesize Note
    console.log("[4] Recording audio and generating AI clinical draft...");
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('Start Recording'));
    });

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(b => b.textContent.includes('Start Recording'));
      if (b) b.click();
    });

    await new Promise(r => setTimeout(r, 2000));

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(b => b.textContent.includes('Stop & Generate Note'));
      if (b) b.click();
    });

    console.log("-> Waiting for AI generation (transcription + note + Rx suggestions)...");
    await page.waitForFunction(() => {
      const textareas = Array.from(document.querySelectorAll('textarea'));
      return textareas.some(t => t.value.length > 10);
    }, { timeout: 20000 });

    console.log("-> Clinical Note Draft Generated.");

    // 5. Verify AI Suggestions Banner & Labels
    console.log("[5] Verifying AI Prescription Suggestions...");
    const pageText = await page.evaluate(() => document.body.innerText);
    if (pageText.includes('AI DRAFT — REVIEW REQUIRED') || pageText.includes('AI-generated prescription suggestions')) {
      console.log("-> AI Prescription Suggestions Labeling: PASS");
    } else {
      throw new Error("AI Prescription Suggestions label missing.");
    }

    // 6. Test Accepting an AI Suggestion
    console.log("[6] Testing Accept Suggestion...");
    const initialSuggestionsCount = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.filter(b => b.textContent.trim() === 'Accept').length;
    });

    if (initialSuggestionsCount > 0) {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const acceptBtn = btns.find(b => b.textContent.trim() === 'Accept');
        if (acceptBtn) acceptBtn.click();
      });
      await new Promise(r => setTimeout(r, 500));
      console.log("-> Accepted 1 AI Suggestion into Prescription Orders.");
    }

    // 7. Test Adding a Custom Medicine via Composer
    console.log("[7] Testing Composer: Adding Custom Medicine...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const addBtn = btns.find(b => b.textContent.includes('Add Medicine'));
      if (addBtn) addBtn.click();
    });

    await page.waitForSelector('input[placeholder*="Metformin"]');
    
    // Fill composer fields using page.type for reliable React synthetic events
    await page.type('input[placeholder*="Metformin"]', 'Metformin');
    await page.type('input[placeholder*="500 mg"]', '500 mg');

    // Save medicine
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const saveBtn = btns.find(b => b.textContent.includes('Add to Prescription') || b.textContent.includes('Save Medicine'));
      if (saveBtn) saveBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    const postAddText = await page.evaluate(() => document.body.innerText);
    if (postAddText.includes('Metformin') && postAddText.includes('500 mg')) {
      console.log("-> Custom Medicine Addition: PASS (Metformin 500 mg added)");
    } else {
      throw new Error("Metformin not found in Prescription Orders.");
    }

    // 8. Test Doctor Approval Safety Check
    console.log("[8] Testing Doctor Review & Approval Safety Controls...");
    
    // Check if approve button is disabled before checkbox is checked
    const isApproveDisabledInitially = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Approve & Save to FHIR'));
      return btn ? btn.disabled || btn.classList.contains('cursor-not-allowed') : false;
    });

    if (isApproveDisabledInitially) {
      console.log("-> Safety Check: Approval button disabled before confirmation checkbox: PASS");
    } else {
      throw new Error("Safety failure: Approval button was enabled before physician review confirmation!");
    }

    // Acknowledge any safety verification warnings and check review confirmation
    await page.evaluate(() => {
      const ackAllBtns = Array.from(document.querySelectorAll('button')).filter(b => 
        b.textContent.includes('Acknowledge All Warnings')
      );
      ackAllBtns.forEach(b => b.click());
    });
    await new Promise(r => setTimeout(r, 400));

    await page.evaluate(() => {
      const checkbox = document.querySelector('input[type="checkbox"]');
      if (checkbox && !checkbox.checked) {
        checkbox.click();
      }
    });
    await new Promise(r => setTimeout(r, 400));

    const isApproveEnabledNow = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Approve & Save to FHIR'));
      return btn ? !btn.disabled && !btn.classList.contains('cursor-not-allowed') : false;
    });

    if (isApproveEnabledNow) {
      console.log("-> Safety Check: Approval button enabled after physician confirmation: PASS");
    } else {
      throw new Error("Approval button remained disabled after confirmation checkbox was checked.");
    }

    // 9. Approve & Save to FHIR (Atomic Persistence)
    console.log("[9] Executing Doctor Approval and FHIR persistence...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Approve & Save to FHIR'));
      if (btn) btn.click();
    });

    try {
      await page.waitForFunction(() => {
        return document.body.innerText.includes('Approved by doctor') || document.body.innerText.includes('Consultation Approved & Saved');
      }, { timeout: 15000 });
    } catch (err) {
      console.log("PAGE TEXT AT STEP 9 TIMEOUT:\n", await page.evaluate(() => document.body.innerText));
      throw err;
    }

    const approvedText = await page.evaluate(() => document.body.innerText);
    if (approvedText.includes('Approved by doctor') && approvedText.includes('Dr. Alex Morgan')) {
      console.log("-> Doctor Approval Stored & Displayed: PASS");
    } else {
      throw new Error("Approval banner missing or incomplete.");
    }

    // 10. Test Prescription PDF Generation
    console.log("[10] Testing Prescription PDF Preview & Generation...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const pdfBtn = btns.find(b => b.textContent.includes('Print Prescription PDF') || b.textContent.includes('View / Print Prescription PDF'));
      if (pdfBtn) pdfBtn.click();
    });

    await page.waitForSelector('h2');
    const modalText = await page.evaluate(() => document.body.innerText);
    if (modalText.includes('Prescription PDF Preview') && modalText.includes('PROTON') && modalText.includes('Clinical Prescription')) {
      console.log("-> Prescription PDF Layout Verification: PASS");
    } else {
      throw new Error("Prescription PDF modal did not render expected layout.");
    }

    if (modalText.includes('AI-generated content was reviewed and approved by the treating physician')) {
      console.log("-> PDF Doctor Approval Statement: PASS");
    } else {
      throw new Error("Doctor approval statement missing from PDF.");
    }

    if (modalText.includes('Not claimed to be legally valid') || modalText.includes('Not a legally binding prescription')) {
      console.log("-> PDF Legal Jurisdiction Disclaimer: PASS");
    } else {
      throw new Error("Legal disclaimer missing from PDF.");
    }

    // Close PDF modal
    await page.evaluate(() => {
      const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.querySelector('svg.lucide-x') || b.textContent.includes('Close'));
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // 11. Verify Timeline & Consultation History Integration on Patient Profile
    console.log("[11] Navigating back to Patient Profile...");
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const backLink = links.find(l => l.textContent.includes('Back to Patient Profile'));
      if (backLink) backLink.click();
    });
    await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('prescription (approved)'), { timeout: 20000 });


    const profileText = await page.evaluate(() => document.body.innerText);
    console.log("PROFILE TEXT (Excerpt):\n", profileText.slice(0, 1000));

    // Verify Longitudinal Timeline shows Prescription
    if (profileText.toLowerCase().includes('prescription (approved)') || profileText.includes('PRESCRIPTION (APPROVED)')) {
      console.log("-> Patient Profile Timeline Prescription Event: PASS");
    } else {
      console.log("FULL PROFILE TEXT:\n", profileText);
      throw new Error("Prescription (Approved) event missing from Longitudinal Timeline.");
    }

    // Verify Consultation History shows Prescription status & medication count
    if (profileText.toLowerCase().includes('prescription:') && profileText.toLowerCase().includes('medication')) {
      console.log("-> Consultation History Prescription Count: PASS");
    } else {
      throw new Error("Prescription status or count missing from Consultation History.");
    }

    // Test expanding prescription details in consultation history
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const viewRxBtn = btns.find(b => b.textContent.includes('View Prescription'));
      if (viewRxBtn) viewRxBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const expandedProfileText = await page.evaluate(() => document.body.innerText);
    if (expandedProfileText.includes('Metformin') || expandedProfileText.includes('Ibuprofen')) {
      console.log("-> Consultation History Prescription Expanded Details: PASS");
    } else {
      throw new Error("Expanded prescription details did not render medication list.");
    }

    console.log("=== ALL PRESCRIPTION WORKFLOW E2E TESTS PASSED SUCCESSFULLY ===");

  } catch (err) {
    console.error("=== E2E TEST FAILED ===");
    console.error(err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
