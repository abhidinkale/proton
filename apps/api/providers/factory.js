const GeminiProvider = require('./gemini');
const GrokProvider = require('./grok');
const DemoProvider = require('./demo');

function getProvider() {
  const mode = (process.env.PROTON_AI_MODE || 'demo').toLowerCase();
  if (mode === 'demo') {
    return new DemoProvider();
  }

  const providerName = (process.env.PROTON_AI_PROVIDER || 'gemini').toLowerCase();
  
  if (providerName === 'grok') {
    if (!process.env.XAI_API_KEY) {
      throw new Error("XAI_API_KEY is not configured on server for Grok provider.");
    }
    return new GrokProvider(process.env.XAI_API_KEY, process.env.XAI_MODEL);
  } else if (providerName === 'gemini') {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured on server for Gemini provider.");
    }
    return new GeminiProvider(process.env.GEMINI_API_KEY, process.env.PROTON_AI_MODEL);
  } else if (providerName === 'demo') {
    return new DemoProvider();
  } else {
    throw new Error(`Unknown PROTON_AI_PROVIDER: ${providerName}`);
  }
}

function getProviderStatus() {
  const mode = (process.env.PROTON_AI_MODE || 'demo').toLowerCase();
  const providerName = (process.env.PROTON_AI_PROVIDER || (mode === 'demo' ? 'demo' : 'gemini')).toLowerCase();
  
  let configured = false;
  let model = 'none';

  if (mode === 'demo' || providerName === 'demo') {
    configured = true;
    model = 'demo-mock-model';
  } else if (providerName === 'gemini') {
    configured = Boolean(process.env.GEMINI_API_KEY);
    model = process.env.PROTON_AI_MODEL || 'gemini-3.5-flash';
  } else if (providerName === 'grok') {
    configured = Boolean(process.env.XAI_API_KEY);
    model = process.env.XAI_MODEL || 'grok-2-vision-1212';
  }

  return {
    mode,
    provider: providerName,
    model,
    configured
  };
}

module.exports = { getProvider, getProviderStatus };
