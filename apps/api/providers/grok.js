const { AIProvider } = require('./ai');

class GrokProvider extends AIProvider {
  constructor(apiKey, modelName) {
    super();
    if (!apiKey) throw new Error("XAI_API_KEY is required for Grok provider");
    this.apiKey = apiKey;
    this.modelName = modelName || process.env.XAI_MODEL || 'grok-2-vision-1212';
  }

  async transcribe(audioBuffer, mimeType) {
    throw new Error('Grok audio transcription not implemented in this version.');
  }

  async chat(messages) {
    const prompt = messages
      .map(({ role, content }) => `${role === 'system' ? 'System' : role === 'assistant' ? 'Assistant' : 'Clinician'}: ${content}`)
      .join('\n\n');
    return this._callGrok(prompt, null, null, false);
  }

  async generateNote(transcript, patientContext, noteSchema, template) {
    const prompt = `You are an expert clinical AI. Given the following consultation transcript and patient context, generate a structured clinical note formatted as ${template}. 
Do not fabricate information. If information for a section is missing from the transcript, put "Not mentioned" or "None".

Patient Context:
${patientContext || 'None provided'}

Consultation Transcript:
${transcript}`;

    return await this._callGrok(prompt, null, null, true);
  }

  async extractDocument(fileBuffer, mimeType, filename, documentSchema) {
    const prompt = `Extract clinically useful facts from this medical document. 
Do NOT invent information. If uncertain, mark confidence low.
Categorize facts carefully into medication, diagnosis, lab, procedure, allergy, or other.

Your output MUST be a strict JSON object matching this schema:
{
  "document_date": "string",
  "document_type": "string",
  "facts": [
    {
      "category": "medication|diagnosis|lab|procedure|allergy|other",
      "text": "string",
      "confidence": number (0.0 to 1.0),
      "source_quote": "string"
    }
  ]
}
`;
    
    return await this._callGrok(prompt, fileBuffer, mimeType, true);
  }

  async _callGrok(promptText, fileBuffer, mimeType, requireJson) {
    const messages = [
      {
        role: "system",
        content: requireJson ? "You are a clinical AI assistant. You must respond ONLY with valid JSON." : "You are a clinical AI assistant."
      }
    ];

    if (fileBuffer && mimeType && mimeType.startsWith('image/')) {
      const base64Data = fileBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Data}`;
      messages.push({
        role: "user",
        content: [
          { type: "text", text: promptText },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } }
        ]
      });
    } else if (fileBuffer) {
      messages.push({
        role: "user",
        content: promptText + "\n\nDocument Content:\n" + fileBuffer.toString('utf-8')
      });
    } else {
      messages.push({
        role: "user",
        content: promptText
      });
    }

    const payload = {
      model: this.modelName,
      messages: messages,
      temperature: 0.1,
      stream: false
    };

    if (requireJson) {
      payload.response_format = { type: "json_object" };
    }

    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorMsg = `Grok API Error: ${res.status} ${res.statusText}`;
      try {
        const errObj = JSON.parse(errorText);
        if (errObj.error) { errorMsg += " - " + (errObj.error.message || errObj.error); } else if (false) {
          errorMsg += ` - ${errObj.error.message}`;
        }
      } catch (e) {
        errorMsg += ` - ${errorText}`;
      }
      const err = new Error(errorMsg);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    let textContent = data.choices[0].message.content;

    // Optional: strip markdown json blocks if Grok returns them
    if (requireJson) {
      textContent = textContent.replace(/^```json/i, '').replace(/```$/, '').trim();
    }

    return {
      text: textContent,
      usageMetadata: data.usage || {},
      model: this.modelName
    };
  }
}

module.exports = GrokProvider;
