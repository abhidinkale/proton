package health.dork.app.ui.records

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.core.data.model.DocumentCategory
import health.dork.app.core.data.model.HealthDocument
import health.dork.app.core.data.model.HealthRecordItem
import health.dork.app.core.data.model.HealthRecordType
import health.dork.app.core.data.model.LabTestItem
import health.dork.app.core.data.model.MedicationPlan
import health.dork.app.core.data.model.PrescriptionDetail
import health.dork.app.core.data.repository.MedicationRepository
import health.dork.app.core.data.repository.RecordRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class RecordsUiState(
  val selectedCategory: String = "All Records",
  val timelineItems: List<HealthRecordItem> = emptyList(),
  val filteredTimeline: List<HealthRecordItem> = emptyList(),
  val labResults: List<LabTestItem> = emptyList(),
  val documents: List<HealthDocument> = emptyList(),
  val activePrescription: PrescriptionDetail? = null,
  val selectedRecord: HealthRecordItem? = null,
  val isUploading: Boolean = false,
  val uploadSuccessDocument: HealthDocument? = null
)

class RecordsViewModel(
  private val recordRepository: RecordRepository,
  private val medicationRepository: MedicationRepository
) : ViewModel() {

  private val _uiState = MutableStateFlow(RecordsUiState())
  val uiState: StateFlow<RecordsUiState> = _uiState.asStateFlow()

  val categories = listOf("All Records", "Consultations", "Labs", "Prescriptions", "Documents")

  init {
    viewModelScope.launch {
      recordRepository.timelineRecords.collect { timeline ->
        _uiState.value = _uiState.value.copy(
          timelineItems = timeline,
          filteredTimeline = filterTimeline(timeline, _uiState.value.selectedCategory)
        )
      }
    }
    viewModelScope.launch {
      recordRepository.labResults.collect { labs ->
        _uiState.value = _uiState.value.copy(labResults = labs)
      }
    }
    viewModelScope.launch {
      recordRepository.documents.collect { docs ->
        _uiState.value = _uiState.value.copy(documents = docs)
      }
    }
    viewModelScope.launch {
      recordRepository.activePrescription.collect { rx ->
        _uiState.value = _uiState.value.copy(activePrescription = rx)
      }
    }
  }

  private fun filterTimeline(records: List<HealthRecordItem>, cat: String): List<HealthRecordItem> {
    return when (cat) {
      "Consultations" -> records.filter { it.type == HealthRecordType.CONSULTATION }
      "Labs" -> records.filter { it.type == HealthRecordType.LAB_RESULT }
      "Prescriptions" -> records.filter { it.type == HealthRecordType.PRESCRIPTION }
      "Documents" -> records.filter { it.type == HealthRecordType.DOCUMENT }
      else -> records
    }
  }

  fun onCategorySelected(cat: String) {
    val s = _uiState.value
    _uiState.value = s.copy(
      selectedCategory = cat,
      filteredTimeline = filterTimeline(s.timelineItems, cat)
    )
  }

  fun onRecordSelected(record: HealthRecordItem) {
    _uiState.value = _uiState.value.copy(selectedRecord = record)
  }

  fun uploadDocument(title: String, category: DocumentCategory, uri: String) {
    viewModelScope.launch {
      _uiState.value = _uiState.value.copy(isUploading = true)
      val res = recordRepository.uploadDocument(title, category, uri, "1.4 MB PDF")
      _uiState.value = _uiState.value.copy(isUploading = false)
      if (res.isSuccess) {
        _uiState.value = _uiState.value.copy(uploadSuccessDocument = res.getOrThrow())
      }
    }
  }

  fun addPrescriptionToMedicationSchedule(prescription: PrescriptionDetail, onDone: () -> Unit) {
    viewModelScope.launch {
      prescription.medications.forEach { med ->
        medicationRepository.addMedicationPlan(
          MedicationPlan(
            id = "med-${System.currentTimeMillis()}-${med.name.lowercase().take(4)}",
            name = med.name,
            dosage = med.dose,
            frequency = med.frequency,
            duration = med.duration,
            instructions = med.instructions,
            prescribingDoctor = prescription.doctorName,
            startDateIso = "2026-10-18",
            dailyTimes = listOf("8:00 AM", "2:00 PM", "8:00 PM")
          )
        )
      }
      onDone()
    }
  }
}
