package health.dork.app.core.data

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.model.ShareChannel
import health.dork.app.core.data.repository.DorkClinicRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime

/**
 * Linking is a local label, and the share log is the audit trail that lets the
 * app say "handed over on Tuesday" without ever claiming a server received it.
 */
class ClinicRepositoryTest {

  private val now = LocalDateTime.of(2026, 10, 26, 9, 12)

  @Test
  fun aSixCharacterCodeLinksTheClinic() {
    val repository = DorkClinicRepository(DorkStore(), { now })

    val result = repository.linkClinic(
      clinicName = "Beacon Hill Family Health",
      clinicPhone = "+1 617 555 0142",
      clinicianName = "Dr. Sarah Chen",
      linkCode = "4k9p2m"
    )

    assertTrue(result.isSuccess)
    assertEquals("4K9P2M", result.getOrThrow().linkCode)
    assertNotNull(repository.link.value)
    assertTrue(repository.isLinked())
  }

  @Test
  fun aShortCodeIsRejected() {
    val repository = DorkClinicRepository(DorkStore(), { now })

    val result = repository.linkClinic("Clinic", "", "", "4K9")

    assertTrue(result.isFailure)
    assertNull(repository.link.value)
  }

  @Test
  fun aNamelessClinicIsRejected() {
    val repository = DorkClinicRepository(DorkStore(), { now })

    val result = repository.linkClinic("   ", "", "", "4K9P2M")

    assertTrue(result.isFailure)
  }

  @Test
  fun unlinkingClearsTheLink() {
    val repository = DorkClinicRepository(DorkStore(), { now })
    repository.linkClinic("Clinic", "", "", "4K9P2M")

    repository.unlink()

    assertNull(repository.link.value)
    assertFalse(repository.isLinked())
  }

  @Test
  fun sharingIsRecordedWithChannelAndDestination() {
    val repository = DorkClinicRepository(DorkStore(), { now })
    repository.linkClinic("Beacon Hill", "", "", "4K9P2M")

    val event = repository.recordShare("Pre-visit intake", ShareChannel.SHARE_SHEET)

    assertEquals("Beacon Hill", event.destination)
    assertEquals(ShareChannel.SHARE_SHEET.label, event.channel)
    assertEquals(1, repository.shareLog.value.size)
  }

  @Test
  fun theShareLogKeepsNewestFirst() {
    val repository = DorkClinicRepository(DorkStore(), { now })
    repository.recordShare("First", ShareChannel.COPY, "Clinic")
    repository.recordShare("Second", ShareChannel.PRINTED, "Clinic")

    assertEquals("Second", repository.shareLog.value.first().packetKind)
  }
}
