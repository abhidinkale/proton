// Proton macOS App JavaScript Logic

let currentMode = 'signup';
let isConsultRecording = false;
let currentConsultPatient = null;

// Master Clinical Schedule (Ported from apps/web/src/data/clinicSchedule.ts)
const CLINIC_APPOINTMENTS = [
  {
    id: 'enc-1',
    patientName: 'Sarah Jenkins',
    age: '48F',
    dob: '06/14/1978',
    mrn: 'SJ-10294',
    time: '08:00 AM',
    chiefComplaint: 'Annual preventive wellness review & routine lipid surveillance; feels well',
    status: 'ready',
    queueCategory: 'READY',
    vitals: { bp: '120/78 mmHg', hr: '68 bpm', spo2: '99%', bmi: '24.2' },
    meds: ['Multivitamin Daily', 'Atorvastatin 10mg'],
    allergies: 'No Known Drug Allergies (NKDA)',
    soap: {
      s: 'Patient presents for routine annual health exam. Reports feeling energetic, exercises 3x weekly. Mild questions regarding dietary cholesterol.',
      o: 'Alert, well-appearing. Vital signs stable. Heart regular rate & rhythm without murmur. Lungs clear to auscultation bilaterally. Total Cholesterol 210 mg/dL.',
      a: '1. Routine general medical examination without abnormal findings (Z00.00).\n2. Mild hyperlipidemia on dietary management (E78.5).',
      p: '1. Continue balanced Mediterranean nutrition and aerobic physical activity.\n2. Repeat fasting lipid profile in 6 months.\n3. CareLoop health summary issued.'
    }
  },
  {
    id: 'enc-2',
    patientName: 'Eleanor Vance',
    age: '62F',
    dob: '11/22/1964',
    mrn: 'EV-20481',
    time: '09:15 AM',
    chiefComplaint: 'Type 2 Diabetes & Hypertension 3-month titration; home BP elevated',
    status: 'waiting',
    queueCategory: 'WAITING',
    vitals: { bp: '144/92 mmHg', hr: '76 bpm', spo2: '98%', bmi: '28.4' },
    meds: ['Metformin 1000mg BID', 'Lisinopril 20mg Daily', 'Amlodipine 5mg'],
    allergies: 'Sulfa Drugs (Hives)',
    soap: {
      s: 'Patient reports recent morning headaches and home systolic readings ranging 140-150. Denies chest pain, vision changes, or dyspnea.',
      o: 'BP 144/92 mmHg confirmed on repeat. Heart RRR, no peripheral edema. HbA1c 7.1% (down from 7.6% 3 months ago). eGFR > 60 mL/min.',
      a: '1. Essential hypertension, suboptimally controlled (I10).\n2. Type 2 diabetes mellitus with good glycemic progress (E11.9).',
      p: '1. Increase Amlodipine to 10mg daily.\n2. Continue home blood pressure log sync via Proton Patient App.\n3. Follow up in clinic in 4 weeks.'
    }
  },
  {
    id: 'enc-3',
    patientName: 'Clara Hughes',
    age: '34F',
    dob: '03/09/1992',
    mrn: 'CH-33921',
    time: '10:30 AM',
    chiefComplaint: 'Asthma flare-up following viral URI; nighttime wheezing with albuterol use',
    status: 'waiting',
    queueCategory: 'WAITING',
    vitals: { bp: '118/74 mmHg', hr: '84 bpm', spo2: '96%', bmi: '22.8' },
    meds: ['Fluticasone/Salmeterol 250/50', 'Albuterol HFA PRN'],
    allergies: 'Aspirin (Bronchospasm)',
    soap: {
      s: 'Reports 5 days of worsening nocturnal cough and shortness of breath following viral cold. Using rescue inhaler 3-4 times per day.',
      o: 'End-expiratory wheezing heard throughout bilateral lung bases. Peak flow measured in clinic at 380 L/min (baseline 460 L/min).',
      a: '1. Acute exacerbation of moderate persistent asthma (J45.41).\n2. Resolving viral upper respiratory infection.',
      p: '1. Prednisone 40mg daily x 5 days burst.\n2. Continue maintenance ICS/LABA.\n3. Peak flow trigger protocol reviewed via mobile CareLoop.'
    }
  },
  {
    id: 'enc-4',
    patientName: 'Arthur Pendelton',
    age: '71M',
    dob: '08/30/1955',
    mrn: 'AP-41890',
    time: '11:15 AM',
    chiefComplaint: 'Cardiology consultation: exertional chest tightness relieved with rest',
    status: 'ready',
    queueCategory: 'READY',
    vitals: { bp: '136/82 mmHg', hr: '72 bpm', spo2: '97%', bmi: '26.1' },
    meds: ['Aspirin 81mg', 'Atorvastatin 40mg', 'Metoprolol Tartrate 25mg BID'],
    allergies: 'No Known Drug Allergies',
    soap: {
      s: 'Patient describes retrosternal tightness when walking up inclines, resolving within 3 minutes of stopping. No diaphoresis or radiating pain.',
      o: 'Resting 12-lead ECG shows sinus rhythm at 70 bpm, normal axis, no acute ST-T wave deviations. S1/S2 present without gallop.',
      a: '1. Stable angina pectoris, suspect coronary artery disease progression (I20.9).\n2. Hyperlipidemia and ASCVD risk.',
      p: '1. Schedule outpatient myocardial perfusion stress imaging.\n2. Prescribe Sublingual Nitroglycerin 0.4mg PRN.\n3. Proton Cardiology Tele-surveillance active.'
    }
  },
  {
    id: 'enc-5',
    patientName: 'Priya Patel',
    age: '29F',
    dob: '05/17/1997',
    mrn: 'PP-58912',
    time: '01:00 PM',
    chiefComplaint: 'Neurology consult: increasing frequency of unilateral throbbing migraines with visual aura',
    status: 'ready',
    queueCategory: 'READY',
    vitals: { bp: '112/70 mmHg', hr: '64 bpm', spo2: '99%', bmi: '21.5' },
    meds: ['Sumatriptan 50mg PRN', 'Oral Contraceptive Pill'],
    allergies: 'Codeine (Nausea)',
    soap: {
      s: 'Experiencing 4-5 headache episodes per month, preceded by scintillating scotoma lasting 20 minutes. Nausea and severe photophobia.',
      o: 'Cranial nerves II-XII intact. Funduscopic exam normal without papilledema. Gait and finger-to-nose coordination normal.',
      a: '1. Migraine with aura, episodic (G43.109).\n2. High acute medication frequency.',
      p: '1. Initiate Topiramate 25mg QHS for preventive prophylaxis.\n2. Transition abortive therapy to Rimegepant (Nurtec).\n3. Headache trigger diary synchronized.'
    }
  },
  {
    id: 'enc-6',
    patientName: 'Harold Bailey',
    age: '55M',
    dob: '10/04/1971',
    mrn: 'HB-67104',
    time: '02:15 PM',
    chiefComplaint: 'Endocrinology follow-up: persistent fatigue & constipation despite Levothyroxine',
    status: 'ready',
    queueCategory: 'READY',
    vitals: { bp: '128/80 mmHg', hr: '60 bpm', spo2: '98%', bmi: '29.1' },
    meds: ['Levothyroxine 75mcg Daily'],
    allergies: 'NKDA',
    soap: {
      s: 'Patient takes levothyroxine first thing in morning with black coffee. Reports dry skin, lethargy, cold intolerance.',
      o: 'Thyroid non-tender, no palpable nodules. Delayed Achilles tendon reflex relaxation phase. TSH 6.8 mIU/L (elevated), Free T4 low-normal.',
      a: '1. Hypothyroidism, undertreated (E03.9).\n2. Impaired absorption secondary to morning coffee timing.',
      p: '1. Increase Levothyroxine to 88mcg daily.\n2. Instruct patient to take medication with full glass of water 60m before coffee/breakfast.\n3. Recheck TSH in 8 weeks.'
    }
  },
  {
    id: 'enc-7',
    patientName: 'Robert Hayes',
    age: '67M',
    dob: '12/11/1958',
    mrn: 'RH-77218',
    time: '03:30 PM',
    chiefComplaint: 'Medication safety alert & review: antibiotic cross-reactivity surveillance',
    status: 'ready',
    queueCategory: 'READY',
    vitals: { bp: '130/78 mmHg', hr: '70 bpm', spo2: '98%', bmi: '25.6' },
    meds: ['Lisinopril 10mg', 'Simvastatin 20mg'],
    allergies: 'Penicillin (Severe Anaphylaxis - Intubated 2018)',
    soap: {
      s: 'Referred from urgent care for sinusitis antibiotic selection. Patient strongly reminds of documented life-threatening penicillin anaphylaxis.',
      o: 'Clear oropharynx, mild maxillary sinus tenderness. Proton Safety Interceptor successfully blocked amoxicillin-clavulanate prescription.',
      a: '1. Acute bacterial rhinosinusitis (J01.90).\n2. Documented severe IgE-mediated beta-lactam anaphylaxis (Z88.0).',
      p: '1. Prescribed Doxycycline 100mg BID x 7 days.\n2. Saline nasal irrigation BID.\n3. Hard allergy stop verified in FHIR AllergyIntolerance.'
    }
  },
  {
    id: 'enc-8',
    patientName: 'Marcus Chen',
    age: '50M',
    dob: '07/23/1976',
    mrn: 'MC-88129',
    time: '04:15 PM',
    chiefComplaint: 'Post-hospitalization discharge reconciliation: CHF and kidney function review',
    status: 'ready',
    queueCategory: 'READY',
    vitals: { bp: '122/76 mmHg', hr: '68 bpm', spo2: '98%', bmi: '27.0' },
    meds: ['Sacubitril/Valsartan 49/51mg BID', 'Carvedilol 12.5mg BID', 'Empagliflozin 10mg'],
    allergies: 'NKDA',
    soap: {
      s: 'Discharged 5 days ago following mild fluid overload. Weighing daily at home, weight stable at 178 lbs. No orthopnea or PND.',
      o: 'JVP 6 cm H2O. Lungs clear, trace bilateral ankle edema. Serum creatinine 1.1 mg/dL, potassium 4.4 mEq/L. BNP 180 pg/mL (improved).',
      a: '1. Heart failure with reduced ejection fraction, NYHA Class II, compensated (I50.22).\n2. Chronic kidney disease stage 2, stable.',
      p: '1. Continue GDMT regimen unchanged.\n2. Proton Remote Patient Monitoring scale synced daily.\n3. Clinic check in 4 weeks.'
    }
  }
];

