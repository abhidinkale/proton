package health.dork.app.core.data.repository

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.model.CaseBannerTheme
import health.dork.app.core.data.model.CaseStatus
import health.dork.app.core.data.model.CaseTreatment
import health.dork.app.core.data.model.CaseVitals
import health.dork.app.core.data.model.ClinicalCase
import health.dork.app.core.data.model.HealthRecordItem
import health.dork.app.core.data.model.HealthRecordType
import health.dork.app.core.data.model.PrescriptionMedicineItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.builtins.ListSerializer

interface CaseRepository {
  val cases: StateFlow<List<ClinicalCase>>
  suspend fun addCase(case: ClinicalCase)
  suspend fun updateCaseStatus(caseId: String, newStatus: CaseStatus)
}

class DorkCaseRepository(
  private val store: DorkStore = DorkStore()
) : CaseRepository {

  private val caseSerializer = ListSerializer(ClinicalCase.serializer())

  private val _cases = MutableStateFlow<List<ClinicalCase>>(
    store.read(KEY_CASES, caseSerializer) ?: defaultSeedCases
  )
  override val cases: StateFlow<List<ClinicalCase>> = _cases.asStateFlow()

  override suspend fun addCase(case: ClinicalCase) {
    val updated = listOf(case) + _cases.value
    _cases.value = updated
    store.write(KEY_CASES, caseSerializer, updated)
  }

  override suspend fun updateCaseStatus(caseId: String, newStatus: CaseStatus) {
    val updated = _cases.value.map {
      if (it.id == caseId) it.copy(status = newStatus) else it
    }
    _cases.value = updated
    store.write(KEY_CASES, caseSerializer, updated)
  }

  companion object {
    private const val KEY_CASES = "dork_clinical_cases_v1"

    val defaultSeedCases = listOf(
      ClinicalCase(
        id = "case-01",
        diagnosisTitle = "Acute Bronchitis",
        subtitle = "Dr. Sarah Chen • Pulmonology",
        icdCode = "ICD-10: J20.9",
        clinicName = "Beacon Hill Family Health",
        doctorName = "Dr. Sarah Chen, MD",
        visitDateIso = "2026-10-17",
        dayDisplay = "17",
        monthDisplay = "Oct",
        yearDisplay = "2026",
        status = CaseStatus.ACTIVE,
        bannerTheme = CaseBannerTheme.EMBER_GLOW,
        clinicalSummary = "Patient evaluated for cold-air induced spasmodic cough, bilateral wheezing, and nocturnal waking. Lungs clear to auscultation without rales. Vitals stable.",
        treatment = CaseTreatment(
          protocolSummary = "7-day targeted antibacterial therapy with beta-2 agonist bronchodilator for episodic airway spasm.",
          lifestyleGuidance = "Maintain indoor humidity >45%, avoid outdoor sub-zero jogging, warm steam inhalation BID.",
          precautions = "Discontinue and report immediately if rash, urticaria, or fever >101.5°F develops."
        ),
        medications = listOf(
          PrescriptionMedicineItem(
            name = "Amoxicillin",
            dose = "500 mg",
            route = "Oral Capsule",
            frequency = "TID (every 8 hours)",
            duration = "7 days",
            instructions = "Take with a full glass of water. Complete full 7-day course.",
            refillsAllowed = 0
          ),
          PrescriptionMedicineItem(
            name = "Albuterol Sulfate HFA",
            dose = "90 mcg/actuation",
            route = "Inhalation",
            frequency = "1-2 puffs Q4-6H PRN",
            duration = "30 days",
            instructions = "Rinse mouth after each inhalation. Use 15 minutes before exertion if needed.",
            refillsAllowed = 1
          )
        ),
        reports = listOf(
          HealthRecordItem(
            id = "rep-01",
            type = HealthRecordType.LAB_RESULT,
            title = "Complete Blood Count (CBC)",
            subtitle = "WBC 6.4 · Hemoglobin 13.8 g/dL",
            dateIso = "2026-10-15",
            displayDate = "15 Oct 2026",
            doctorOrLab = "Quest Diagnostics Boston",
            summary = "WBC count, Platelets, and RBC morphology all strictly within normal physiological limits."
          ),
          HealthRecordItem(
            id = "rep-02",
            type = HealthRecordType.DIAGNOSTIC_REPORT,
            title = "Pulmonary Spirometry Peak Flow",
            subtitle = "PEF: 420 L/min (92% predicted)",
            dateIso = "2026-10-17",
            displayDate = "17 Oct 2026",
            doctorOrLab = "Beacon Hill Diagnostics",
            summary = "Mild reversible bronchospasm. Significant post-bronchodilator improvement (+14%)."
          )
        ),
        vitals = CaseVitals(
          bloodPressure = "118/76 mmHg",
          heartRate = "74 bpm",
          spo2 = "99%",
          temperature = "98.4 °F",
          bmi = "22.6"
        ),
        followUpRecommendation = "Telehealth follow-up in 5 days if daytime cough or chest tightness does not improve.",
        metaNoteCount = "2 Reports • 2 Rx"
      ),

      ClinicalCase(
        id = "case-02",
        diagnosisTitle = "Hypertension Review",
        subtitle = "Dr. Marcus Vance • Cardiology",
        icdCode = "ICD-10: I10",
        clinicName = "Metro Health Specialty Care",
        doctorName = "Dr. Marcus Vance, FACP",
        visitDateIso = "2026-09-28",
        dayDisplay = "28",
        monthDisplay = "Sep",
        yearDisplay = "2026",
        status = CaseStatus.MONITORING,
        bannerTheme = CaseBannerTheme.CYAN_PULSE,
        clinicalSummary = "Routine 6-month cardiovascular follow-up. Blood pressure well controlled on low-dose ACE inhibitor therapy. No dizziness, palpitations, or pedal edema reported.",
        treatment = CaseTreatment(
          protocolSummary = "Cardioprotective maintenance regimen with DASH dietary intervention and moderate aerobic conditioning.",
          lifestyleGuidance = "Sodium restriction <2,000 mg/day, maintain 150 minutes of weekly brisk walking.",
          precautions = "Self-monitor morning resting blood pressure twice weekly using validated home cuff."
        ),
        medications = listOf(
          PrescriptionMedicineItem(
            name = "Lisinopril",
            dose = "10 mg",
            route = "Oral Tablet",
            frequency = "Once daily in morning",
            duration = "90 days",
            instructions = "Take at the same time each morning with or without breakfast.",
            refillsAllowed = 3
          ),
          PrescriptionMedicineItem(
            name = "Atorvastatin",
            dose = "20 mg",
            route = "Oral Tablet",
            frequency = "Once daily at bedtime",
            duration = "90 days",
            instructions = "Take before bed. Avoid drinking large quantities of grapefruit juice.",
            refillsAllowed = 3
          )
        ),
        reports = listOf(
          HealthRecordItem(
            id = "rep-03",
            type = HealthRecordType.LAB_RESULT,
            title = "Comprehensive Metabolic Panel (CMP)",
            subtitle = "eGFR >90 · Serum Creatinine 0.9",
            dateIso = "2026-09-25",
            displayDate = "25 Sep 2026",
            doctorOrLab = "Metro Core Lab",
            summary = "Renal function, liver enzymes, and fasting blood glucose (88 mg/dL) optimal."
          ),
          HealthRecordItem(
            id = "rep-04",
            type = HealthRecordType.LAB_RESULT,
            title = "Lipid Fractionation Panel",
            subtitle = "Total Chol: 182 · LDL: 94 · HDL: 62",
            dateIso = "2026-09-25",
            displayDate = "25 Sep 2026",
            doctorOrLab = "Metro Core Lab",
            summary = "Cardioprotective lipid profile achieved. Triglycerides 124 mg/dL."
          ),
          HealthRecordItem(
            id = "rep-05",
            type = HealthRecordType.DIAGNOSTIC_REPORT,
            title = "12-Lead Electrocardiogram (ECG)",
            subtitle = "Normal Sinus Rhythm · HR 68 bpm",
            dateIso = "2026-09-28",
            displayDate = "28 Sep 2026",
            doctorOrLab = "Metro Cardiology Suite",
            summary = "PR interval 150ms, QTc 410ms. No ST elevations, ischemic changes, or left ventricular hypertrophy."
          )
        ),
        vitals = CaseVitals(
          bloodPressure = "124/80 mmHg",
          heartRate = "68 bpm",
          spo2 = "99%",
          temperature = "98.6 °F",
          bmi = "24.1"
        ),
        followUpRecommendation = "In-clinic blood pressure check in 90 days with repeat lipid panel.",
        metaNoteCount = "3 Reports • 2 Rx"
      ),

      ClinicalCase(
        id = "case-03",
        diagnosisTitle = "Allergic Rhinitis",
        subtitle = "Dr. Priya Patel • Immunology",
        icdCode = "ICD-10: J30.2",
        clinicName = "Beacon Hill Specialty Outpatient",
        doctorName = "Dr. Priya Patel, MD",
        visitDateIso = "2026-08-14",
        dayDisplay = "14",
        monthDisplay = "Aug",
        yearDisplay = "2026",
        status = CaseStatus.RESOLVED,
        bannerTheme = CaseBannerTheme.EMERALD_VITAL,
        clinicalSummary = "Acute seasonal flare with nasal congestion, ocular pruritus, and post-nasal drip triggered by high regional ragweed pollen counts. Resolved with second-generation antihistamine.",
        treatment = CaseTreatment(
          protocolSummary = "Topical nasal steroid therapy paired with non-sedating oral antihistamine and environmental allergen avoidance.",
          lifestyleGuidance = "Run HEPA air purifier in bedroom, shower immediately after outdoor exposure during peak pollen hours.",
          precautions = "Avoid systemic decongestant nasal sprays for longer than 3 consecutive days to prevent rhinitis medicamentosa."
        ),
        medications = listOf(
          PrescriptionMedicineItem(
            name = "Fluticasone Propionate",
            dose = "50 mcg/actuation",
            route = "Nasal Spray",
            frequency = "2 sprays per nostril daily",
            duration = "30 days",
            instructions = "Blow nose gently before use. Aim spray outward toward ear rather than nasal septum.",
            refillsAllowed = 2
          ),
          PrescriptionMedicineItem(
            name = "Cetirizine HCl",
            dose = "10 mg",
            route = "Oral Tablet",
            frequency = "Once daily in evening",
            duration = "30 days",
            instructions = "Take in evening. Non-drowsy formulation.",
            refillsAllowed = 2
          )
        ),
        reports = listOf(
          HealthRecordItem(
            id = "rep-06",
            type = HealthRecordType.LAB_RESULT,
            title = "Serum Total & Specific IgE Screen",
            subtitle = "Ragweed Class 2 · Birch Class 1",
            dateIso = "2026-08-12",
            displayDate = "12 Aug 2026",
            doctorOrLab = "Allergy Diagnostic Laboratories",
            summary = "Demonstrated seasonal aeroallergen sensitization. No food or animal dander reactivity."
          )
        ),
        vitals = CaseVitals(
          bloodPressure = "116/74 mmHg",
          heartRate = "70 bpm",
          spo2 = "99%",
          temperature = "98.2 °F",
          bmi = "22.5"
        ),
        followUpRecommendation = "Annual allergy re-evaluation prior to next spring pollen season.",
        metaNoteCount = "1 Report • 2 Rx"
      ),

      ClinicalCase(
        id = "case-04",
        diagnosisTitle = "Lumbar Spine Strain",
        subtitle = "Dr. Ethan Hayes • Sports Med",
        icdCode = "ICD-10: M54.5",
        clinicName = "Boston Orthopedic Institute",
        doctorName = "Dr. Ethan Hayes, MD",
        visitDateIso = "2026-06-05",
        dayDisplay = "05",
        monthDisplay = "Jun",
        yearDisplay = "2026",
        status = CaseStatus.RESOLVED,
        bannerTheme = CaseBannerTheme.VIOLET_MYSTIC,
        clinicalSummary = "Acute mechanical lower back pain following rotational lifting injury. Negative straight leg raise, no neurological deficits, normal lower extremity reflexes.",
        treatment = CaseTreatment(
          protocolSummary = "Short-course muscle relaxant, scheduled NSAID therapy, and directed physical therapy focusing on core stabilization.",
          lifestyleGuidance = "Ergonomic chair adjustments with active lumbar support, avoid prolonged static sitting >45 mins.",
          precautions = "Seek emergency evaluation if saddle anesthesia, progressive leg weakness, or bowel/bladder dysfunction occurs."
        ),
        medications = listOf(
          PrescriptionMedicineItem(
            name = "Naproxen",
            dose = "500 mg",
            route = "Oral Tablet",
            frequency = "Twice daily with meals",
            duration = "5 days",
            instructions = "Always take with food or milk to protect stomach lining.",
            refillsAllowed = 0
          ),
          PrescriptionMedicineItem(
            name = "Cyclobenzaprine",
            dose = "5 mg",
            route = "Oral Tablet",
            frequency = "Once daily at bedtime PRN",
            duration = "5 days",
            instructions = "Take at bedtime. May cause sedation; do not drive after taking.",
            refillsAllowed = 0
          )
        ),
        reports = listOf(
          HealthRecordItem(
            id = "rep-07",
            type = HealthRecordType.DIAGNOSTIC_REPORT,
            title = "Lumbar Spine 2-View Radiograph",
            subtitle = "L1-S1 disc spaces intact",
            dateIso = "2026-06-05",
            displayDate = "05 Jun 2026",
            doctorOrLab = "Boston Orthopedic Imaging",
            summary = "No fracture, dislocation, or spondylolisthesis. Vertebral heights and alignment normal."
          )
        ),
        vitals = CaseVitals(
          bloodPressure = "120/78 mmHg",
          heartRate = "72 bpm",
          spo2 = "99%",
          temperature = "98.5 °F",
          bmi = "22.7"
        ),
        followUpRecommendation = "Completed 6 weeks of rehabilitation therapy with full asymptomatic recovery.",
        metaNoteCount = "1 Report • 2 Rx"
      ),

      ClinicalCase(
        id = "case-05",
        diagnosisTitle = "Annual Health Audit",
        subtitle = "Dr. Sarah Chen • Primary Care",
        icdCode = "ICD-10: Z00.00",
        clinicName = "Beacon Hill Family Health",
        doctorName = "Dr. Sarah Chen, MD",
        visitDateIso = "2026-01-12",
        dayDisplay = "12",
        monthDisplay = "Jan",
        yearDisplay = "2026",
        status = CaseStatus.RESOLVED,
        bannerTheme = CaseBannerTheme.EMBER_GLOW,
        clinicalSummary = "Comprehensive preventive health evaluation. Full physical exam within normal limits. Immunizations updated. Routine cancer screenings reviewed.",
        treatment = CaseTreatment(
          protocolSummary = "Preventive maintenance, annual biometric tracking, and daily Vitamin D3 supplementation.",
          lifestyleGuidance = "Target 7-8 hours of quality sleep, Mediterranean dietary pattern, annual dental and optometric visits.",
          precautions = "Schedule follow-up appointment if any new persistent constitutional symptoms arise."
        ),
        medications = listOf(
          PrescriptionMedicineItem(
            name = "Vitamin D3 (Cholecalciferol)",
            dose = "2000 IU",
            route = "Oral Softgel",
            frequency = "Once daily with breakfast",
            duration = "Ongoing",
            instructions = "Take with a healthy meal containing dietary fats for optimal absorption.",
            refillsAllowed = 12
          )
        ),
        reports = listOf(
          HealthRecordItem(
            id = "rep-08",
            type = HealthRecordType.LAB_RESULT,
            title = "Serum 25-Hydroxy Vitamin D",
            subtitle = "38 ng/mL · Optimal tier (30-100)",
            dateIso = "2026-01-10",
            displayDate = "10 Jan 2026",
            doctorOrLab = "Quest Diagnostics Boston",
            summary = "Optimal circulating 25-OH vitamin D maintained with daily supplementation."
          ),
          HealthRecordItem(
            id = "rep-09",
            type = HealthRecordType.LAB_RESULT,
            title = "Comprehensive Chemistry & Renal Panel",
            subtitle = "Serum Electrolytes & BUN normal",
            dateIso = "2026-01-10",
            displayDate = "10 Jan 2026",
            doctorOrLab = "Quest Diagnostics Boston",
            summary = "All electrolyte, glucose, protein, and kidney biomarkers in target ranges."
          )
        ),
        vitals = CaseVitals(
          bloodPressure = "118/75 mmHg",
          heartRate = "66 bpm",
          spo2 = "99%",
          temperature = "98.4 °F",
          bmi = "22.8"
        ),
        followUpRecommendation = "Next routine annual wellness examination scheduled for January 2027.",
        metaNoteCount = "2 Reports • 1 Rx"
      )
    )
  }
}
