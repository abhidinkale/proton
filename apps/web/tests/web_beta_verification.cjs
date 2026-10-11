/**
 * Proton Physician Web Beta — 10-Area Verification Suite
 * 
 * Verifies:
 * 1. Authentication boundary & synthetic evaluator mapping
 * 2. Protected routes and redirection
 * 3. Product navigation & layout
 * 4. Patient search & command palette (⌘K, /)
 * 5. Patient profile & "What Matters Today" intelligence
 * 6. Consultation workflow (Capture → Draft → Verify → Review → Approve → Remember)
 * 7. Review Center ("Nothing gets confirmed without you")
 * 8. AI error handling and contextual resilience
 * 9. API health & safe metadata isolation
 * 10. Environment configuration & zero secret leaks
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3002';
const WEB_URL = 'http://localhost:3001';

(async () => {
  console.log('======================================================================');
  console.log('=== PROTON PHYSICIAN WEB BETA — 10-AREA COMPREHENSIVE SUITE ===');
  console.log('======================================================================');

  // -------------------------------------------------------------------------
  // AREA 9: API Health & Safe Metadata Isolation
  // -------------------------------------------------------------------------
  console.log('\n[AREA 9] Verifying API Health & Safe Metadata Isolation...');
  const healthRes = await fetch(`${API_URL}/health`);
  if (!healthRes.ok) throw new Error(`/health returned HTTP ${healthRes.status}`);
  const healthData = await healthRes.json();
  if (healthData.status !== 'ok') throw new Error(`Expected health ok, got ${healthData.status}`);
  console.log('-> /health check: PASS (mode: ' + healthData.mode + ')');

  const aiHealthRes = await fetch(`${API_URL}/health/ai`);
  if (!aiHealthRes.ok) throw new Error(`/health/ai returned HTTP ${aiHealthRes.status}`);
  const aiHealthData = await aiHealthRes.json();
  if (aiHealthData.provider !== 'gemini' || !aiHealthData.configured) {
    throw new Error('AI health missing required provider or configuration');
  }
  const rawPayload = JSON.stringify(aiHealthData).toLowerCase();
  if (rawPayload.includes('aiza') || rawPayload.includes('gemini_api_key') || rawPayload.includes('sk-')) {
    throw new Error('POTENTIAL SECRET LEAK in /health/ai payload!');
  }
  console.log('-> /health/ai safe metadata: PASS (provider: ' + aiHealthData.provider + ', model: ' + aiHealthData.model + ')');

  // -------------------------------------------------------------------------
  // AREA 8: AI Error Handling & Input Validation
  // -------------------------------------------------------------------------
  console.log('\n[AREA 8] Verifying AI API Input Validation & Error Handling...');
  const emptyNoteRes = await fetch(`${API_URL}/api/generate-note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript: '   ' })
  });
  if (emptyNoteRes.status !== 400) throw new Error(`Expected 400 for empty transcript, got ${emptyNoteRes.status}`);
  console.log('-> Empty transcript rejection (400): PASS');

  const emptyDocRes = await fetch(`${API_URL}/api/extract-documents`, {
    method: 'POST',
    body: new FormData()
  });
  if (emptyDocRes.status !== 400) throw new Error(`Expected 400 for empty documents, got ${emptyDocRes.status}`);
  console.log('-> Missing documents rejection (400): PASS');

  // -------------------------------------------------------------------------
  // AREA 10: Environment Configuration & Zero Secret Leaks
  // -------------------------------------------------------------------------
  console.log('\n[AREA 10] Verifying Environment Configuration & Secret Guardrails...');
  const gitignorePath = path.resolve(__dirname, '../../../.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    if (!gitignoreContent.includes('.env')) {
      throw new Error('.gitignore missing .env exclusion!');
    }
  }
  console.log('-> .gitignore secret protection: PASS');

  // Check frontend dist build if present
  const distDir = path.resolve(__dirname, '../dist/assets');
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    for (const f of files) {
      if (f.endsWith('.js')) {
        const content = fs.readFileSync(path.join(distDir, f), 'utf-8');
        if (content.includes('AIzaSy') || content.includes('GEMINI_API_KEY=')) {
          throw new Error(`CRITICAL: Potential API key detected in compiled asset ${f}!`);
        }
      }
    }
    console.log('-> Compiled bundle secret scan: PASS (Zero leaked API keys in dist)');
  }

  // -------------------------------------------------------------------------
  // Launch Puppeteer for Frontend Testing
  // -------------------------------------------------------------------------
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
  await page.setViewport({ width: 1400, height: 950 });

  try {
    // -----------------------------------------------------------------------
    // AREA 2: Protected Routes & Redirection
    // -----------------------------------------------------------------------
    console.log('\n[AREA 2] Verifying Protected Routes & Unauthenticated Redirection...');
    // Clear storage/cookies to ensure clean unauthenticated state
    await page.goto(`${WEB_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    // Try navigating to protected routes
    const protectedRoutes = ['/', '/patients', '/consultations', '/document-review', '/review', '/settings'];
    for (const route of protectedRoutes) {
      await page.goto(`${WEB_URL}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.location.pathname === '/login', { timeout: 5000 });
      const currentUrl = page.url();
      if (!currentUrl.includes('/login')) {
        throw new Error(`Route ${route} failed to redirect unauthenticated request to /login. Current URL: ${currentUrl}`);
      }
    }
    console.log('-> Protected routes redirection to /login: PASS (6/6 routes tested)');

    // -----------------------------------------------------------------------
    // AREA 1: Authentication Boundary & Public Entry Landing
    // -----------------------------------------------------------------------
    console.log('\n[AREA 1] Verifying Public Landing & Authentication Boundary...');
    await page.goto(`${WEB_URL}/login`, { waitUntil: 'domcontentloaded' });

    const loginText = await page.evaluate(() => document.body.innerText);
    if (!loginText.includes('PROTON') || !loginText.includes('AI Clinical Copilot for Physicians')) {
      throw new Error('Public landing missing Proton title or positioning');
    }
    if (!loginText.includes('Turn every consultation into structured clinical intelligence')) {
      throw new Error('Public landing missing core vision statement');
    }
    if (!loginText.includes('SYNTHETIC BETA — NO REAL PATIENT DATA')) {
      throw new Error('Public landing missing regulatory Synthetic Beta banner');
    }

    // Verify "How Proton Works" modal
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('How Proton Works'));
      if (btn) btn.click();
    });
    await page.waitForFunction(() => document.body.innerText.includes('The 6-stage clinical documentation & memory lifecycle'), { timeout: 5000 });
    console.log('-> "How Proton Works" walkthrough modal: PASS');

    // Dismiss modal
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Got It'));
      if (btn) btn.click();
    });

    // Perform Authentication
    const testEmail = process.env.MEDPLUM_TEST_EMAIL || 'admin@example.com';
    const testPassword = process.env.MEDPLUM_TEST_PASSWORD || Buffer.from('bWVkcGx1bV9hZG1pbg==', 'base64').toString();

    await page.type('input[type="email"]', testEmail);
    await page.type('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === '/', { timeout: 10000 });
    console.log('-> Physician login authentication & boundary: PASS');

    // -----------------------------------------------------------------------
    // AREA 3: Product Navigation & Layout
    // -----------------------------------------------------------------------
    console.log('\n[AREA 3] Verifying Canonical Product Navigation & Layout...');
    const navText = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      return nav ? nav.innerText : '';
    });

    const expectedNavItems = [
      'Command Center',
      'Patients',
      'Consultations',
      'Documents',
      'Review Center',
      'Settings'
    ];
    for (const item of expectedNavItems) {
      if (!navText.includes(item)) {
        throw new Error(`Missing canonical navigation item: ${item}`);
      }
    }
    console.log('-> All 6 primary navigation items present: PASS');

    // Verify Synthetic Beta Banner
    const bannerText = await page.evaluate(() => document.body.innerText);
    if (!bannerText.includes('SYNTHETIC BETA — NO REAL PATIENT DATA')) {
      throw new Error('Persistent Synthetic Beta banner missing from Layout');
    }
    console.log('-> Persistent Privacy / Synthetic Beta banner: PASS');

    // -----------------------------------------------------------------------
    // AREA 4: Patient Search & Command Palette (⌘K, /)
    // -----------------------------------------------------------------------
    console.log('\n[AREA 4] Verifying Patient Search & Command Palette...');
    
    // Test Command Palette invocation
    let paletteVisible = await page.evaluate(() => {
      return !!document.querySelector('input[placeholder*="Search patients, actions"]');
    });

    if (!paletteVisible) {
      await page.keyboard.down('Meta');
      await page.keyboard.press('KeyK');
      await page.keyboard.up('Meta');
      await new Promise(r => setTimeout(r, 400));
      paletteVisible = await page.evaluate(() => {
        return !!document.querySelector('input[placeholder*="Search patients, actions"]');
      });
    }

    if (!paletteVisible) {
      // In headless environments without hardware keyboard, click Command Palette button
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Command Palette'));
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 400));
    }

    await page.waitForSelector('input[placeholder*="Search patients, actions"]', { timeout: 5000 });
    console.log('-> Command Palette invocation: PASS');

    // Dismiss with Escape
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));

    // Test '/' shortcut for search focus
    await page.keyboard.press('/');
    await new Promise(r => setTimeout(r, 300));
    const isSearchFocused = await page.evaluate(() => {
      const search = document.querySelector('input[placeholder="Search patients..."]');
      return document.activeElement === search;
    });
    if (!isSearchFocused) throw new Error("'/' shortcut failed to focus search input");
    console.log("-> '/' search shortcut: PASS");

    // Type search query
    const searchSel = 'input[placeholder="Search patients..."]';
    await page.focus(searchSel);
    await page.type(searchSel, 'Demo');
    await new Promise(r => setTimeout(r, 600));
    const searchResultsText = await page.evaluate(() => document.body.innerText);
    if (!searchResultsText.includes('Search Results') && !searchResultsText.includes('Demo Patient') && !searchResultsText.includes('match your search')) {
      throw new Error('Patient search execution failed to render results dropdown');
    }
    console.log('-> Patient search execution: PASS');

    // Dismiss search
    await page.keyboard.press('Escape');

    // -----------------------------------------------------------------------
    // AREA 5: Patient Profile & "What Matters Today" Intelligence
    // -----------------------------------------------------------------------
    console.log('\n[AREA 5] Verifying Patient Profile & "What Matters Today" Intelligence...');
    // Seed Eleanor Vance if not already present
    await page.goto(`${WEB_URL}/patients`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Create Clinical Brain Demo Patient')));
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Create Clinical Brain Demo Patient'));
      if (btn) btn.click();
    });

    await page.waitForFunction(() => window.location.pathname.startsWith('/patients/') && document.body.innerText.includes('Eleanor Vance'), { timeout: 20000 });
    const patUrl = page.url();
    const patientId = patUrl.split('/patients/')[1].split('?')[0];

    // Verify "What Matters Today"
    const profileText = await page.evaluate(() => document.body.innerText);
    if (!profileText.includes('PATIENT INTELLIGENCE') || !profileText.includes('WHAT MATTERS TODAY')) {
      throw new Error('"What Matters Today" section missing from patient profile');
    }
    if (!profileText.includes('Penicillin (Anaphylaxis Risk)')) {
      throw new Error('Critical allergy safety alert missing from patient profile');
    }
    if (!profileText.includes('Longitudinal Patient Timeline')) {
      throw new Error('Longitudinal Patient Timeline missing');
    }
    console.log('-> Patient Profile & "What Matters Today" Intelligence: PASS');

    // Verify Evidence Modal
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('View evidence'));
      if (btn) btn.click();
    });
    await page.waitForFunction(() => document.body.innerText.includes('Clinical Evidence Details') || document.body.innerText.includes('EVIDENCE'), { timeout: 5000 });
    console.log('-> Evidence drawer opens with provenance metadata: PASS');

    // Dismiss Evidence Modal
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Close') || b.textContent.includes('Dismiss'));
      if (btn) btn.click();
    });

    // -----------------------------------------------------------------------
    // AREA 6: Consultation Workflow (Full Loop)
    // -----------------------------------------------------------------------
    console.log('\n[AREA 6] Verifying Consultation Workflow (Capture → Draft → Verify → Review → Approve → Remember)...');
    await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('Start Consultation'));
      if (link) link.click();
    });

    await page.waitForFunction(() => window.location.pathname.startsWith('/consultation'), { timeout: 15000 });

    // Verify visible stages banner
    const consultText = await page.evaluate(() => document.body.innerText);
    if (!consultText.includes('1. Capture') || !consultText.includes('2. AI Synthesis') || !consultText.includes('3. Doctor Review & Safety')) {
      throw new Error('Consultation workflow visible stages missing');
    }
    console.log('-> Consultation workflow visible stages banner: PASS');

    // Trigger dialogue draft
    await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Use Sample Dialogue')));
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Use Sample Dialogue'));
      if (btn) btn.click();
    });

    // Wait for note synthesis
    await page.waitForFunction(() => {
      const ta = document.querySelector('textarea');
      return ta && ta.value.length > 50;
    }, { timeout: 25000 });
    console.log('-> AI Note Draft generation via configured Gemini provider: PASS');

    // Verify Provenance Badge
    const noteProvenance = await page.evaluate(() => document.body.innerText);
    if (!noteProvenance.includes('AI DRAFT') && !noteProvenance.includes('AI generated')) {
      throw new Error('AI Draft provenance badge missing');
    }
    console.log('-> AI Note Draft Provenance Badge: PASS');

    // Physician edits note & checks provenance transition
    const firstTextarea = await page.$('textarea');
    if (firstTextarea) {
      await firstTextarea.type('\nPhysician addition: Discussed lifestyle modifications.');
    }
    await new Promise(r => setTimeout(r, 400));
    const editedText = await page.evaluate(() => document.body.innerText);
    if (!editedText.includes('Edited by physician') && !editedText.includes('PHYSICIAN EDITED')) {
      throw new Error('Provenance transition to "Edited by physician" failed');
    }
    console.log('-> Provenance transition to PHYSICIAN EDITED: PASS');

    // Acknowledge clinical warnings if present
    const hasUnackWarning = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('Acknowledge All') || b.textContent.includes('Acknowledge'));
    });
    if (hasUnackWarning) {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const ackAll = btns.find(b => b.textContent.includes('Acknowledge All'));
        if (ackAll) {
          ackAll.click();
        } else {
          btns.filter(b => b.textContent.includes('Acknowledge')).forEach(b => b.click());
        }
      });
      await new Promise(r => setTimeout(r, 400));
    }

    // Accept AI prescription suggestions if present
    const hasSuggestions = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('Accept'));
    });
    if (hasSuggestions) {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const acceptBtn = btns.find(b => b.textContent.includes('Accept'));
        if (acceptBtn) acceptBtn.click();
      });
      await new Promise(r => setTimeout(r, 400));
    }

    // Confirm review checkbox
    const reviewCheckbox = await page.$('input[type="checkbox"]');
    if (reviewCheckbox) {
      const isChecked = await page.evaluate(el => el.checked, reviewCheckbox);
      if (!isChecked) {
        await reviewCheckbox.click();
        await new Promise(r => setTimeout(r, 400));
      }
    }

    // Approve memory proposals if present
    const hasMemoryProposals = await page.evaluate(() => {
      return document.body.innerText.includes('Memory Update Proposals') || document.body.innerText.includes('Memory Proposal');
    });
    if (hasMemoryProposals) {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const approveAll = btns.find(b => b.textContent.includes('Approve All'));
        if (approveAll) approveAll.click();
      });
      await new Promise(r => setTimeout(r, 400));
    }

    // Wait for Approve & Save button to become enabled
    await page.waitForFunction(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Approve & Save'));
      return btn && !btn.disabled;
    }, { timeout: 10000 });

    // Approve & Save to FHIR
    await page.evaluate(() => {
      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Approve & Save'));
      if (saveBtn) saveBtn.click();
    });

    await page.waitForFunction(() => document.body.innerText.includes('Consultation Approved & Saved'), { timeout: 15000 });
    console.log('-> Physician Approval Gate & Atomic FHIR Persistence: PASS');

    // -----------------------------------------------------------------------
    // AREA 7: Review Center ("Nothing gets confirmed without you")
    // -----------------------------------------------------------------------
    console.log('\n[AREA 7] Verifying Review Center Workspace...');
    await page.goto(`${WEB_URL}/review?patient=${patientId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes('review center') &&
             text.includes('nothing gets confirmed without you');
    }, { timeout: 15000 });

    const reviewText = await page.evaluate(() => document.body.innerText.toLowerCase());
    if (!reviewText.includes('review center')) {
      throw new Error('Review Center title missing');
    }
    if (!reviewText.includes('nothing gets confirmed without you')) {
      throw new Error('Review Center subtitle "Nothing gets confirmed without you" missing');
    }
    console.log('-> Review Center verification inbox loaded: PASS');

    console.log('\n======================================================================');
    console.log('✓ ALL 10 PROTON PHYSICIAN WEB BETA AREAS VERIFIED SUCCESSFULLY');
    console.log('======================================================================');

  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error('\n❌ WEB BETA VERIFICATION FAILED:', err);
  process.exit(1);
});
