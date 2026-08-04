exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { parts } = JSON.parse(event.body);
    const apiKey = process.env.GEMINI_API_KEY;

    const geminiParts = parts.map(p => {
      if (p.type === 'image') {
        return { inlineData: { mimeType: p.source.media_type, data: p.source.data } };
      } else {
        return { text: p.text };
      }
    });

    // Intentar con gemini-2.0-flash, fallback a gemini-pro-vision
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-pro-vision'];
    let data, lastError;

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
      data = await response.json();
      if (response.ok) break;
      lastError = data;
    }

    if (!data?.candidates?.[0]) {
      return { statusCode: 400, body: JSON.stringify(lastError || data) };
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
