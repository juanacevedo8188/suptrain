exports.handler = async (event) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (event.httpMethod === 'GET' && event.queryStringParameters?.list === 'true') {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const d = await r.json();
    return { statusCode: 200, headers: {'Content-Type':'application/json'}, body: JSON.stringify((d.models||[]).map(m=>m.name)) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { parts } = JSON.parse(event.body);

    const geminiParts = parts.map(p => {
      if (p.type === 'image') {
        return { inlineData: { mimeType: p.source.media_type, data: p.source.data } };
      } else {
        return { text: p.text };
      }
    });

    const models = [
      'gemini-2.5-pro',
      'gemini-3-flash-preview',
      'gemini-flash-latest',
      'gemini-pro-latest',
      'gemini-3.5-flash',
      'gemini-3.6-flash',
    ];

    let data, lastStatus, usedModel;
    for (const model of models) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: geminiParts }],
            generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0,
              responseMimeType: 'application/json'
            }
          })
        }
      );
      lastStatus = response.status;
      data = await response.json();
      if (response.ok && data?.candidates?.[0]) { usedModel = model; break; }
    }

    if (!data?.candidates?.[0]) {
      return { statusCode: lastStatus || 400, body: JSON.stringify(data) };
    }

    const text = data.candidates[0].content.parts[0].text || '';
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: [{ type: 'text', text }], model: usedModel })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
