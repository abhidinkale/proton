# Dork Architecture Specification

## 1. Architectural Philosophy

Dork is built on **Modern Android Architecture** guidelines recommended by Google:
- **Clean Architecture** with separation of concerns between UI, Domain, and Data layers.
- **Unidirectional Data Flow (UDF)** where UI state flows down and user events flow up.
- **Repository Pattern** mediating between local persistent/synthetic state and remote FHIR backends.
- **Offline-First Resilience**: Full offline capability using local data with non-destructive synchronization.
- **No God Classes**: No monolithic `MainActivity` or giant ViewModels.

---

## 2. Layered Structure

```
health.dork.app/
├── core/
│   ├── designsystem/          # Centralized tokens & reusable UI components
│   │   ├── Color.kt           # Palette tokens (Light & genuine Dark mode)
│   │   ├── Spacing.kt         # Standard spacing scale (4dp to 64dp)
│   │   ├── Shape.kt           # Radius tokens (pill, rounded cards)
│   │   ├── Type.kt            # Typography hierarchy & numeric styling
│   │   ├── Theme.kt           # DorkTheme composition provider
│   │   └── components/        # Reusable DorkButton, DorkCard, etc.
│   ├── fhir/                  # Standard FHIR R4 schema & client
│   │   ├── FhirModels.kt      # Patient, Appointment, MedicationRequest, etc.
│   │   ├── FhirConfig.kt      # Environment & Medplum endpoint configuration
│   │   └── FhirApiClient.kt   # Live REST client & in-memory synthetic store
│   ├── data/                  # Domain models, repositories, and seed data
│   │   ├── model/             # UI models (Patient, Care, Meds, Records, Chat)
│   │   ├── repository/        # Auth, Patient, Care, Medication, Record repos
│   │   ├── seed/              # Synthetic patient Alex Morgan (DOB 1998-05-12)
│   │   ├── util/              # Authoritative DateCalculators & BMI logic
│   │   └── AppContainer.kt    # Dependency injection & service locator
│   └── security/              # SecurityManager, PHI masking & window privacy
└── ui/                        # Presentation layer (Compose & ViewModels)
    ├── auth/                  # Welcome & Sign-In
    ├── onboarding/            # 13-step progressive profile setup
    ├── home/                  # Context-aware dashboard
    ├── care/                  # Doctor discovery, booking, pre-consultation
    ├── records/               # Timeline, lab reports, prescriptions, upload
    ├── medications/           # Daily schedules, reminders, adherence
    ├── chat/                  # Doctor-patient secure clinical messaging
    ├── ai/                    # Dork AI assistant with safety boundaries
    ├── profile/               # Health profile, Medical ID, and preferences
    └── navigation/            # Master navigation shell & tab orchestrator
```

---

## 3. State Management & Flow

ViewModels expose read-only `StateFlow<UiState>` to Composables. User actions invoke ViewModel methods which mutate private `MutableStateFlow` or trigger asynchronous coroutines in `viewModelScope`.

Composables collect state using `collectAsState()` and pass lambdas upwards, ensuring zero business logic inside UI composables.

---

## 4. Temporary Name Abstraction

Per Executive Directive Section 0 & 103, the name **Dork** is isolated to presentation strings, application metadata, and UI titles. The underlying domain models, repositories, and FHIR resource structures are completely platform-neutral (`health.dork.app`), allowing future rebranding to Proton Patient without architectural rewrites.