// Doctor Profile State
let doctorProfile = {
  fullName: 'Dr. Sarah Mitchell, MD',
  surname: 'Mitchell',
  specialty: 'Cardiology',
  npi: '1948273019',
  experience: '4-10 years',
  facility: 'Metropolitan Heart & Medical Center',
  setting: 'Outpatient Clinic',
  language: 'English (US)',
  noteStyle: 'Detailed SOAP',
  pairingCode: '8492-3105',
  email: 'dr.sarah.mitchell@protoncare.ai'
};

// DOM Elements
const authCard = document.getElementById('auth-card');
const onboardingCard = document.getElementById('onboarding-card');
const todaySessionScreen = document.getElementById('today-session-screen');
const consultModal = document.getElementById('consult-modal');

// Auth Form Elements
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const inputEmail = document.getElementById('input-email');
const inputPassword = document.getElementById('input-password');
const btnTogglePassword = document.getElementById('btn-toggle-password');
const iconEye = document.getElementById('icon-eye');
const iconEyeOff = document.getElementById('icon-eye-off');
const btnSubmitText = document.getElementById('btn-submit-text');
const btnSpinner = document.getElementById('btn-spinner');
const dividerText = document.getElementById('divider-text');
const footerText = document.getElementById('footer-text');
const btnToggleAuthMode = document.getElementById('btn-toggle-auth-mode');
const checkTerms = document.getElementById('check-terms');
const errorBanner = document.getElementById('error-banner');
const errorText = document.getElementById('error-text');
const btnDemoDoctor = document.getElementById('btn-demo-doctor');

