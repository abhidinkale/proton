package health.dork.app.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.MessageSender
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkTextField
import health.dork.app.core.designsystem.components.DorkTopBar

@Composable
fun ChatScreen(
  viewModel: ChatViewModel,
  onBackClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val listState = rememberLazyListState()

  LaunchedEffect(uiState.messages.size) {
    if (uiState.messages.isNotEmpty()) {
      listState.animateScrollToItem(uiState.messages.size - 1)
    }
  }

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    DorkTopBar(
      title = uiState.providerName,
      subtitle = uiState.providerSpecialty,
      onBackClick = onBackClick
    )

    // Honest local-message notice
    Surface(
      color = DorkTheme.colors.surfaceSecondary,
      modifier = Modifier.fillMaxWidth()
    ) {
      Row(
        modifier = Modifier.padding(horizontal = DorkSpacing.m, vertical = DorkSpacing.xs),
        verticalAlignment = Alignment.CenterVertically
      ) {
        Icon(
          imageVector = Icons.Rounded.Lock,
          contentDescription = null,
          tint = MaterialTheme.colorScheme.primary,
          modifier = Modifier.size(16.dp)
        )
        Spacer(modifier = Modifier.width(DorkSpacing.xs))
        Text(
          text = "Local care inbox. Messages are saved on this device and are not sent to a clinic in this build.",
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textSecondary
        )
      }
    }

    // Message Thread
    LazyColumn(
      state = listState,
      modifier = Modifier
        .weight(1f)
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.s),
      verticalArrangement = Arrangement.spacedBy(DorkSpacing.s)
    ) {
      items(uiState.messages) { msg ->
        val isMe = msg.sender == MessageSender.PATIENT
        val bubbleColor = if (isMe) MaterialTheme.colorScheme.primary else DorkTheme.colors.surfaceSecondary
        val textColor = if (isMe) MaterialTheme.colorScheme.onPrimary else DorkTheme.colors.textPrimary

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = if (isMe) Arrangement.End else Arrangement.Start
        ) {
          Surface(
            shape = DorkShapes.large,
            color = bubbleColor,
            modifier = Modifier.fillMaxWidth(0.82f)
          ) {
            Column(modifier = Modifier.padding(DorkSpacing.m)) {
              Text(
                text = msg.text,
                style = MaterialTheme.typography.bodyMedium,
                color = textColor
              )

              Spacer(modifier = Modifier.height(4.dp))

              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
              ) {
                Text(
                  text = msg.timestamp,
                  style = MaterialTheme.typography.labelSmall,
                  color = if (isMe) MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f) else DorkTheme.colors.textTertiary
                )
                if (isMe) {
                  Spacer(modifier = Modifier.width(4.dp))
                  Icon(
                    imageVector = Icons.Rounded.Check,
                    contentDescription = "Saved on this device",
                    tint = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.6f),
                    modifier = Modifier.size(14.dp)
                  )
                }
              }
            }
          }
        }
      }
    }

    // Input Bar
    Surface(
      color = MaterialTheme.colorScheme.surface,
      tonalElevation = 3.dp,
      modifier = Modifier.fillMaxWidth()
    ) {
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = DorkSpacing.m, vertical = DorkSpacing.s),
        verticalAlignment = Alignment.CenterVertically
      ) {
        DorkTextField(
          value = uiState.inputMessage,
          onValueChange = viewModel::onInputChange,
          placeholder = "Message Dr. Chen...",
          modifier = Modifier.weight(1f)
        )

        Spacer(modifier = Modifier.width(DorkSpacing.s))

        IconButton(
          onClick = viewModel::sendMessage,
          enabled = uiState.inputMessage.isNotBlank()
        ) {
          Icon(
            imageVector = Icons.AutoMirrored.Rounded.Send,
            contentDescription = "Send",
            tint = if (uiState.inputMessage.isNotBlank()) MaterialTheme.colorScheme.primary else DorkTheme.colors.textTertiary
          )
        }
      }
    }
  }
}
