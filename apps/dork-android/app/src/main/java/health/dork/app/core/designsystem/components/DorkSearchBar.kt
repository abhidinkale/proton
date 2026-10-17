package health.dork.app.core.designsystem.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkTheme

@Composable
fun DorkSearchBar(
  query: String,
  onQueryChange: (String) -> Unit,
  modifier: Modifier = Modifier,
  placeholder: String = "Doctor, specialty or condition",
  onSearch: (String) -> Unit = {}
) {
  OutlinedTextField(
    value = query,
    onValueChange = onQueryChange,
    modifier = modifier.fillMaxWidth(),
    singleLine = true,
    shape = DorkShapes.large,
    placeholder = {
      Text(
        text = placeholder,
        style = MaterialTheme.typography.bodyMedium,
        color = DorkTheme.colors.textTertiary
      )
    },
    leadingIcon = {
      Icon(
        imageVector = Icons.Rounded.Search,
        contentDescription = "Search",
        tint = DorkTheme.colors.textSecondary,
        modifier = Modifier.size(20.dp)
      )
    },
    trailingIcon = {
      AnimatedVisibility(visible = query.isNotEmpty()) {
        Icon(
          imageVector = Icons.Rounded.Close,
          contentDescription = "Clear search",
          tint = DorkTheme.colors.textTertiary,
          modifier = Modifier
            .size(20.dp)
            .clickable { onQueryChange("") }
        )
      }
    },
    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
    keyboardActions = KeyboardActions(onSearch = { onSearch(query) }),
    colors = OutlinedTextFieldDefaults.colors(
      focusedContainerColor = DorkTheme.colors.surfaceSecondary,
      unfocusedContainerColor = DorkTheme.colors.surfaceSecondary,
      focusedBorderColor = MaterialTheme.colorScheme.primary,
      unfocusedBorderColor = Color.Transparent,
      focusedTextColor = DorkTheme.colors.textPrimary,
      unfocusedTextColor = DorkTheme.colors.textPrimary
    )
  )
}
