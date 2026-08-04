exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { parts } = JSON.parse(event.body);
    const apiKey = process.env.GEMINI_API_KEY;

    // Convertir formato: las imágenes vienen en base64, el texto como text
    const geminiParts = parts.map(p => {
      if (p.type === 'image') {
        return {
          inlineData: {
            mimeType: p.source.media_type,
            data: p.source.data
          }
        };
      } else {
        return { text: p.text };
      }
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: geminiParts }],
          generationConfig: { maxOutputTokens: 800, temperature: 0.1 }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify(data) };
    }

    // Extraer texto de la respuesta de Gemini y convertir al formato que espera el HTML
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: [{ type: 'text', text }] })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
