package health.dork.app.core.data

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.repository.AuthState
import health.dork.app.core.data.repository.DorkAuthRepository
import health.dork.app.core.data.seed.DorkSeedData
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Device-local authentication must behave like authentication, not decoration:
 * no account means no sign-in, the wrong password is rejected, the verifier is
 * never the plain password, and a session survives a repository restart.
 */
class AuthRepositoryTest {

  private val profile = DorkSeedData.samplePatient.copy(
    id = "patient-test-1",
    email = "patient@example.com"
  )

  @Test
  fun freshInstallStartsUnauthenticatedWithoutAnAccount() = runTest {
    val repo = DorkAuthRepository(DorkStore())

    assertEquals(AuthState.Unauthenticated, repo.authState.value)
    assertFalse(repo.isDemoMode.value)
    assertNull(repo.registeredEmail.value)

    val result = repo.signIn("patient@example.com", "some-password")
    assertTrue(result.isFailure)
  }

  @Test
  fun onboardingCreatesAnAccountAndSignsIn() = runTest {
    val store = DorkStore()
    val repo = DorkAuthRepository(store)

    val result = repo.completeOnboarding(profile, "correct-horse-battery")
    assertTrue(result.isSuccess)
    assertFalse(repo.isDemoMode.value)
    assertEquals("patient@example.com", repo.registeredEmail.value)
    assertEquals(
      AuthState.Authenticated("patient-test-1", isDemoMode = false),
      repo.authState.value
    )

    // The password itself must never be persisted.
    val raw = store.getString("auth:account").orEmpty()
    assertFalse(raw.contains("correct-horse-battery"))
  }

  @Test
  fun wrongPasswordIsRejectedAndCorrectPasswordSignsIn() = runTest {
    val repo = DorkAuthRepository(DorkStore())
    repo.completeOnboarding(profile, "correct-horse-battery")
    repo.logout()

    assertEquals(AuthState.Unauthenticated, repo.authState.value)

    val wrong = repo.signIn("patient@example.com", "not-the-password")
    assertTrue(wrong.isFailure)
    assertEquals(AuthState.Unauthenticated, repo.authState.value)

    val wrongEmail = repo.signIn("someone@example.com", "correct-horse-battery")
    assertTrue(wrongEmail.isFailure)

    val correct = repo.signIn("PATIENT@example.com ", "correct-horse-battery")
    assertTrue(correct.isSuccess)
    assertEquals(
      AuthState.Authenticated("patient-test-1", isDemoMode = false),
      repo.authState.value
    )
  }

  @Test
  fun sessionSurvivesRepositoryRecreationButLogoutClearsIt() = runTest {
    val store = DorkStore()
    DorkAuthRepository(store).completeOnboarding(profile, "correct-horse-battery")

    val restored = DorkAuthRepository(store)
    assertEquals(
      AuthState.Authenticated("patient-test-1", isDemoMode = false),
      restored.authState.value
    )

    restored.logout()
    val afterLogout = DorkAuthRepository(store)
    assertEquals(AuthState.Unauthenticated, afterLogout.authState.value)
  }

  @Test
  fun demoPathIsExplicitAndSeparateFromRealAccounts() = runTest {
    val repo = DorkAuthRepository(DorkStore())
    repo.signInDemo()

    assertTrue(repo.isDemoMode.value)
    assertEquals(
      AuthState.Authenticated(DorkSeedData.samplePatient.id, isDemoMode = true),
      repo.authState.value
    )

    // A demo session must not leave a usable credential behind.
    val signIn = repo.signIn("alex.morgan@synthetic.dork.health", "anything")
    assertTrue(signIn.isFailure)
  }

  @Test
  fun erasingDeviceDataRemovesTheAccountAndSession() = runTest {
    val store = DorkStore()
    DorkAuthRepository(store).completeOnboarding(profile, "correct-horse-battery")

    store.clear()

    val afterErase = DorkAuthRepository(store)
    assertEquals(AuthState.Unauthenticated, afterErase.authState.value)
    assertNull(afterErase.registeredEmail.value)
    assertTrue(afterErase.signIn("patient@example.com", "correct-horse-battery").isFailure)
  }
}