// Onboarding Elements
const docFullNameInput = document.getElementById('doc-fullname');
const docSpecialtySelect = document.getElementById('doc-specialty');
const docNpiInput = document.getElementById('doc-npi');
const docClinicNameInput = document.getElementById('doc-clinic-name');
const docSettingSelect = document.getElementById('doc-setting');
const docLanguageSelect = document.getElementById('doc-language');
const digitChunk1 = document.getElementById('digit-chunk-1');
const digitChunk2 = document.getElementById('digit-chunk-2');
const copyBtnText = document.getElementById('copy-btn-text');

// Today Screen Elements
const todayFacilityName = document.getElementById('today-facility-name');
const todayCodeDisplay = document.getElementById('today-code-display');
const todayDocName = document.getElementById('today-doc-name');
const todayDocEmail = document.getElementById('today-doc-email');
const todayAvatar = document.getElementById('today-avatar');
const liveClockDate = document.getElementById('live-clock-date');
const liveClockTime = document.getElementById('live-clock-time');
const heroGreeting = document.getElementById('hero-greeting');
const heroDoctorDisplay = document.getElementById('hero-doctor-display');
const nextPatientName = document.getElementById('next-patient-name');
const nextPatientTime = document.getElementById('next-patient-time');
const nextPatientComplaint = document.getElementById('next-patient-complaint');
const statVisitsCount = document.getElementById('stat-visits-count');
const statWaitingCount = document.getElementById('stat-waiting-count');
const statNextTime = document.getElementById('stat-next-time');
const aheadAppointmentsList = document.getElementById('ahead-appointments-list');
const footerCodeLabel = document.getElementById('footer-code-label');

