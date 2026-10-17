package health.dork.app.ui.ai

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.MessageSender
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkChip
import health.dork.app.core.designsystem.components.DorkStatusBadge
import health.dork.app.core.designsystem.components.DorkStatusType
import health.dork.app.core.designsystem.components.DorkTextField

@Composable
fun DorkAiScreen(
  viewModel: DorkAiViewModel,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val listState = rememberLazyListState()
  val promptScrollState = rememberScrollState()

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
    // Header
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.l)
    ) {
      Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(
          imageVector = Icons.Rounded.AutoAwesome,
          contentDescription = null,
          tint = MaterialTheme.colorScheme.primary,
          modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(DorkSpacing.xs))
        Text(
          text = "Dork AI",
          style = MaterialTheme.typography.displayMedium,
          color = DorkTheme.colors.textPrimary
        )
      }
      Text(
        text = "Your health information, explained.",
        style = MaterialTheme.typography.bodyMedium,
        color = DorkTheme.colors.textSecondary
      )
    }

    // Safety Boundaries Notice (Section 34 & 95)
    Surface(
      color = DorkTheme.colors.surfaceSecondary,
      modifier = Modifier.fillMaxWidth()
    ) {
      Row(
        modifier = Modifier.padding(horizontal = DorkSpacing.m, vertical = DorkSpacing.xs),
        verticalAlignment = Alignment.CenterVertically
      ) {
        Icon(
          imageVector = Icons.Rounded.Info,
          contentDescription = null,
          tint = DorkTheme.colors.textSecondary,
          modifier = Modifier.size(16.dp)
        )
        Spacer(modifier = Modifier.width(DorkSpacing.xs))
        Text(
          text = "Provides information from your health records. Not a substitute for professional medical care.",
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textSecondary
        )
      }
    }

    // Suggested Prompt Chips (Section 33)
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .horizontalScroll(promptScrollState)
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.s),
      horizontalArrangement = Arrangement.spacedBy(DorkSpacing.xs)
    ) {
      uiState.suggestedPrompts.forEach { prompt ->
        DorkChip(
          label = prompt,
          selected = false,
          onClick = { viewModel.sendQuery(prompt) }
        )
      }
    }

    // Chat Message Stream
    LazyColumn(
      state = listState,
      modifier = Modifier
        .weight(1f)
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.xs),
      verticalArrangement = Arrangement.spacedBy(DorkSpacing.m)
    ) {
      items(uiState.messages) { msg ->
        val isAi = msg.sender == MessageSender.DORK_AI
        val bubbleColor = if (isAi) DorkTheme.colors.surfaceSecondary else MaterialTheme.colorScheme.primary
        val textColor = if (isAi) DorkTheme.colors.textPrimary else MaterialTheme.colorScheme.onPrimary

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = if (isAi) Arrangement.Start else Arrangement.End
        ) {
          Surface(
            shape = DorkShapes.large,
            color = bubbleColor,
            border = if (isAi) androidx.compose.foundation.BorderStroke(1.dp, DorkTheme.colors.surfaceBorderSubtle) else null,
            modifier = Modifier.fillMaxWidth(0.88f)
          ) {
            Column(modifier = Modifier.padding(DorkSpacing.m)) {
              if (isAi) {
                Row(
                  verticalAlignment = Alignment.CenterVertically,
                  modifier = Modifier.padding(bottom = 4.dp)
                ) {
                  Icon(
                    imageVector = Icons.Rounded.AutoAwesome,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(14.dp)
                  )
                  Spacer(modifier = Modifier.width(4.dp))
                  Text(
                    text = "Dork AI Assistant",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary
                  )
                }
              }

              Text(
                text = msg.text,
                style = MaterialTheme.typography.bodyMedium,
                color = textColor
              )

              if (msg.sourceReference != null) {
                Spacer(modifier = Modifier.height(DorkSpacing.s))
                Surface(
                  shape = DorkShapes.small,
                  color = MaterialTheme.colorScheme.surface,
                  modifier = Modifier.fillMaxWidth()
                ) {
                  Text(
                    text = msg.sourceReference,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(horizontal = DorkSpacing.s, vertical = 4.dp)
                  )
                }
              }

              Spacer(modifier = Modifier.height(4.dp))

              Text(
                text = msg.timestamp,
                style = MaterialTheme.typography.labelSmall,
                color = if (isAi) DorkTheme.colors.textTertiary else MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.6f),
                modifier = Modifier.align(Alignment.End)
              )
            }
          }
        }
      }

      if (uiState.isThinking) {
        item {
          Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(DorkSpacing.s)
          ) {
            CircularProgressIndicator(
              modifier = Modifier.size(16.dp),
              strokeWidth = 2.dp,
              color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.width(DorkSpacing.s))
            Text(
              text = "Reviewing your longitudinal records...",
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.textSecondary
            )
          }
        }
      }
    }

    // Message Input
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
          value = uiState.inputQuery,
          onValueChange = viewModel::onInputChange,
          placeholder = "Ask Dork about your health...",
          modifier = Modifier.weight(1f)
        )

        Spacer(modifier = Modifier.width(DorkSpacing.s))

        IconButton(
          onClick = { viewModel.sendQuery() },
          enabled = uiState.inputQuery.isNotBlank() && !uiState.isThinking
        ) {
          Icon(
            imageVector = Icons.AutoMirrored.Rounded.Send,
            contentDescription = "Send",
            tint = if (uiState.inputQuery.isNotBlank()) MaterialTheme.colorScheme.primary else DorkTheme.colors.textTertiary
          )
        }
      }
    }
  }
}
