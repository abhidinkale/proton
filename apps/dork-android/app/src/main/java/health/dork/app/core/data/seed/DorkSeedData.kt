package health.dork.app.core.data.seed

import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.BiologicalSex
import health.dork.app.core.data.model.BloodGroup
import health.dork.app.core.data.model.ChatMessage
import health.dork.app.core.data.model.ConsultationType
import health.dork.app.core.data.model.DeliveryStatus
import health.dork.app.core.data.model.Doctor
import health.dork.app.core.data.model.DocumentCategory
import health.dork.app.core.data.model.EmergencyContact
import health.dork.app.core.data.model.EmergencyMedicalId
import health.dork.app.core.data.model.HealthDocument
import health.dork.app.core.data.model.HealthRecordItem
import health.dork.app.core.data.model.HealthRecordType
import health.dork.app.core.data.model.LabStatus
import health.dork.app.core.data.model.LabTestItem
import health.dork.app.core.data.model.MedicationDose
import health.dork.app.core.data.model.MedicationPlan
import health.dork.app.core.data.model.MessageSender
import health.dork.app.core.data.model.PatientProfile
import health.dork.app.core.data.model.PrescriptionDetail
import health.dork.app.core.data.model.PrescriptionMedicineItem
import health.dork.app.core.designsystem.components.AppointmentStatus
import health.dork.app.core.designsystem.components.MedicationDoseState

/**
 * Realistic Synthetic Seed Data for Dork Patient Healthcare Application.
 * Follows Specification Sections 74 & 75 (Alex Morgan, DOB 1998-05-12, Blood O+).
 */
object DorkSeedData {

  // Patient Profile (Alex Morgan, 12 May 1998)
  val samplePatient = PatientProfile(
    id = "patient-synthetic-alex-morgan",
    fullName = "Alex Morgan",
    email = "alex.morgan@synthetic.dork.health",
    phone = "+1 (555) 234-8901",
    birthDate = "1998-05-12",
    sex = BiologicalSex.FEMALE,
    bloodGroup = BloodGroup.O_POS,
    heightCm = 172.0,
    weightKg = 68.5,
    conditions = listOf("Mild Seasonal Asthma", "Occasional Migraine"),
    allergies = listOf("Penicillin (Moderate rash)", "Peanuts (Mild)"),
    currentMedications = listOf("Amoxicillin 500mg", "Fluticasone Inhaler 110mcg", "Vitamin D3 2000IU"),
    surgeries = listOf("Appendectomy (2018)"),
    familyHistory = listOf("Maternal grandmother: Type 2 Diabetes", "Paternal uncle: Hypertension"),
    lifestyleSmoking = "Never smoked",
    lifestyleAlcohol = "Occasional / Social",
    lifestyleActivity = "Cardio & running 3x weekly",
    emergencyContact = EmergencyContact(
      name = "Jordan Morgan",
      relationship = "Spouse",
      phoneNumber = "+1 (555) 889-1204"
    ),
    medicalAlerts = listOf("Allergic to Penicillin", "Asthma Inhaler in bag")
  )

  // 3 Realistic Doctors
  val doctors = listOf(
    Doctor(
      id = "doc-1",
      name = "Dr. Sarah Chen",
      specialty = "General Physician",
      qualifications = "MD, FACP (Harvard Medical School)",
      experienceYears = 14,
      languages = listOf("English", "Mandarin"),
      clinicName = "Beacon Hill Family Health",
      clinicAddress = "142 Cambridge St, Boston MA",
      distanceKm = "1.8 km",
      rating = 4.9,
      reviewCount = 184,
      consultationTypes = listOf(ConsultationType.IN_PERSON, ConsultationType.VIDEO),
      availableSlots = listOf("Today · 4:30 PM", "Tomorrow · 10:00 AM", "Tomorrow · 2:15 PM"),
      aboutBio = "Board-certified internist specializing in preventative medicine, respiratory health, and chronic illness management. Committed to collaborative, patient-first care."
    ),
    Doctor(
      id = "doc-2",
      name = "Dr. Marcus Vance",
      specialty = "Cardiology",
      qualifications = "MD, FACC (Johns Hopkins)",
      experienceYears = 19,
      languages = listOf("English"),
      clinicName = "Metropolitan Heart & Vascular Center",
      clinicAddress = "750 Longwood Ave, Boston MA",
      distanceKm = "3.2 km",
      rating = 4.95,
      reviewCount = 240,
      consultationTypes = listOf(ConsultationType.IN_PERSON, ConsultationType.VIDEO),
      availableSlots = listOf("Thursday · 11:30 AM", "Friday · 9:00 AM", "Next Mon · 3:00 PM"),
      aboutBio = "Cardiologist with clinical focus on preventative cardiology, lipid management, hypertension, and wearable biometric integration."
    ),
    Doctor(
      id = "doc-3",
      name = "Dr. Priya Patel",
      specialty = "Dermatology",
      qualifications = "MD, FAAD (Stanford University)",
      experienceYears = 11,
      languages = listOf("English", "Hindi", "Gujarati"),
      clinicName = "Clearwater Skin & Allergy Clinic",
      clinicAddress = "310 Commonwealth Ave, Boston MA",
      distanceKm = "2.4 km",
      rating = 4.88,
      reviewCount = 129,
      consultationTypes = listOf(ConsultationType.IN_PERSON, ConsultationType.VIDEO),
      availableSlots = listOf("Today · 6:00 PM", "Wednesday · 1:30 PM", "Friday · 10:15 AM"),
      aboutBio = "Specialist in inflammatory dermatoses, allergy patch testing, eczema, and skin cancer surveillance. Warm and evidence-based approach."
    )
  )

