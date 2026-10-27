package health.dork.app.core.reminder

/**
 * PROTON SMART PILL REMINDER & 68-MD CONSENT MODELS
 * Mapped directly to Proton's Closed-Loop Clinical OS & Medplum MedicationRequest.
 */

data class SmartPillReminder(
    val reminderId: String,
    val medicationName: String,
    val dose: String,
    val scheduleSlots: List<String>, // e.g. ["21:00", "09:00"]
    val foodInstruction: FoodTiming,
    val patientPurpose: String,
    val durationDays: Int,
    val isTaken: Boolean = false
)

enum class FoodTiming {
    BEFORE_FOOD,
    AFTER_FOOD,
    WITH_FOOD,
    NO_RESTRICTION
}

data class ExamRoomConsentHandshake(
    val patientId: String,
    val otp: String,
    val ttlSeconds: Int = 60,
    val status: String = "LOCKED_AWAITING_OTP",
    val qrPayload: String
)

data class FollowUpCheckIn(
    val intervalHours: Int,
    val questionPrompt: String,
    val patientResponse: String? = null,
    val reportedPath: FollowUpPath? = null
)

enum class FollowUpPath {
    GREEN_PATH_RESOLVING,
    RED_PATH_ESCALATED
}
