# Dork Development Guide

## 1. Environment Setup

### Required Tools
- **Operating System**: macOS (Apple Silicon or Intel), Linux, or Windows.
- **Java Development Kit**: JDK 21.
- **Android SDK**: API Level 36 (`platforms/android-36`), Build-Tools `36.0.0`.
- **Gradle**: Gradle 9.1 via included `./gradlew` wrapper.

### Local Properties
Ensure `local.properties` exists in `apps/dork-android/` pointing to your local Android SDK:
```properties
sdk.dir=/Users/<username>/Library/Android/sdk
```

---

## 2. Common Gradle Commands

```bash
# Compile and run all unit tests
./gradlew test

# Compile Kotlin sources
./gradlew compileDebugKotlin

# Assemble debug APK
./gradlew assembleDebug

# Run Android lint
./gradlew lintDebug
```

---

## 3. Architecture & Key Modules

- **Cases Feature (`ui/cases/`, `core/data/repository/CaseRepository.kt`)**: Implements episode-of-care timelines, linking lab results, medical documents, and consultations into discrete case state machines.
- **KeepAlive Service (`core/service/DorkKeepAliveService.kt`)**: Binds a foreground health/sync service with notification channels to maintain continuous socket connection and background sync queues.
- **DorkStore v2 (`core/data/local/DorkStore.kt`)**: Durable key-value storage engine caching patient profile, local appointments, medication adherence logs, and pending outbox sync payloads.

---

## 4. Switching Environments

In `FhirConfig.kt`:
```kotlin
val config = FhirConfig(
  environment = Environment.DEVELOPMENT, // DEVELOPMENT | STAGING | PRODUCTION
  persistenceMode = FhirPersistenceMode.SYNTHETIC_STORE, // SYNTHETIC_STORE (default) | MEDPLUM_LIVE (experimental)
  baseUrl = "http://10.0.2.2:8103/fhir/R4" // Local Medplum dev loopback URL
)
```

- **SYNTHETIC_STORE (Default)**: In-memory deterministic storage using seeded profiles for offline development and testing.
- **MEDPLUM_LIVE (Experimental)**: Optional development bridge. Maps to `localhost:8103` on the host machine when using the Android Emulator (`10.0.2.2`). **Security Note**: Dev tokens (`dork-patient-token-dev`) and cleartext HTTP are restricted to local evaluation; production deployments require TLS endpoints with authenticated token management.