// Consult Modal Elements
const consultModalName = document.getElementById('consult-modal-name');
const consultModalDemographics = document.getElementById('consult-modal-demographics');
const consultModalReason = document.getElementById('consult-modal-reason');
const consultAvatar = document.getElementById('consult-avatar');
const consultRecorderBar = document.getElementById('consult-recorder-bar');
const consultRecDot = document.getElementById('consult-rec-dot');
const consultMicTitle = document.getElementById('consult-mic-title');
const consultMicSub = document.getElementById('consult-mic-sub');
const consultMicBtnText = document.getElementById('consult-mic-btn-text');
const soapS = document.getElementById('soap-s');
const soapO = document.getElementById('soap-o');
const soapA = document.getElementById('soap-a');
const soapP = document.getElementById('soap-p');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEmberCanvas();
  setupEventListeners();
  startLiveClock();
  renderAheadSchedule();
});

function setupEventListeners() {
  btnToggleAuthMode.addEventListener('click', toggleAuthMode);

  btnTogglePassword.addEventListener('click', () => {
    const isPassword = inputPassword.getAttribute('type') === 'password';
    inputPassword.setAttribute('type', isPassword ? 'text' : 'password');
    iconEye.classList.toggle('hidden', isPassword);
    iconEyeOff.classList.toggle('hidden', !isPassword);
  });

  btnDemoDoctor.addEventListener('click', () => {
    inputEmail.value = 'dr.sarah.mitchell@protoncare.ai';
    inputPassword.value = '••••••••••••';
    checkTerms.checked = true;
    hideError();
  });

  docFullNameInput.addEventListener('input', updateLivePreview);
  docNpiInput.addEventListener('input', updateLivePreview);
  docClinicNameInput.addEventListener('input', updateLivePreview);
}

function startLiveClock() {
  function tick() {
    const now = new Date();
    liveClockDate.textContent = now.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
    liveClockTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    const hours = now.getHours();
    let greet = 'GOOD MORNING';
    if (hours >= 12 && hours < 17) greet = 'GOOD AFTERNOON';
    else if (hours >= 17) greet = 'GOOD EVENING';
    heroGreeting.textContent = greet;
  }
  tick();
  setInterval(tick, 1000);
}

