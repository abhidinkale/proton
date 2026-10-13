const GeminiProvider = require('./gemini');
const GrokProvider = require('./grok');
const DeepSeekProvider = require('./deepseek');
const MedGemmaProvider = require('./medgemma');
const DemoProvider = require('./demo');

function getProvider() {
  const explicitProvider = (process.env.PROTON_AI_PROVIDER || '').toLowerCase();
  const defaultMode = explicitProvider === 'medgemma' ? 'local' : 'demo';
  const mode = (process.env.PROTON_AI_MODE || defaultMode).toLowerCase();
  if (mode === 'demo') {
    return new DemoProvider();
  }

  const providerName = (process.env.PROTON_AI_PROVIDER || 'gemini').toLowerCase();
  
  if (providerName === 'medgemma') {
    const baseUrl = process.env.MEDGEMMA_BASE_URL || 'http://localhost:8000/v1';
    const model = process.env.MEDGEMMA_MODEL || 'mlx-community/medgemma-1.5-4b-it-4bit';
    return new MedGemmaProvider(baseUrl, model);
  } else if (providerName === 'deepseek') {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY is not configured on server for DeepSeek provider.");
    }
    return new DeepSeekProvider(process.env.DEEPSEEK_API_KEY, process.env.DEEPSEEK_MODEL);
  } else if (providerName === 'grok') {
    if (!process.env.XAI_API_KEY) {
      throw new Error("XAI_API_KEY is not configured on server for Grok provider.");
    }
    return new GrokProvider(process.env.XAI_API_KEY, process.env.XAI_MODEL);
  } else if (providerName === 'gemini') {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured on server for Gemini provider.");
    }
    const geminiModel = process.env.GEMINI_MODEL || process.env.PROTON_AI_MODEL || 'gemini-3.8-flash';
    return new GeminiProvider(process.env.GEMINI_API_KEY, geminiModel);
  } else if (providerName === 'demo') {
    return new DemoProvider();
  } else {
    throw new Error(`Unknown PROTON_AI_PROVIDER: ${providerName}`);
  }
}

function getProviderStatus() {
  const explicitProvider = (process.env.PROTON_AI_PROVIDER || '').toLowerCase();
  const defaultMode = explicitProvider === 'medgemma' ? 'local' : 'demo';
  const mode = (process.env.PROTON_AI_MODE || defaultMode).toLowerCase();
  const providerName = (process.env.PROTON_AI_PROVIDER || (mode === 'demo' ? 'demo' : 'gemini')).toLowerCase();
  
  let configured = false;
  let model = 'none';

  if (mode === 'demo' || providerName === 'demo') {
    configured = true;
    model = 'demo-mock-model';
  } else if (providerName === 'medgemma') {
    configured = true;
    model = process.env.MEDGEMMA_MODEL || 'mlx-community/medgemma-1.5-4b-it-4bit';
  } else if (providerName === 'deepseek') {
    configured = Boolean(process.env.DEEPSEEK_API_KEY);
    model = process.env.DEEPSEEK_MODEL || 'deepseek-flash';
  } else if (providerName === 'gemini') {
    configured = Boolean(process.env.GEMINI_API_KEY);
    model = process.env.GEMINI_MODEL || process.env.PROTON_AI_MODEL || 'gemini-3.8-flash';
  } else if (providerName === 'grok') {
    configured = Boolean(process.env.XAI_API_KEY);
    model = process.env.XAI_MODEL || 'grok-2-vision-1212';
  }

  return {
    mode: (mode === 'demo' && providerName === 'demo') ? 'demo' : (providerName === 'medgemma' ? (process.env.PROTON_AI_MODE || 'local') : mode),
    provider: providerName,
    model,
    configured
  };
}

module.exports = { getProvider, getProviderStatus };
