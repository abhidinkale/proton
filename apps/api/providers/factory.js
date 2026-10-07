const GeminiProvider = require('./gemini');
const GrokProvider = require('./grok');
const DemoProvider = require('./demo');

function getProvider() {
  const mode = process.env.PROTON_AI_MODE || 'demo';
  if (mode === 'demo') {
    return new DemoProvider();
  }

  const providerName = process.env.PROTON_AI_PROVIDER || 'gemini';
  
  if (providerName === 'grok') {
    return new GrokProvider(process.env.XAI_API_KEY, process.env.XAI_MODEL);
  } else if (providerName === 'gemini') {
    return new GeminiProvider(process.env.GEMINI_API_KEY);
  } else {
    throw new Error(`Unknown PROTON_AI_PROVIDER: ${providerName}`);
  }
}

module.exports = { getProvider };
