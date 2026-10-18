const { AIProvider } = require('./ai');

class DemoProvider extends AIProvider {
  constructor() {
    super();
    this.modelName = 'demo-mock-model';
  }

  async transcribe(audioBuffer, mimeType) {
    if (!audioBuffer || (Buffer.isBuffer(audioBuffer) && audioBuffer.length < 64)) {
      const error = new Error("No valid audio input was provided.");
      error.name = "TranscriptionInputError";
      error.code = "TRANSCRIPTION_INPUT_INVALID";
      error.status = 400;
      throw error;
    }
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          text: "Patient presents with symptoms discussed during consultation.",
          usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 },
          model: this.modelName
        });
      }, 500);
    });
  }

  async chat() {
    const error = new Error('Clinical chat is unavailable in demo mode. Configure a live AI provider to enable it.');
    error.status = 503;
    error.code = 'AI_CHAT_UNAVAILABLE';
    throw error;
  }

  async generateNote(transcript, patientContext, noteSchema, template) {
    return new Promise((resolve) => {
      setTimeout(() => {
        let noteContent;
        if (template === 'SOAP') {
          noteContent = {
            subjective: "Patient reports a 3-day history of moderate frontal headache and mild nausea. Pain is described as throbbing. Has taken ibuprofen occasionally with minimal relief. Denies recent travel or medication changes. No fever, no vomiting.",
            objective: "Pending physical examination. Vitals appear stable.",
            assessment: "1. Headache, likely tension-type or mild migraine.\n2. Nausea, secondary to headache.",
            plan: "1. Recommend over-the-counter analgesics (e.g., Acetaminophen/Ibuprofen) as needed.\n2. Ensure adequate rest and hydration.\n3. Follow up if symptoms worsen."
          };
        } else if (template === 'HANDOVER') {
          noteContent = {
            situation: "68yo female admitted for glycemic optimization and fatigue.",
            background: "Type 2 Diabetes, HTN, CKD stage 2 (eGFR 68). Confirmed anaphylaxis to Penicillin.",
            assessment: "HbA1c escalated to 8.2% on metformin monotherapy. BP stable.",
            recommendation: "Titrated Metformin to 1000mg BID, initiated Empagliflozin 10mg daily. Re-check renal panel in morning."
          };
        } else if (template === 'PSYCH') {
          noteContent = {
            historyOfPresentingIllness: "Patient reports feeling persistently overwhelmed and fatigued over the past month with sleep disruption.",
            mentalStatusExam: "Alert, oriented x4. Speech normal rate and tone. Affect congruent with mood. No hallucinations, delusions, or suicidal ideation.",
            pastMedicalHistory: "Mild generalized anxiety disorder, Type 2 diabetes.",
            medications: "Metformin 500mg BID, Lisinopril 10mg QD.",
            impressionAndPlan: "Adjustment reaction with anxious mood. Sleep hygiene coaching, supportive therapy follow-up."
          };
        } else if (template === 'Structured' || (noteSchema && noteSchema.properties && noteSchema.properties.possibleConditions)) {
          noteContent = {
            summary: "Comprehensive multi-specialty clinical analysis indicating cardiovascular risk and glycemic dysregulation.",
            relevantFindings: ["Palpitations for two weeks", "Fasting blood glucose 185 mg/dL", "Mild exertional dyspnea"],
            possibleConditions: [
              { condition: "Sinus Tachycardia vs Atrial Fibrillation", probability: "0.82", supportingEvidence: "Episodic palpitations" },
              { condition: "Type 2 Diabetes Mellitus with sub-optimal glycemic control", probability: "0.91", supportingEvidence: "Fasting glucose 185 mg/dL" }
            ],
            redFlags: ["Exertional chest discomfort"],
            missingInformation: ["12-lead ECG", "Recent HbA1c", "Lipid panel"],
            suggestedInvestigations: ["12-lead ECG", "Holter monitor 48hr", "Comprehensive metabolic panel"],
            treatmentConsiderations: ["Initiate beta-blocker if non-contraindicated", "Optimize antidiabetic regimen", "Cardiology outpatient follow-up"],
            limitations: ["Preliminary automated assessment. In-person clinical evaluation and ECG verification mandatory."]
          };
        } else {
          noteContent = {
            chiefComplaint: "Moderate frontal headache and mild nausea",
            historyOfPresentIllness: "Patient reports a 3-day history of moderate frontal headache and mild nausea. Pain is described as throbbing. Patient has taken ibuprofen occasionally with minimal relief.",
            relevantHistory: "Denies recent travel or medication changes. No fever, no vomiting.",
            medications: ["Ibuprofen (occasionally)"],
            allergies: ["None reported"],
            examinationFindings: "Pending physical examination",
            investigations: ["None"],
            assessment: "1. Headache, likely tension-type or mild migraine.\n2. Nausea, secondary to headache.",
            plan: "1. Recommend over-the-counter analgesics (e.g., Acetaminophen/Ibuprofen) as needed with consistent dosing.\n2. Ensure adequate rest and hydration.",
            followUp: "Follow up in clinic if symptoms worsen or persist beyond 1 week. Return precautions given."
          };
        }
        resolve({
          text: JSON.stringify(noteContent),
          usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 },
          model: this.modelName
        });
      }, 500);
    });
  }

  async extractDocument(fileBuffer, mimeType, filename, documentSchema) {
    return new Promise((resolve) => {
      setTimeout(() => {
        // We look at the filename to return the right mock
        const isAmbiguous = filename.toLowerCase().includes('ambiguous');
        const data = isAmbiguous ? {
          document_date: "2026-09-01",
          document_type: "Clinic Notes",
          facts: [
            { category: "allergy", text: "Patient unsure about penicillin allergy", confidence: 0.30, source_quote: "might have had a mild rash with penicillin" },
            { category: "diagnosis", text: "Hypertension", confidence: 0.40, source_quote: "Elevated, but not enough to confirm hypertension" },
            { category: "medication", text: "Metformin 500mg", confidence: 0.95, source_quote: "Metformin 500 mg" }
          ]
        } : {
          document_date: "2026-08-12",
          document_type: "Blood Test Report",
          facts: [
            { category: "lab", text: "HbA1c: 7.2%", confidence: 0.99, source_quote: "HbA1c result: 7.2%" },
            { category: "diagnosis", text: "Type 2 diabetes", confidence: 0.95, source_quote: "Patient has history of T2DM" },
            { category: "allergy", text: "Patient unsure about penicillin allergy", confidence: 0.30, source_quote: "might have had a mild rash with penicillin" }
          ]
        };

        resolve({
          text: JSON.stringify(data),
          usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 },
          model: this.modelName
        });
      }, 2000);
    });
  }
}

module.exports = DemoProvider;