function toggleAuthMode() {
  hideError();
  if (currentMode === 'signup') {
    currentMode = 'login';
    authTitle.textContent = 'Log in';
    authSubtitle.innerHTML = 'Welcome back, Doctor.<br />Enter your clinical credentials to access copilot.';
    inputPassword.placeholder = 'Enter Password';
    btnSubmitText.textContent = 'Sign In';
    dividerText.textContent = 'or log in with';
    footerText.textContent = "Don't have an account?";
    btnToggleAuthMode.textContent = 'Sign up';
  } else {
    currentMode = 'signup';
    authTitle.textContent = 'Sign up';
    authSubtitle.innerHTML = 'Your personal health companion.<br />Track, understand and improve your health.';
    inputPassword.placeholder = 'Create Password';
    btnSubmitText.textContent = 'Create Account';
    dividerText.textContent = 'or sign up with';
    footerText.textContent = 'Already have an account?';
    btnToggleAuthMode.textContent = 'Log in';
  }
}

function quickLoginWithSocial(provider) {
  inputEmail.value = `dr.mitchell.${provider.toLowerCase()}@protoncare.ai`;
  inputPassword.value = '••••••••••••';
  handleAuthSubmit();
}

function handleAuthSubmit() {
  hideError();
  const email = inputEmail.value.trim();

  if (!email) {
    showError('Please enter your doctor email address.');
    return;
  }

  if (currentMode === 'signup' && !checkTerms.checked) {
    showError('Please agree to the Terms & Privacy Policy to continue.');
    return;
  }

  doctorProfile.email = email;

  btnSubmitText.classList.add('hidden');
  btnSpinner.classList.remove('hidden');

  setTimeout(() => {
    btnSubmitText.classList.remove('hidden');
    btnSpinner.classList.add('hidden');

    authCard.classList.add('hidden');
    onboardingCard.classList.remove('hidden');
    goToOnboardingStep(1);
    updateLivePreview();
  }, 650);
}

function goToOnboardingStep(stepNumber) {
  document.getElementById('onboarding-step-1').classList.add('hidden');
  document.getElementById('onboarding-step-2').classList.add('hidden');
  document.getElementById('onboarding-step-3').classList.add('hidden');

  document.getElementById('step-pill-1').classList.remove('active');
  document.getElementById('step-pill-2').classList.remove('active');
  document.getElementById('step-pill-3').classList.remove('active');

  document.getElementById(`onboarding-step-${stepNumber}`).classList.remove('hidden');
  document.getElementById(`step-pill-${stepNumber}`).classList.add('active');
}

function generateDoctorCodeAndProceed() {
  const part1 = Math.floor(1000 + Math.random() * 9000);
  const part2 = Math.floor(1000 + Math.random() * 9000);
  const code = `${part1}-${part2}`;
  
  doctorProfile.pairingCode = code;
  doctorProfile.fullName = docFullNameInput.value.trim() || 'Dr. Sarah Mitchell, MD';
  
  // Extract surname
  const rawSurname = doctorProfile.fullName.replace(/,?\s*(MD|M\.D\.|DO|MBBS)$/i, '').trim().split(/\s+/);
  doctorProfile.surname = rawSurname.length > 1 ? rawSurname[rawSurname.length - 1] : rawSurname[0] || 'Mitchell';

  doctorProfile.specialty = docSpecialtySelect.value;
  doctorProfile.npi = docNpiInput.value.trim() || '1948273019';
  doctorProfile.facility = docClinicNameInput.value.trim() || 'Metropolitan Heart & Medical Center';
  doctorProfile.setting = docSettingSelect.value;
  doctorProfile.language = docLanguageSelect.value;

  digitChunk1.textContent = part1;
  digitChunk2.textContent = part2;
  document.getElementById('preview-code-stamp').textContent = `${part1} - ${part2}`;

  goToOnboardingStep(3);
}