  // 5 Realistic Appointments
  val appointments = listOf(
    AppointmentItem(
      id = "apt-1",
      doctorId = "doc-1",
      doctorName = "Dr. Sarah Chen",
      specialty = "General Medicine",
      dateTimeString = "Today · 4:30 PM",
      dateIso = "2026-10-18T16:30:00",
      clinicLocation = "Beacon Hill Family Health",
      consultationType = ConsultationType.IN_PERSON,
      status = AppointmentStatus.Confirmed,
      reasonForVisit = "Follow-up for seasonal bronchospasm and medication review",
      symptoms = listOf("Mild dry cough", "Chest tightness in cold air"),
      preConsultationSummary = "Chief complaint: Bronchospasm. Onset 5 days ago. Severity: 3/10. Current inhaler used 2x weekly."
    ),
    AppointmentItem(
      id = "apt-2",
      doctorId = "doc-2",
      doctorName = "Dr. Marcus Vance",
      specialty = "Cardiology",
      dateTimeString = "Thursday · 11:30 AM",
      dateIso = "2026-10-22T11:30:00",
      clinicLocation = "Telehealth Video Room",
      consultationType = ConsultationType.VIDEO,
      status = AppointmentStatus.Booked,
      reasonForVisit = "Annual lipid panel review and cardiovascular risk assessment",
      symptoms = emptyList()
    ),
    AppointmentItem(
      id = "apt-3",
      doctorId = "doc-3",
      doctorName = "Dr. Priya Patel",
      specialty = "Dermatology",
      dateTimeString = "03 Sep 2026 · 10:00 AM",
      dateIso = "2026-09-03T10:00:00",
      clinicLocation = "Clearwater Skin Clinic",
      consultationType = ConsultationType.IN_PERSON,
      status = AppointmentStatus.Fulfilled,
      reasonForVisit = "Routine full-body mole check",
      symptoms = emptyList()
    ),
    AppointmentItem(
      id = "apt-4",
      doctorId = "doc-1",
      doctorName = "Dr. Sarah Chen",
      specialty = "General Medicine",
      dateTimeString = "15 Jun 2026 · 2:00 PM",
      dateIso = "2026-06-15T14:00:00",
      clinicLocation = "Beacon Hill Family Health",
      consultationType = ConsultationType.IN_PERSON,
      status = AppointmentStatus.Fulfilled,
      reasonForVisit = "Annual comprehensive wellness physical examination",
      symptoms = emptyList()
    ),
    AppointmentItem(
      id = "apt-5",
      doctorId = "doc-2",
      doctorName = "Dr. Marcus Vance",
      specialty = "Cardiology",
      dateTimeString = "12 Jan 2026 · 9:30 AM",
      dateIso = "2026-01-12T09:30:00",
      clinicLocation = "Metropolitan Heart & Vascular Center",
      consultationType = ConsultationType.IN_PERSON,
      status = AppointmentStatus.Fulfilled,
      reasonForVisit = "Baseline resting ECG and blood pressure evaluation",
      symptoms = emptyList()
    )
  )

