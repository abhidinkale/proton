package health.dork.app.core.security

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests covering Specification Section 44 & 72:
 * - PHI masking for secure logging
 * - Email masking
 */
class SecurityManagerTest {

  @Test
  fun testMaskPhiProtectsFullName() {
    val masked = SecurityManager.maskPhi("Alex Morgan")
    assertEquals("A*** M*****", masked)
    assertFalse(masked.contains("lex"))
    assertFalse(masked.contains("organ"))
  }

  @Test
  fun testMaskEmail() {
    val masked = SecurityManager.maskEmail("alex.morgan@synthetic.dork.health")
    assertTrue(masked.contains("a***n@synthetic.dork.health"))
    assertFalse(masked.contains("alex.morgan"))
  }
}