function updateLivePreview() {
  const name = docFullNameInput.value.trim() || 'Dr. Sarah Mitchell, MD';
  const specialty = docSpecialtySelect.value;
  const facility = docClinicNameInput.value.trim() || 'Metropolitan Heart';
  const npi = docNpiInput.value.trim() || '1948273019';

  document.getElementById('preview-doc-name').textContent = name;
  document.getElementById('preview-doc-specialty').textContent = specialty;
  document.getElementById('preview-clinic-name').textContent = facility;
  document.getElementById('preview-npi').textContent = npi;
}

function copyDoctorCode() {
  const code = doctorProfile.pairingCode;
  navigator.clipboard.writeText(code).then(() => {
    if (copyBtnText) copyBtnText.textContent = '✓ Copied!';
    const footerLabel = document.getElementById('footer-code-label');
    if (footerLabel) footerLabel.textContent = 'COPIED!';
    setTimeout(() => {
      if (copyBtnText) copyBtnText.textContent = 'Copy 8-Digit Code';
      if (footerLabel) footerLabel.textContent = code;
    }, 2000);
  });
}

// Finish Onboarding & Launch Today's Session Homescreen
function finishOnboardingAndLaunch() {
  onboardingCard.classList.add('hidden');
  todaySessionScreen.classList.remove('hidden');

  // Update Doctor details across Today Homescreen
  todayDocName.textContent = `Dr. ${doctorProfile.surname}`;
  todayDocEmail.textContent = doctorProfile.email;
  todayFacilityName.textContent = doctorProfile.facility;
  todayCodeDisplay.textContent = doctorProfile.pairingCode;
  footerCodeLabel.textContent = doctorProfile.pairingCode;
  heroDoctorDisplay.textContent = `Dr. ${doctorProfile.surname}`;

  // Avatar initials
  const initials = doctorProfile.surname.slice(0, 2).toUpperCase() || 'SM';
  todayAvatar.textContent = initials;

  renderAheadSchedule();
}

// Render Ahead Appointments List
function renderAheadSchedule() {
  aheadAppointmentsList.innerHTML = '';

  const waitingCount = CLINIC_APPOINTMENTS.filter(a => a.queueCategory === 'WAITING').length;
  statVisitsCount.textContent = String(CLINIC_APPOINTMENTS.length).padStart(2, '0');
  statWaitingCount.textContent = String(waitingCount).padStart(2, '0');

  const next = CLINIC_APPOINTMENTS[0];
  if (next) {
    nextPatientName.textContent = next.patientName;
    nextPatientTime.textContent = next.time;
    nextPatientComplaint.textContent = next.chiefComplaint;
    statNextTime.textContent = next.time.replace(/ (AM|PM)/, '');
  }

  CLINIC_APPOINTMENTS.forEach((app) => {
    const btn = document.createElement('button');
    btn.className = 'ahead-row-btn';
    btn.onclick = () => openConsultModal(app.id);

    btn.innerHTML = `
      <span class="ahead-time-col">${app.time}</span>
      <span class="ahead-patient-col">
        <span class="ahead-patient-name">${app.patientName}</span>
        ${app.queueCategory === 'WAITING' ? '<span class="ahead-waiting-dot studio-live" title="Patient in waiting room"></span>' : ''}
      </span>
      <span class="ahead-complaint-col">${app.chiefComplaint}</span>
      <span class="ahead-status-col">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="2"></circle>
          <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path>
        </svg>
        ${app.status}
      </span>
      <svg class="ahead-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="7" y1="17" x2="17" y2="7"></line>
        <polyline points="7 7 17 7 17 17"></polyline>
      </svg>
    `;

    aheadAppointmentsList.appendChild(btn);
  });
}