  // 3 Medications with daily schedules
  val medicationPlans = listOf(
    MedicationPlan(
      id = "med-1",
      name = "Amoxicillin",
      dosage = "500 mg Capsule",
      frequency = "3 times daily",
      duration = "7 days",
      instructions = "Take with food at regular 8-hour intervals until prescription is finished",
      prescribingDoctor = "Dr. Sarah Chen",
      startDateIso = "2026-10-15",
      endDateIso = "2026-10-22",
      dailyTimes = listOf("8:00 AM", "2:00 PM", "8:00 PM"),
      totalScheduledDoses = 21,
      dosesTaken = 16
    ),
    MedicationPlan(
      id = "med-2",
      name = "Fluticasone Propionate",
      dosage = "110 mcg Inhalation Aerosol",
      frequency = "Twice daily",
      duration = "Ongoing",
      instructions = "Inhale 2 puffs morning and evening. Rinse mouth after use",
      prescribingDoctor = "Dr. Sarah Chen",
      startDateIso = "2026-08-01",
      dailyTimes = listOf("8:00 AM", "8:00 PM"),
      totalScheduledDoses = 60,
      dosesTaken = 54
    ),
    MedicationPlan(
      id = "med-3",
      name = "Vitamin D3 (Cholecalciferol)",
      dosage = "2000 IU Softgel",
      frequency = "Once daily",
      duration = "90 days",
      instructions = "Take in the morning with a healthy fat meal",
      prescribingDoctor = "Dr. Sarah Chen",
      startDateIso = "2026-09-01",
      dailyTimes = listOf("9:00 AM"),
      totalScheduledDoses = 45,
      dosesTaken = 41
    )
  )

  val todayDoses = listOf(
    MedicationDose(
      id = "dose-1",
      medicationId = "med-1",
      name = "Amoxicillin",
      dosage = "500 mg",
      scheduledTime = "8:00 AM",
      dateIso = "2026-10-18",
      state = MedicationDoseState.Taken,
      instructions = "Take after breakfast with water",
      prescribingDoctor = "Dr. Sarah Chen",
      takenAtTimestamp = 1792306800000L
    ),
    MedicationDose(
      id = "dose-2",
      medicationId = "med-1",
      name = "Amoxicillin",
      dosage = "500 mg",
      scheduledTime = "2:00 PM",
      dateIso = "2026-10-18",
      state = MedicationDoseState.Due,
      instructions = "Take after lunch with water",
      prescribingDoctor = "Dr. Sarah Chen"
    ),
    MedicationDose(
      id = "dose-3",
      medicationId = "med-1",
      name = "Amoxicillin",
      dosage = "500 mg",
      scheduledTime = "8:00 PM",
      dateIso = "2026-10-18",
      state = MedicationDoseState.Upcoming,
      instructions = "Take after dinner with water",
      prescribingDoctor = "Dr. Sarah Chen"
    ),
    MedicationDose(
      id = "dose-4",
      medicationId = "med-2",
      name = "Fluticasone Inhaler",
      dosage = "110 mcg (2 puffs)",
      scheduledTime = "8:00 PM",
      dateIso = "2026-10-18",
      state = MedicationDoseState.Upcoming,
      instructions = "Rinse mouth after inhalation",
      prescribingDoctor = "Dr. Sarah Chen"
    )
  )

