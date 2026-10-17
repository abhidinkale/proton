package health.dork.app.core.fhir

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap

/**
 * FHIR R4 Client supporting both offline-first synthetic FHIR storage and live Medplum server synchronization.
 * Protects patient PHI: no raw resource JSON or names printed to unmasked logs.
 */
class FhirApiClient(
  var config: FhirConfig = FhirConfig()
) {
  // In-memory FHIR synthetic storage (Key: "${resourceType}/${id}")
  private val syntheticStore = ConcurrentHashMap<String, String>()

  fun seedResource(resourceType: String, id: String, jsonContent: String) {
    syntheticStore["$resourceType/$id"] = jsonContent
  }

  fun getSyntheticResource(resourceType: String, id: String): String? {
    return syntheticStore["$resourceType/$id"]
  }

  fun getAllSyntheticOfType(resourceType: String): List<String> {
    return syntheticStore.filterKeys { it.startsWith("$resourceType/") }.values.toList()
  }

  suspend fun postResource(resourceType: String, jsonBody: String): Result<String> = withContext(Dispatchers.IO) {
    if (config.persistenceMode == FhirPersistenceMode.SYNTHETIC_STORE) {
      val generatedId = "syn-${System.currentTimeMillis()}-${(1000..9999).random()}"
      syntheticStore["$resourceType/$generatedId"] = jsonBody
      return@withContext Result.success(jsonBody)
    }

    try {
      val url = URL("${config.baseUrl}/$resourceType")
      val conn = (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        setRequestProperty("Content-Type", "application/fhir+json")
        setRequestProperty("Authorization", "Bearer ${config.token}")
        doOutput = true
        connectTimeout = 8000
        readTimeout = 8000
      }

      OutputStreamWriter(conn.outputStream).use { it.write(jsonBody) }

      val responseCode = conn.responseCode
      if (responseCode in 200..299) {
        val response = conn.inputStream.bufferedReader().use(BufferedReader::readText)
        Result.success(response)
      } else {
        val errorText = conn.errorStream?.bufferedReader()?.use(BufferedReader::readText) ?: "HTTP $responseCode"
        Result.failure(Exception("FHIR request failed with status $responseCode: $errorText"))
      }
    } catch (e: Exception) {
      Result.failure(e)
    }
  }

  suspend fun getResource(resourceType: String, id: String): Result<String> = withContext(Dispatchers.IO) {
    if (config.persistenceMode == FhirPersistenceMode.SYNTHETIC_STORE) {
      val found = syntheticStore["$resourceType/$id"]
      return@withContext if (found != null) {
        Result.success(found)
      } else {
        Result.failure(NoSuchElementException("Resource $resourceType/$id not found"))
      }
    }

    try {
      val url = URL("${config.baseUrl}/$resourceType/$id")
      val conn = (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "GET"
        setRequestProperty("Accept", "application/fhir+json")
        setRequestProperty("Authorization", "Bearer ${config.token}")
        connectTimeout = 8000
        readTimeout = 8000
      }

      val responseCode = conn.responseCode
      if (responseCode in 200..299) {
        val response = conn.inputStream.bufferedReader().use(BufferedReader::readText)
        Result.success(response)
      } else {
        Result.failure(Exception("FHIR GET failed with status $responseCode"))
      }
    } catch (e: Exception) {
      Result.failure(e)
    }
  }
}
