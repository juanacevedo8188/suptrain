exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // Si viene con ?list=true, devolver lista de modelos disponibles
  if (event.queryStringParameters?.list === 'true') {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const d = await r.json();
    return { statusCode: 200, headers: {'Content-Type':'application/json'}, body: JSON.stringify(d) };
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
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro',
      'gemini-1.5-pro-latest',
    ];

    let data, lastStatus;
    for (const model of models) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: geminiParts }],
            generationConfig: { maxOutputTokens: 800, temperature: 0.1 }
          })
        }
      );
      lastStatus = response.status;
      data = await response.json();
      if (response.ok && data?.candidates?.[0]) break;
    }

    if (!data?.candidates?.[0]) {
      return { statusCode: lastStatus || 400, body: JSON.stringify(data) };
    }

    const text = data.candidates[0].content.parts[0].text || '';
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: [{ type: 'text', text }] })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
