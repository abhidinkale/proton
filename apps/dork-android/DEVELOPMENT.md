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

## 3. Switching Environments

In `FhirConfig.kt`:
```kotlin
val config = FhirConfig(
  environment = Environment.DEVELOPMENT, // DEVELOPMENT | STAGING | PRODUCTION
  persistenceMode = FhirPersistenceMode.SYNTHETIC_STORE, // SYNTHETIC_STORE | MEDPLUM_LIVE
  baseUrl = "http://10.0.2.2:8103/fhir/R4" // Local Medplum or staging URL
)
```

- When using the Android Emulator, `10.0.2.2` maps to the host machine's `localhost` (e.g. Medplum running on port 8103).
- When using a physical device, supply your local network IP (e.g. `http://192.168.1.X:8103/fhir/R4`).
