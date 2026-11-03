package health.dork.app.ui.ai

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.core.data.model.ChatMessage
import health.dork.app.core.data.repository.DorkAiRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class DorkAiMode(
  val title: String,
  val subtitle: String,
  val badgeText: String
) {
  SYNTHESIS("Clinical Synthesis", "Local patient health records", "Records Mode"),
  GUIDELINES("Clinical Guidelines", "ACC/AHA & ADA Evidence Base", "Guidelines Mode"),
  DEEP_LAB("Deep Biomarkers", "Microscopic cellular & lab analysis", "Deep Lab Mode")
}

data class DorkAiUiState(
  val messages: List<ChatMessage> = emptyList(),
  val inputQuery: String = "",
  val isThinking: Boolean = false,
  val selectedMode: DorkAiMode = DorkAiMode.SYNTHESIS,
  val activeAttachment: String? = null,
  val showAttachSheet: Boolean = false,
  val showScanDialog: Boolean = false,
  val availableAttachments: List<String> = listOf(
    "Complete Blood Count (CBC) — Oct 14, 2026",
    "Comprehensive Metabolic Panel — Oct 14, 2026",
    "Echocardiogram (Echo) Summary — Sept 2026",
    "Cardiology Clinical Visit Notes — Dr. Chen",
    "Prescription: Amoxicillin 500mg PO TID"
  )
)

class DorkAiViewModel(
  private val aiRepository: DorkAiRepository
) : ViewModel() {

  private val _input = MutableStateFlow("")
  private val _selectedMode = MutableStateFlow(DorkAiMode.SYNTHESIS)
  private val _activeAttachment = MutableStateFlow<String?>(null)
  private val _showAttachSheet = MutableStateFlow(false)
  private val _showScanDialog = MutableStateFlow(false)

  val uiState: StateFlow<DorkAiUiState> = combine(
    aiRepository.aiMessages,
    aiRepository.isThinking,
    _input,
    _selectedMode,
    _activeAttachment,
    _showAttachSheet,
    _showScanDialog
  ) { args: Array<Any?> ->
    @Suppress("UNCHECKED_CAST")
    val messages = args[0] as List<ChatMessage>
    val thinking = args[1] as Boolean
    val input = args[2] as String
    val mode = args[3] as DorkAiMode
    val attachment = args[4] as String?
    val attachSheet = args[5] as Boolean
    val scanDialog = args[6] as Boolean

    DorkAiUiState(
      messages = messages,
      isThinking = thinking,
      inputQuery = input,
      selectedMode = mode,
      activeAttachment = attachment,
      showAttachSheet = attachSheet,
      showScanDialog = scanDialog
    )
  }.stateIn(
    scope = viewModelScope,
    started = SharingStarted.WhileSubscribed(5000),
    initialValue = DorkAiUiState()
  )

  fun onInputChange(text: String) {
    _input.value = text
  }

  fun setMode(mode: DorkAiMode) {
    _selectedMode.value = if (_selectedMode.value == mode) DorkAiMode.SYNTHESIS else mode
  }

  fun toggleAttachSheet(show: Boolean) {
    _showAttachSheet.value = show
  }

  fun toggleScanDialog(show: Boolean) {
    _showScanDialog.value = show
  }

  fun attachRecord(recordName: String) {
    _activeAttachment.value = recordName
    _showAttachSheet.value = false
  }

  fun clearAttachment() {
    _activeAttachment.value = null
  }

  fun clearConversation() {
    aiRepository.clearMessages()
    _activeAttachment.value = null
    _input.value = ""
  }

  fun selectBookingSlot(messageId: String, slotIso: String) {
    viewModelScope.launch {
      aiRepository.selectBookingSlot(messageId, slotIso)
    }
  }

  fun confirmAiBooking(messageId: String) {
    viewModelScope.launch {
      aiRepository.confirmBooking(messageId)
    }
  }

  fun sendQuery(queryText: String? = null) {
    val rawText = queryText ?: _input.value.trim()
    if (rawText.isBlank() && _activeAttachment.value == null) return

    val currentMode = _selectedMode.value
    val attachment = _activeAttachment.value

    val fullQuery = buildString {
      if (attachment != null) {
        append("[Attached: $attachment] ")
      }
      when (currentMode) {
        DorkAiMode.GUIDELINES -> if (!rawText.contains("guideline", ignoreCase = true)) append("[Clinical Guidelines] ")
        DorkAiMode.DEEP_LAB -> if (!rawText.contains("biomarker", ignoreCase = true) && !rawText.contains("deep", ignoreCase = true)) append("[Deep Biomarker Analysis] ")
        DorkAiMode.SYNTHESIS -> { /* default */ }
      }
      append(if (rawText.isNotBlank()) rawText else "Analyze the attached medical record.")
    }

    viewModelScope.launch {
      aiRepository.askDorkAi(fullQuery)
      if (queryText == null) {
        _input.value = ""
      }
      _activeAttachment.value = null
    }
  }
}