  // 5 Longitudinal Health Records
  val healthRecords = listOf(
    HealthRecordItem(
      id = "rec-1",
      type = HealthRecordType.CONSULTATION,
      title = "Doctor Consultation",
      subtitle = "Respiratory complaint · Mild bronchospasm",
      dateIso = "2026-10-17",
      displayDate = "17 Oct 2026",
      doctorOrLab = "Dr. Sarah Chen",
      summary = "Patient evaluated for cold-air induced cough. Chest clear to auscultation. Amoxicillin course initiated."
    ),
    HealthRecordItem(
      id = "rec-2",
      type = HealthRecordType.PRESCRIPTION,
      title = "Prescription Issued",
      subtitle = "Amoxicillin 500mg · 21 capsules",
      dateIso = "2026-10-17",
      displayDate = "17 Oct 2026",
      doctorOrLab = "Dr. Sarah Chen",
      summary = "Oral antibiotic prescribed for secondary bronchial infection. 7-day therapeutic regimen."
    ),
    HealthRecordItem(
      id = "rec-3",
      type = HealthRecordType.LAB_RESULT,
      title = "Complete Blood Count (CBC)",
      subtitle = "Hemoglobin 13.8 g/dL · Normal Range",
      dateIso = "2026-10-15",
      displayDate = "15 Oct 2026",
      doctorOrLab = "Quest Diagnostics Boston",
      summary = "CBC panel completed. WBC, RBC, Platelets, and Hemoglobin all within reference intervals."
    ),
    HealthRecordItem(
      id = "rec-4",
      type = HealthRecordType.DOCUMENT,
      title = "Pulmonary Peak Flow Report",
      subtitle = "Spirometry assessment & peak expiratory flow",
      dateIso = "2026-09-18",
      displayDate = "18 Sep 2026",
      doctorOrLab = "Beacon Hill Diagnostics",
      summary = "Peak flow rate 420 L/min (92% of predicted value). Mild reversible airway restriction."
    ),
    HealthRecordItem(
      id = "rec-5",
      type = HealthRecordType.CONSULTATION,
      title = "Dermatology Skin Survey",
      subtitle = "Full body mole check · No atypical lesions",
      dateIso = "2026-09-03",
      displayDate = "03 Sep 2026",
      doctorOrLab = "Dr. Priya Patel",
      summary = "Dermatoscopic examination of trunk, arms and scalp. Stable benign melanocytic nevi."
    )
  )

  // 5 Realistic Lab Results
  val labResults = listOf(
    LabTestItem(
      id = "lab-1",
      testName = "Hemoglobin",
      value = "13.8",
      unit = "g/dL",
      referenceRangeLow = 12.0,
      referenceRangeHigh = 16.0,
      status = LabStatus.WITHIN_RANGE,
      dateString = "15 Oct 2026",
      laboratoryName = "Quest Diagnostics",
      notes = "Normal oxygen-carrying capacity."
    ),
    LabTestItem(
      id = "lab-2",
      testName = "White Blood Cell Count (WBC)",
      value = "6.4",
      unit = "10^3/µL",
      referenceRangeLow = 4.5,
      referenceRangeHigh = 11.0,
      status = LabStatus.WITHIN_RANGE,
      dateString = "15 Oct 2026",
      laboratoryName = "Quest Diagnostics",
      notes = "No leukocytosis or infection markers."
    ),
    LabTestItem(
      id = "lab-3",
      testName = "Fasting Blood Glucose",
      value = "88",
      unit = "mg/dL",
      referenceRangeLow = 70.0,
      referenceRangeHigh = 99.0,
      status = LabStatus.WITHIN_RANGE,
      dateString = "15 Oct 2026",
      laboratoryName = "Quest Diagnostics",
      notes = "Euglycemic fasting levels."
    ),
    LabTestItem(
      id = "lab-4",
      testName = "Total Cholesterol",
      value = "182",
      unit = "mg/dL",
      referenceRangeLow = 125.0,
      referenceRangeHigh = 200.0,
      status = LabStatus.WITHIN_RANGE,
      dateString = "15 Oct 2026",
      laboratoryName = "Quest Diagnostics",
      notes = "Desirable lipid tier."
    ),
    LabTestItem(
      id = "lab-5",
      testName = "Serum 25-Hydroxy Vitamin D",
      value = "38",
      unit = "ng/mL",
      referenceRangeLow = 30.0,
      referenceRangeHigh = 100.0,
      status = LabStatus.WITHIN_RANGE,
      dateString = "15 Oct 2026",
      laboratoryName = "Quest Diagnostics",
      notes = "Optimal vitamin D levels maintained with daily supplementation."
    )
  )

