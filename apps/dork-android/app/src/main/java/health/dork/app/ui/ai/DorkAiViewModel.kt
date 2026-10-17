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

data class DorkAiUiState(
  val messages: List<ChatMessage> = emptyList(),
  val inputQuery: String = "",
  val isThinking: Boolean = false,
  val suggestedPrompts: List<String> = listOf(
    "Explain my latest CBC report",
    "What medications am I taking?",
    "Prepare for my appointment with Dr. Chen",
    "Summarize my recent visits"
  )
)

class DorkAiViewModel(
  private val aiRepository: DorkAiRepository
) : ViewModel() {

  private val _input = MutableStateFlow("")

  val uiState: StateFlow<DorkAiUiState> = combine(
    aiRepository.aiMessages,
    aiRepository.isThinking,
    _input
  ) { messages, thinking, input ->
    DorkAiUiState(
      messages = messages,
      isThinking = thinking,
      inputQuery = input
    )
  }.stateIn(
    scope = viewModelScope,
    started = SharingStarted.WhileSubscribed(5000),
    initialValue = DorkAiUiState()
  )

  fun onInputChange(text: String) { _input.value = text }

  fun sendQuery(queryText: String? = null) {
    val text = queryText ?: _input.value.trim()
    if (text.isBlank()) return
    viewModelScope.launch {
      aiRepository.askDorkAi(text)
      if (queryText == null) _input.value = ""
    }
  }
}
