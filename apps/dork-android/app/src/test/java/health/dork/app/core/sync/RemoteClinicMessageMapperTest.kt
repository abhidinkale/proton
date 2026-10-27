package health.dork.app.core.sync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RemoteClinicMessageMapperTest {

  @Test
  fun `a complete clinic message survives mapping`() {
    val mapped = RemoteClinicMessageMapper.toLocal(
      RemoteClinicMessage(
        id = "msg-1",
        body = "  Come in at 4pm.  ",
        authorName = "Dr. Sarah Lin, MD",
        kind = "CLINIC_REPLY",
        appointmentId = "apt-1",
        createdAt = "2026-10-26T15:00:00.000Z"
      ),
      fallbackIso = "2026-10-26T16:00:00.000Z"
    )

    requireNotNull(mapped)
    assertEquals("msg-1", mapped.id)
    assertEquals("Come in at 4pm.", mapped.body)
    assertEquals("Dr. Sarah Lin, MD", mapped.authorName)
    assertEquals("CLINIC_REPLY", mapped.kind)
    assertEquals("apt-1", mapped.appointmentId)
    assertEquals("2026-10-26T15:00:00.000Z", mapped.createdAtIso)
  }

  @Test
  fun `a row with no id or no body is dropped`() {
    assertNull(
      RemoteClinicMessageMapper.toLocal(
        RemoteClinicMessage(id = "", body = "hello"),
        fallbackIso = "2026-10-26T16:00:00.000Z"
      )
    )
    assertNull(
      RemoteClinicMessageMapper.toLocal(
        RemoteClinicMessage(id = "msg-1", body = "   "),
        fallbackIso = "2026-10-26T16:00:00.000Z"
      )
    )
  }

  @Test
  fun `a missing timestamp is stamped with the pull time so ordering still works`() {
    val mapped = RemoteClinicMessageMapper.toLocal(
      RemoteClinicMessage(id = "msg-1", body = "hello", createdAt = null),
      fallbackIso = "2026-10-26T16:00:00.000Z"
    )

    requireNotNull(mapped)
    assertEquals("2026-10-26T16:00:00.000Z", mapped.createdAtIso)
  }

  @Test
  fun `blank author and kind fall back to readable defaults`() {
    val mapped = RemoteClinicMessageMapper.toLocal(
      RemoteClinicMessage(id = "msg-1", body = "hello", authorName = " ", kind = " "),
      fallbackIso = "2026-10-26T16:00:00.000Z"
    )

    requireNotNull(mapped)
    assertEquals("Your clinic", mapped.authorName)
    assertEquals("CLINIC_MESSAGE", mapped.kind)
  }
}