// Consult Room Modal Handlers
function openConsultModal(appointmentId) {
  const patient = CLINIC_APPOINTMENTS.find(a => a.id === appointmentId) || CLINIC_APPOINTMENTS[0];
  currentConsultPatient = patient;

  consultModalName.textContent = patient.patientName;
  consultModalDemographics.textContent = `${patient.age} • DOB ${patient.dob} • MRN ${patient.mrn}`;
  consultModalReason.textContent = patient.chiefComplaint;

  const initials = patient.patientName.split(' ').map(p => p[0]).join('').slice(0, 2);
  consultAvatar.textContent = initials;

  soapS.textContent = patient.soap.s;
  soapO.textContent = patient.soap.o;
  soapA.innerHTML = patient.soap.a.replace(/\n/g, '<br>');
  soapP.innerHTML = patient.soap.p.replace(/\n/g, '<br>');

  // Reset mic state
  isConsultRecording = false;
  consultRecorderBar.classList.remove('recording');
  consultRecDot.classList.add('hidden');
  consultMicTitle.textContent = 'Ambient Consultation Listener Ready';
  consultMicSub.textContent = 'Whisper medical entity recognition active • Speaker diarization (Doctor / Patient)';
  consultMicBtnText.textContent = 'Start Ambient Consultation';

  consultModal.classList.remove('hidden');
}

function closeConsultModal(event) {
  if (event && event.target !== consultModal) return;
  consultModal.classList.add('hidden');
}

function toggleConsultMic() {
  isConsultRecording = !isConsultRecording;
  if (isConsultRecording) {
    consultRecorderBar.classList.add('recording');
    consultRecDot.classList.remove('hidden');
    consultMicTitle.textContent = 'Streaming Consultation Audio · Real-time SOAP Synthesis';
    consultMicSub.textContent = 'Live transcription running locally: capturing symptom timeline, drug history & differential diagnoses.';
    consultMicBtnText.textContent = 'Stop & Synthesize';
  } else {
    consultRecorderBar.classList.remove('recording');
    consultRecDot.classList.add('hidden');
    consultMicTitle.textContent = 'Ambient Consultation Listener Paused';
    consultMicSub.textContent = 'Transcription complete. SOAP note draft updated in panel below.';
    consultMicBtnText.textContent = 'Resume Consultation';
  }
}

function signAndCompleteEncounter() {
  if (currentConsultPatient) {
    currentConsultPatient.status = 'signed';
    currentConsultPatient.queueCategory = 'SIGNED';
  }
  renderAheadSchedule();
  consultModal.classList.add('hidden');
  alert(`✓ Encounter signed and synced with FHIR R4 repository!\nPatient: ${currentConsultPatient ? currentConsultPatient.patientName : ''}\nProvenance: Practitioner/${doctorProfile.npi}`);
}

function reopenOnboarding() {
  todaySessionScreen.classList.add('hidden');
  onboardingCard.classList.remove('hidden');
  goToOnboardingStep(3);
}

function handleSignOut() {
  todaySessionScreen.classList.add('hidden');
  onboardingCard.classList.add('hidden');
  authCard.classList.remove('hidden');
}

function openStaffModal() {
  alert(`Proton Staff Portal: Active for ${doctorProfile.facility}\nStation ID: MAC-WS-01\nClinician: ${doctorProfile.fullName}`);
}

function openCareLoopModal() {
  alert(`Proton CareLoop Synchronizer: Connected to Postgres.\nWaiting patients: ${statWaitingCount.textContent}\nCode: ${doctorProfile.pairingCode}`);
}

function showError(msg) {
  errorText.textContent = msg;
  errorBanner.classList.remove('hidden');
}

function hideError() {
  errorBanner.classList.add('hidden');
}

// Ember Canvas
function setupEmberCanvas() {
  const canvas = document.getElementById('ember-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  const particles = [];
  const PARTICLE_COUNT = 32;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 2 + 1,
      opacity: Math.random() * 0.6 + 0.2,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: -Math.random() * 0.5 - 0.2,
      pulse: Math.random() * Math.PI,
    });
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let p of particles) {
      p.pulse += 0.02;
      p.x += p.speedX + Math.sin(p.pulse) * 0.2;
      p.y += p.speedY;

      if (p.y < -10) {
        p.y = canvas.height + 10;
        p.x = Math.random() * canvas.width;
      }
      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;

      const currentOpacity = p.opacity * (0.6 + 0.4 * Math.sin(p.pulse));

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 180, 110, ${currentOpacity})`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(250, 132, 84, 0.7)';
      ctx.fill();
    }

    requestAnimationFrame(animate);
  }

  animate();
}
