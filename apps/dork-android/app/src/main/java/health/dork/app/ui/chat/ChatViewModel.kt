package health.dork.app.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.core.data.model.ChatMessage
import health.dork.app.core.data.repository.ChatRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class ChatUiState(
  val messages: List<ChatMessage> = emptyList(),
  val inputMessage: String = "",
  val providerName: String = "Dr. Sarah Chen",
  val providerSpecialty: String = "General Medicine · Beacon Hill Health"
)

class ChatViewModel(
  private val chatRepository: ChatRepository
) : ViewModel() {

  private val _input = MutableStateFlow("")

  val uiState: StateFlow<ChatUiState> = combine(
    chatRepository.doctorChatMessages,
    _input
  ) { messages, input ->
    ChatUiState(
      messages = messages,
      inputMessage = input
    )
  }.stateIn(
    scope = viewModelScope,
    started = SharingStarted.WhileSubscribed(5000),
    initialValue = ChatUiState()
  )

  fun onInputChange(text: String) { _input.value = text }

  fun sendMessage() {
    val text = _input.value.trim()
    if (text.isBlank()) return
    viewModelScope.launch {
      chatRepository.sendDoctorMessage(text)
      _input.value = ""
    }
  }
}
