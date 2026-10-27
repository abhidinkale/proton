package health.dork.app.core.data

import health.dork.app.core.data.model.ClinicMessage
import health.dork.app.core.sync.OutboxKind
import health.dork.app.core.sync.PatientSession
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Sign-out hygiene.
 *
 * This phone can be handed to another patient. Anything clinic-scoped that
 * survives sign-out is a cross-patient disclosure: a queued check-in sent under
 * the next person's session, or a doctor's reply left on screen.
 */
class AppContainerSignOutTest {

  private fun container() = DefaultAppContainer(context = null)

  @Test
  fun `sign-out clears the clinic session and switch but keeps the server address`() {
    val app = container()
    app.syncSettings.setBaseUrl("https://clinic.example.org/")
    app.syncSettings.setEnabled(true)
    app.syncSettings.saveSession(
      PatientSession(
        token = "token-1",
        patientId = "pat-1",
        tenantId = "org-1",
        expiresAt = "2099-01-01T00:00:00"
      )
    )

    app.signOut()

    assertNull(app.syncSettings.session.value)
    assertFalse(app.syncSettings.enabled.value)
    assertEquals(
      "the address is not patient data and re-typing it is friction",
      "https://clinic.example.org/",
      app.syncSettings.baseUrl.value
    )
  }

  @Test
  fun `sign-out drops the queue so it cannot be sent by the next patient`() {
    val app = container()
    app.syncOutbox.enqueue(OutboxKind.REFILL, """{"refillId":"r1"}""")
    app.syncOutbox.enqueue(OutboxKind.FOLLOW_UP, """{"checkInId":"c1"}""")
    assertEquals(2, app.syncOutbox.entries.value.size)

    app.signOut()

    assertEquals(0, app.syncOutbox.entries.value.size)
  }

  @Test
  fun `sign-out leaves no clinic messages on the device`() {
    val app = container()
    app.clinicInboxRepository.merge(
      listOf(
        ClinicMessage(
          id = "msg-1",
          body = "Come in at 4pm.",
          createdAtIso = "2026-10-26T15:00:00.000Z"
        )
      )
    )
    assertEquals(1, app.clinicInboxRepository.messages.value.size)

    app.signOut()

    assertEquals(0, app.clinicInboxRepository.messages.value.size)
    assertEquals(0, app.clinicInboxRepository.unreadCount.value)
  }

  @Test
  fun `erasing all data clears the inbox in memory, not just on disk`() {
    val app = container()
    app.clinicInboxRepository.merge(
      listOf(
        ClinicMessage(
          id = "msg-1",
          body = "Your results are normal.",
          createdAtIso = "2026-10-26T15:00:00.000Z"
        )
      )
    )

    app.eraseAllDeviceData()

    // The repository is a singleton in the container; clearing only the
    // SharedPreferences would leave this flow showing the message until the
    // process restarted.
    assertEquals(0, app.clinicInboxRepository.messages.value.size)
    assertEquals(0, app.syncOutbox.entries.value.size)
    assertNull(app.syncSettings.session.value)
  }
}