  // 3 Documents
  val documents = listOf(
    HealthDocument(
      id = "doc-ref-1",
      title = "CBC Laboratory Analysis",
      category = DocumentCategory.LAB_REPORT,
      uploadDate = "15 Oct 2026",
      fileSizeText = "1.2 MB PDF",
      originalUri = "content://dork.health/docs/cbc_oct2026.pdf",
      isOcrProcessed = true,
      extractedText = "Specimen: Whole Blood. Hemoglobin: 13.8 g/dL. Platelets: 245K. Impression: Normal.",
      structuredEntities = listOf("Hemoglobin: 13.8 g/dL", "WBC: 6.4", "Platelets: 245K")
    ),
    HealthDocument(
      id = "doc-ref-2",
      title = "Official Prescription — Amoxicillin",
      category = DocumentCategory.PRESCRIPTION,
      uploadDate = "17 Oct 2026",
      fileSizeText = "480 KB PNG",
      originalUri = "content://dork.health/docs/rx_amox.png",
      isOcrProcessed = true,
      extractedText = "Rx: Amoxicillin 500mg PO TID x 7d. Sig: Take with meals. Refills: 0. Dr. Sarah Chen MD.",
      structuredEntities = listOf("Drug: Amoxicillin 500mg", "Sig: 3 times daily", "Duration: 7 days")
    ),
    HealthDocument(
      id = "doc-ref-3",
      title = "Discharge Summary — Appendectomy",
      category = DocumentCategory.DISCHARGE_SUMMARY,
      uploadDate = "14 Aug 2018",
      fileSizeText = "2.8 MB PDF",
      originalUri = "content://dork.health/docs/appendectomy_discharge.pdf",
      isOcrProcessed = true,
      extractedText = "Laparoscopic appendectomy uncomplicated. Pathology: Acute non-perforated appendicitis. Healed.",
      structuredEntities = listOf("Procedure: Laparoscopic Appendectomy", "Status: Fully healed")
    )
  )

  // Prescription Detail
  val activePrescription = PrescriptionDetail(
    id = "rx-active-1",
    doctorName = "Dr. Sarah Chen",
    clinicName = "Beacon Hill Family Health",
    dateIssued = "17 Oct 2026",
    diagnosisReason = "Acute mild bronchospasm with suspected secondary respiratory infection",
    medications = listOf(
      PrescriptionMedicineItem(
        name = "Amoxicillin",
        dose = "500 mg",
        route = "Oral Capsule",
        frequency = "Three times daily (every 8 hours)",
        duration = "7 days",
        instructions = "Complete full 7-day course even if feeling completely well. Take with a glass of water.",
        refillsAllowed = 0
      )
    ),
    clinicalNotes = "Avoid exposure to freezing ambient air during recovery. Stay well hydrated.",
    followUpRecommendation = "Follow up in clinic or via telehealth if coughing persists after 5 days."
  )

  // Doctor Chat Thread
  val sampleChatMessages = listOf(
    ChatMessage(
      id = "chat-1",
      sender = MessageSender.PROVIDER,
      text = "Hello Alex, Dr. Chen here. I reviewed your recent CBC results from Thursday — everything looks excellent and completely within normal ranges.",
      timestamp = "16 Oct · 10:15 AM",
      deliveryStatus = DeliveryStatus.READ
    ),
    ChatMessage(
      id = "chat-2",
      sender = MessageSender.PATIENT,
      text = "Thank you Dr. Chen! That's reassuring. I've also been taking the Amoxicillin as scheduled since yesterday afternoon.",
      timestamp = "16 Oct · 10:42 AM",
      deliveryStatus = DeliveryStatus.READ
    ),
    ChatMessage(
      id = "chat-3",
      sender = MessageSender.PROVIDER,
      text = "Glad to hear. Be sure to stay hydrated and take each dose with food. We will review your breathing at our 4:30 PM consultation today.",
      timestamp = "Today · 9:05 AM",
      deliveryStatus = DeliveryStatus.READ
    )
  )

  // Dork AI initial messages
  val dorkAiInitialMessages = listOf(
    ChatMessage(
      id = "ai-1",
      sender = MessageSender.DORK_AI,
      text = "Hello Alex. I am Dork AI, your personal health assistant. I can explain your lab results, summarize your prescriptions, or help you prepare for your consultation with Dr. Chen today.",
      timestamp = "Today · 8:00 AM",
      isClinicalCitation = false
    )
  )

  // Emergency Medical ID
  val emergencyMedicalId = EmergencyMedicalId(
    patientName = "Alex Morgan",
    birthDate = "1998-05-12",
    calculatedAge = 28,
    bloodGroup = "O+",
    criticalConditions = listOf("Mild Asthma (Carries Albuterol)"),
    severeAllergies = listOf("Penicillin (Moderate skin rash & swelling)", "Peanuts (Mild)"),
    activeMedications = listOf("Amoxicillin 500mg PO TID", "Fluticasone Inhaler 110mcg BID"),
    emergencyContactName = "Jordan Morgan (Spouse)",
    emergencyContactPhone = "+1 (555) 889-1204",
    emergencyContactRelation = "Spouse",
    organDonorStatus = "Registered Organ Donor",
    hospitalPreference = "Massachusetts General Hospital"
  )
}
