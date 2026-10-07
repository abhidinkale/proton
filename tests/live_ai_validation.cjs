const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

(async () => {
  const filePath = path.join(__dirname, '../apps/web/test_doc_ambiguous.png');
  if (!fs.existsSync(filePath)) {
    console.error("Test document not found!");
    process.exit(1);
  }
  const fileBuffer = fs.readFileSync(filePath);
  
  const boundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
  const payload = Buffer.concat([
    Buffer.from('--' + boundary + '\r\n'),
    Buffer.from('Content-Disposition: form-data; name="documents"; filename="test_doc_ambiguous.png"\r\n'),
    Buffer.from('Content-Type: image/png\r\n\r\n'),
    fileBuffer,
    Buffer.from('\r\n--' + boundary + '--\r\n')
  ]);

  console.log("=== STARTING LIVE AI VALIDATION ===");
  const startTime = Date.now();
  
  try {
    const res = await fetch('http://127.0.0.1:3002/api/extract-documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary
      },
      body: payload
    });
    
    const latency = Date.now() - startTime;
    console.log("-> Request Latency: " + latency + "ms");
    console.log("-> HTTP Status: " + res.status);
    
    const json = await res.json();
    
    if (res.status !== 200) {
      console.error("-> AI Backend Failed:", json);
      process.exit(1);
    }
    
    console.log("-> Success! Returned JSON:");
    console.log(JSON.stringify(json, null, 2));
    
    // Strict schema check
    if (!json.extractions || !json.extractions.length) throw new Error("Missing extractions array.");
    const ext = json.extractions[0];
    if (!ext.document_type) throw new Error("Missing document_type.");
    if (!ext.facts || !ext.facts.length) throw new Error("Missing facts array.");
    
    for (const fact of ext.facts) {
      if (!fact.category || !fact.text || fact.confidence === undefined || !fact.source_quote) {
        throw new Error("Fact missing required fields: " + JSON.stringify(fact));
      }
    }
    
    console.log("-> Schema Validation: PASS");
    console.log("=== LIVE AI VALIDATION SUCCESS ===");
    
  } catch (err) {
    console.error("=== LIVE AI VALIDATION FAILED ===");
    console.error(err);
    process.exit(1);
  }
})();
