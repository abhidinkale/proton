/**
 * Proton Healthcare Operations OS — Configuration & Secret Hardening Module
 * 
 * Enforces:
 * - Production configuration fails closed on missing or weak secrets.
 * - Clear separation between development/synthetic and production environments.
 * - Credentials and API keys remain strictly server-side and masked in logs.
 */

class ConfigurationError extends Error {
  constructor(message, missingKeys = []) {
    super(message);
    this.name = 'ConfigurationError';
    this.missingKeys = missingKeys;
  }
}

const DEFAULT_DEV_SECRETS = {
  PROTON_AUTH_SECRET: 'proton-private-beta-auth-secret-change-in-prod-2026',
  INTERNAL_AGENT_SECRET: 'internal-secret-token'
};

/**
 * Validates platform configuration.
 * INVARIANT: In production, missing or trivial secrets strictly fail closed.
 */
function validateConfig(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';
  const missing = [];
  const weak = [];

  const authSecret = env.PROTON_AUTH_SECRET;
  if (!authSecret) {
    if (isProduction) missing.push('PROTON_AUTH_SECRET');
  } else if (isProduction && (authSecret === DEFAULT_DEV_SECRETS.PROTON_AUTH_SECRET || authSecret.length < 32)) {
    weak.push('PROTON_AUTH_SECRET (must be at least 32 characters and not dev default)');
  }

  const internalSecret = env.INTERNAL_AGENT_SECRET;
  if (!internalSecret) {
    if (isProduction) missing.push('INTERNAL_AGENT_SECRET');
  } else if (isProduction && (internalSecret === DEFAULT_DEV_SECRETS.INTERNAL_AGENT_SECRET || internalSecret.length < 16)) {
    weak.push('INTERNAL_AGENT_SECRET (must not be dev default)');
  }

  if (isProduction && env.PROTON_DB_DRIVER === 'postgres' && !env.DATABASE_URL) {
    missing.push('DATABASE_URL (required when PROTON_DB_DRIVER=postgres)');
  }

  if (isProduction) {
    if (env.PROTON_FHIR_PERSISTENCE_MODE === 'synthetic') {
      weak.push('PROTON_FHIR_PERSISTENCE_MODE (mock/synthetic FHIR store is strictly prohibited in production)');
    }
    if (env.PROTON_FHIR_PERSISTENCE_MODE === 'medplum') {
      if (!env.MEDPLUM_BASE_URL) missing.push('MEDPLUM_BASE_URL');
      if (!env.MEDPLUM_TOKEN) missing.push('MEDPLUM_TOKEN');
    }
  }

  if (isProduction && (missing.length > 0 || weak.length > 0)) {
    const errorDetails = [
      missing.length > 0 ? `Missing required production secrets: ${missing.join(', ')}` : '',
      weak.length > 0 ? `Insecure/weak configuration in production: ${weak.join(', ')}` : ''
    ].filter(Boolean).join(' | ');

    throw new ConfigurationError(
      `FATAL: Production configuration failed closed. ${errorDetails}`,
      [...missing, ...weak]
    );
  }

  return {
    isProduction,
    dbDriver: env.PROTON_DB_DRIVER === 'postgres' ? 'postgres' : 'sqlite',
    fhirPersistenceMode: env.PROTON_FHIR_PERSISTENCE_MODE || 'in_memory',
    authSecret: authSecret || DEFAULT_DEV_SECRETS.PROTON_AUTH_SECRET,
    internalSecret: internalSecret || DEFAULT_DEV_SECRETS.INTERNAL_AGENT_SECRET
  };
}

/**
 * Sanitizes an object or environment map for safe logging (masks passwords, secrets, tokens).
 */
function sanitizeConfigForLogging(configObj = process.env) {
  const sanitized = {};
  const sensitivePatterns = /secret|token|key|password|auth|bearer|credential|database_url|dsn|connection/i;

  for (const [k, v] of Object.entries(configObj)) {
    if (typeof v !== 'string') {
      sanitized[k] = v;
      continue;
    }
    if (sensitivePatterns.test(k)) {
      if (v.includes('://')) {
        // Redact user:password from URLs
        try {
          const parsed = new URL(v);
          if (parsed.password) {
            parsed.password = '********';
          }
          sanitized[k] = parsed.toString();
        } catch {
          sanitized[k] = '********';
        }
      } else {
        sanitized[k] = v.length > 16 ? `${v.slice(0, 3)}***${v.slice(-3)}` : '********';
      }
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

module.exports = {
  validateConfig,
  sanitizeConfigForLogging,
  ConfigurationError,
  DEFAULT_DEV_SECRETS
};
