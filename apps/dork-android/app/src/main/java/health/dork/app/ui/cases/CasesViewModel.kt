package health.dork.app.ui.cases

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.core.data.model.CaseBannerTheme
import health.dork.app.core.data.model.CaseStatus
import health.dork.app.core.data.model.CaseTreatment
import health.dork.app.core.data.model.CaseVitals
import health.dork.app.core.data.model.ClinicalCase
import health.dork.app.core.data.model.DocumentCategory
import health.dork.app.core.data.model.HealthDocument
import health.dork.app.core.data.model.HealthRecordItem
import health.dork.app.core.data.model.HealthRecordType
import health.dork.app.core.data.model.PrescriptionMedicineItem
import health.dork.app.core.data.repository.CaseRepository
import health.dork.app.core.data.repository.RecordRepository
import health.dork.app.core.data.seed.DorkSeedData
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.UUID

data class CasesUiState(
  val cases: List<ClinicalCase> = emptyList(),
  val searchQuery: String = "",
  val selectedFilter: String = "All Cases",
  val selectedCase: ClinicalCase? = null,
  val isCreatingCase: Boolean = false
)

class CasesViewModel(
  private val caseRepository: CaseRepository,
  private val recordRepository: RecordRepository? = null
) : ViewModel() {

  val documents: StateFlow<List<HealthDocument>> =
    recordRepository?.documents ?: MutableStateFlow(DorkSeedData.documents)

  private val _searchQuery = MutableStateFlow("")
  val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

  private val _selectedFilter = MutableStateFlow("All Cases")
  val selectedFilter: StateFlow<String> = _selectedFilter.asStateFlow()

  private val _selectedCase = MutableStateFlow<ClinicalCase?>(null)
  val selectedCase: StateFlow<ClinicalCase?> = _selectedCase.asStateFlow()

  private val _isCreatingCase = MutableStateFlow(false)
  val isCreatingCase: StateFlow<Boolean> = _isCreatingCase.asStateFlow()

  val filters = listOf("All Cases", "Active Care", "Resolved", "Observation")

  val uiState: StateFlow<CasesUiState> = combine(
    caseRepository.cases,
    _searchQuery,
    _selectedFilter,
    _selectedCase,
    _isCreatingCase
  ) { allCases, query, filter, activeCase, creating ->
    val filtered = allCases.filter { caseItem ->
      val matchesQuery = query.isBlank() ||
        caseItem.diagnosisTitle.contains(query, ignoreCase = true) ||
        caseItem.doctorName.contains(query, ignoreCase = true) ||
        caseItem.subtitle.contains(query, ignoreCase = true) ||
        caseItem.icdCode.contains(query, ignoreCase = true) ||
        caseItem.medications.any { it.name.contains(query, ignoreCase = true) }

      val matchesFilter = when (filter) {
        "Active Care" -> caseItem.status == CaseStatus.ACTIVE
        "Resolved" -> caseItem.status == CaseStatus.RESOLVED
        "Observation" -> caseItem.status == CaseStatus.MONITORING || caseItem.status == CaseStatus.FOLLOW_UP_DUE
        else -> true
      }

      matchesQuery && matchesFilter
    }

    CasesUiState(
      cases = filtered,
      searchQuery = query,
      selectedFilter = filter,
      selectedCase = activeCase,
      isCreatingCase = creating
    )
  }.stateIn(
    scope = viewModelScope,
    started = SharingStarted.WhileSubscribed(5000),
    initialValue = CasesUiState()
  )

  fun onSearchQueryChange(query: String) {
    _searchQuery.value = query
  }

  fun onFilterSelect(filter: String) {
    _selectedFilter.value = filter
  }

  fun selectCase(case: ClinicalCase?) {
    _selectedCase.value = case
  }

  fun setCreatingCase(creating: Boolean) {
    _isCreatingCase.value = creating
  }

  fun toggleCaseResolved(caseId: String) {
    viewModelScope.launch {
      val target = caseRepository.cases.value.find { it.id == caseId } ?: return@launch
      val newStatus = if (target.status == CaseStatus.RESOLVED) CaseStatus.ACTIVE else CaseStatus.RESOLVED
      caseRepository.updateCaseStatus(caseId, newStatus)
      if (_selectedCase.value?.id == caseId) {
        _selectedCase.value = _selectedCase.value?.copy(status = newStatus)
      }
    }
  }

  fun logEncounter(
    diagnosis: String,
    doctor: String,
    clinic: String,
    treatmentSummary: String,
    medicationName: String?,
    medicationDose: String?
  ) {
    viewModelScope.launch {
      val now = LocalDate.now()
      val day = now.format(DateTimeFormatter.ofPattern("dd"))
      val month = now.format(DateTimeFormatter.ofPattern("MMM"))
      val year = now.format(DateTimeFormatter.ofPattern("yyyy"))

      val meds = if (!medicationName.isNullOrBlank()) {
        listOf(
          PrescriptionMedicineItem(
            name = medicationName,
            dose = medicationDose ?: "Standard dose",
            route = "Oral",
            frequency = "As directed",
            duration = "7 days",
            instructions = "Follow clinical instructions provided during consultation."
          )
        )
      } else emptyList()

      val newCase = ClinicalCase(
        id = "case-${UUID.randomUUID().toString().take(8)}",
        diagnosisTitle = diagnosis,
        subtitle = "$doctor • General Clinic",
        icdCode = "Encounter Note",
        clinicName = clinic.ifBlank { "Dork Health Clinic" },
        doctorName = doctor.ifBlank { "Attending Clinician" },
        visitDateIso = now.toString(),
        dayDisplay = day,
        monthDisplay = month,
        yearDisplay = year,
        status = CaseStatus.ACTIVE,
        bannerTheme = CaseBannerTheme.EMBER_GLOW,
        clinicalSummary = "Clinical encounter logged on device. Treatment and monitoring initiated.",
        treatment = CaseTreatment(
          protocolSummary = treatmentSummary.ifBlank { "Standard outpatient clinical management protocol." }
        ),
        medications = meds,
        reports = listOf(
          HealthRecordItem(
            id = "rec-${UUID.randomUUID().toString().take(6)}",
            type = HealthRecordType.CONSULTATION,
            title = "Encounter Clinical Record",
            subtitle = "$diagnosis · $doctor",
            dateIso = now.toString(),
            displayDate = "$day $month $year",
            doctorOrLab = clinic.ifBlank { "Dork Health Clinic" },
            summary = treatmentSummary.ifBlank { "Patient encounter documented and stored securely on device." }
          )
        ),
        vitals = CaseVitals(
          bloodPressure = "120/80 mmHg",
          heartRate = "72 bpm",
          spo2 = "99%"
        ),
        followUpRecommendation = "Follow up with physician if symptoms persist.",
        metaNoteCount = "${meds.size} Rx • 1 Report"
      )

      caseRepository.addCase(newCase)
      _isCreatingCase.value = false
      _selectedCase.value = newCase
    }
  }

  fun uploadDocument(
    title: String,
    category: DocumentCategory = DocumentCategory.LAB_REPORT,
    fileUri: String,
    fileSizeText: String,
    bytes: ByteArray? = null,
    mimeType: String = "application/pdf",
    fileName: String = title
  ) {
    viewModelScope.launch {
      recordRepository?.uploadDocument(
        title = title,
        category = category,
        fileUri = fileUri,
        fileSizeText = fileSizeText,
        bytes = bytes,
        mimeType = mimeType,
        fileName = fileName
      )
    }
  }
}
