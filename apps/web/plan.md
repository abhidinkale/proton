## Implementation Plan: Proton Core V0 Workflow

1.  **Synthetic Patient Creation (`src/pages/Patients.tsx`)**
    *   Wire up the "Add Patient" button to programmatically generate a synthetic patient via the Medplum SDK (e.g., "Demo Patient, John Doe").
2.  **Modular Service Layer (`src/services/`)**
    *   Create `speech.ts`: Defines `SpeechToTextService` interface and a `DemoSpeechService` that accepts an audio Blob and returns a mock transcript after a delay.
    *   Create `ai.ts`: Defines `ClinicalAIService` interface and a `DemoAIService` that takes a transcript and returns a structured SOAP note.
3.  **Consultation Workspace UI (`src/pages/Consultation.tsx`)**
    *   **State Machine:** Add states for `idle`, `recording`, `transcribing`, `generating`, `review`, and `saving`.
    *   **Audio Capture:** Implement `MediaRecorder` API to capture microphone input.
    *   **Review Pane:** Replace the empty clinical note area with an editable `<textarea>` bound to the note state during the `review` phase.
4.  **Doctor Approval & FHIR Storage**
    *   Add an "Approve & Save" button in the `review` phase.
    *   When clicked, generate a FHIR `Encounter` and a `ClinicalImpression` resource containing the finalized note, linked to the `Patient`.
    *   Display a success toast/confirmation and navigate back to the Patient Profile.
