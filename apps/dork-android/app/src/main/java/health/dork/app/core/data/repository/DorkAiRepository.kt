package health.dork.app.core.data.repository

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.ChatMessage
import health.dork.app.core.data.model.HealthRecordItem
import health.dork.app.core.data.model.HealthRecordType
import health.dork.app.core.data.model.LabTestItem
import health.dork.app.core.data.model.MedicationPlan
import health.dork.app.core.data.model.MessageSender
import health.dork.app.core.data.model.PatientProfile
import health.dork.app.core.data.seed.DorkSeedData
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.builtins.ListSerializer
import java.time.LocalDate
import java.time.LocalDateTime

interface DorkAiRepository {
  val aiMessages: StateFlow<List<ChatMessage>>
  val isThinking: StateFlow<Boolean>
  suspend fun askDorkAi(query: String)
}

/**
 * A grounded, offline health assistant.
 *
 * It does not call a remote model and it does not invent answers. Each reply is
 * assembled from the patient repositories that are actually on the device, and
 * clinical-looking statements carry the record they came from.
 */
class DefaultDorkAiRepository(
  private val store: DorkStore = DorkStore(),
  private val patientProvider: () -> PatientProfile = { DorkSeedData.samplePatient },
  private val recordsProvider: () -> List<HealthRecordItem> = { DorkSeedData.healthRecords },
  private val labsProvider: () -> List<LabTestItem> = { DorkSeedData.labResults },
  private val medicationPlansProvider: () -> List<MedicationPlan> = { DorkSeedData.medicationPlans },
  private val appointmentsProvider: () -> List<AppointmentItem> = { DorkSeedData.appointments },
  private val now: () -> LocalDateTime = { LocalDateTime.now() }
) : DorkAiRepository {

  private val serializer = ListSerializer(ChatMessage.serializer())

  private val _aiMessages = MutableStateFlow(
    store.read(KEY_MESSAGES, serializer) ?: DorkSeedData.dorkAiInitialMessages
  )
  override val aiMessages: StateFlow<List<ChatMessage>> = _aiMessages.asStateFlow()

  private val _isThinking = MutableStateFlow(false)
  override val isThinking: StateFlow<Boolean> = _isThinking.asStateFlow()

  override suspend fun askDorkAi(query: String) {
    if (query.isBlank()) return
    val userMsg = ChatMessage(
      id = "user-${System.currentTimeMillis()}",
      sender = MessageSender.PATIENT,
      text = query.trim(),
      timestamp = "Just now"
    )
    _aiMessages.value = _aiMessages.value + userMsg
    store.write(KEY_MESSAGES, serializer, _aiMessages.value)
    _isThinking.value = true

    // A short pause keeps the interaction legible; the work is local.
    delay(350)

    val answer = buildAnswer(query)
    val aiResponse = ChatMessage(
      id = "ai-${System.currentTimeMillis()}",
      sender = MessageSender.DORK_AI,
      text = answer.text,
      timestamp = "Just now",
      isClinicalCitation = answer.source != null,
      sourceReference = answer.source
    )

    _aiMessages.value = _aiMessages.value + aiResponse
    store.write(KEY_MESSAGES, serializer, _aiMessages.value)
    _isThinking.value = false
  }

  private data class Answer(val text: String, val source: String?)

  private fun buildAnswer(query: String): Answer {
    val lower = query.lowercase()

    if (lower.contains("chest pain") ||
      lower.contains("cannot breathe") ||
      lower.contains("can't breathe") ||
      lower.contains("severe pain") ||
      lower.contains("stroke")
    ) {
      return Answer(
        text = "⚠️ IMPORTANT SAFETY NOTICE: Severe chest pain or acute difficulty breathing may indicate a medical emergency. Please call 911 or proceed immediately to the nearest emergency medical department. Dork AI cannot evaluate emergent conditions.",
        source = null
      )
    }

    if (lower.contains("lab") || lower.contains("cbc") || lower.contains("blood") ||
      lower.contains("hemoglobin") || lower.contains("result") || lower.contains("report")
    ) {
      return labAnswer()
    }

    if (lower.contains("medication") || lower.contains("prescription") ||
      lower.contains("medicine") || lower.contains("pill") || lower.contains("dose") ||
      lower.contains("amoxicillin")
    ) {
      return medicationAnswer()
    }

    if (lower.contains("appointment") || lower.contains("doctor") ||
      lower.contains("consult") || lower.contains("prepare")
    ) {
      return appointmentAnswer()
    }

    if (lower.contains("allerg")) return allergyAnswer()
    if (lower.contains("condition") || lower.contains("diagnos")) return conditionAnswer()

    return summaryAnswer()
  }

  private fun labAnswer(): Answer {
    val labs = labsProvider()
    val latestRecord = recordsProvider()
      .filter { it.type == HealthRecordType.LAB_RESULT }
      .maxByOrNull { it.dateIso }

    if (labs.isEmpty()) {
      return Answer(
        "There are no laboratory results stored on this device yet. Upload a lab report and I can walk through the values with you.",
        null
      )
    }

    val body = labs.take(5).joinToString("\n") { lab ->
      val range = "${lab.referenceRangeLow}–${lab.referenceRangeHigh} ${lab.unit}"
      "• ${lab.testName}: ${lab.value} ${lab.unit} (reference $range — ${lab.status.label})"
    }

    return Answer(
      text = buildString {
        append("Here are the laboratory values saved in your record")
        if (latestRecord != null) append(" (most recent: ${latestRecord.title}, ${latestRecord.displayDate})")
        append(":\n\n")
        append(body)
        append("\n\nThese are stored values, not a new interpretation. Ask your clinician if a result needs attention.")
      },
      source = latestRecord?.let { "Source: ${it.doctorOrLab} · ${it.displayDate}" }
        ?: labs.firstOrNull()?.let { "Source: ${it.laboratoryName} · ${it.dateString}" }
    )
  }

  private fun medicationAnswer(): Answer {
    val plans = medicationPlansProvider()
    if (plans.isEmpty()) {
      return Answer(
        "You have no medication plans stored on this device. Add a prescription or ask your clinician to send one.",
        null
      )
    }

    val body = plans.joinToString("\n") { plan ->
      "• ${plan.name} ${plan.dosage}: ${plan.frequency}. ${plan.instructions}"
    }
    val doctor = plans.firstOrNull()?.prescribingDoctor

    return Answer(
      text = "According to the medication schedules saved on this device:\n\n$body\n\nDose times: ${plans.flatMap { it.dailyTimes }.distinct().joinToString(", ")}. This is a copy of your plan, not new medical advice.",
      source = doctor?.let { "Source: Medication schedule · $it" }
    )
  }

  private fun appointmentAnswer(): Answer {
    val upcoming = appointmentsProvider()
      .filter { it.status.name != "Cancelled" }
      .filter { runCatching { LocalDateTime.parse(it.dateIso) }.getOrNull()?.isAfter(now()) == true }
      .minByOrNull { it.dateIso }

    if (upcoming == null) {
      return Answer(
        "You do not have an upcoming appointment stored on this device. You can book one from the Care tab.",
        null
      )
    }

    return Answer(
      text = buildString {
        append("Your next appointment is with ${upcoming.doctorName} (${upcoming.specialty}) ")
        append("on ${upcoming.displayDateTime} at ${upcoming.clinicLocation}.\n\n")
        append("Before the visit you may want to: ")
        append("1) review the reason recorded for the visit, ")
        append("2) note any medication side effects, ")
        append("3) write down the questions you want answered.")
      },
      source = "Source: Appointment record · ${upcoming.doctorName}"
    )
  }

  private fun allergyAnswer(): Answer {
    val allergies = patientProvider().allergies
    return Answer(
      text = if (allergies.isEmpty()) {
        "No allergies are recorded in your profile. You can add them from Profile → My Health Profile."
      } else {
        "Your profile lists these allergies:\n\n${allergies.joinToString("\n") { "• $it" }}\n\nTell every clinician and pharmacist about them."
      },
      source = "Source: Patient profile"
    )
  }

  private fun conditionAnswer(): Answer {
    val patient = patientProvider()
    return Answer(
      text = if (patient.conditions.isEmpty()) {
        "No diagnosed conditions are recorded in your profile."
      } else {
        "Your profile lists these diagnosed conditions:\n\n${patient.conditions.joinToString("\n") { "• $it" }}\n\nThis comes from the profile you maintain, not a new diagnosis."
      },
      source = "Source: Patient profile"
    )
  }

  private fun summaryAnswer(): Answer {
    val patient = patientProvider()
    val plans = medicationPlansProvider()
    val latestRecord = recordsProvider().maxByOrNull { it.dateIso }
    val upcoming = appointmentsProvider()
      .filter { it.status.name != "Cancelled" }
      .filter { runCatching { LocalDateTime.parse(it.dateIso) }.getOrNull()?.isAfter(now()) == true }
      .minByOrNull { it.dateIso }

    return Answer(
      text = buildString {
        append("Here is what is stored for ${patient.fullName.split(" ").firstOrNull() ?: "you"}:\n\n")
        append("• Active medication plans: ${plans.size}")
        append("\n• Recorded conditions: ${patient.conditions.size}")
        append("\n• Allergies: ${patient.allergies.size}")
        if (latestRecord != null) {
          append("\n• Most recent record: ${latestRecord.title} (${latestRecord.displayDate})")
        }
        if (upcoming != null) {
          append("\n• Next appointment: ${upcoming.doctorName}, ${upcoming.displayDateTime}")
        } else {
          append("\n• Next appointment: none booked")
        }
        append("\n\nAsk me about labs, medications, allergies, conditions, or an appointment.")
      },
      source = null
    )
  }

  private companion object {
    const val KEY_MESSAGES = "ai:messages"
  }
}
