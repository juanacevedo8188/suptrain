exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { pdfBase64 } = JSON.parse(event.body);
    const apiKey = process.env.GEMINI_API_KEY;

    if (!pdfBase64) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No PDF data received' }) };
    }

    const prompt = `Este es un plan de entrenamiento deportivo. Extraé todas las semanas y días.
Respondé ÚNICAMENTE con este JSON (sin texto antes ni después):

{"title":"nombre del plan","weeks":[{"week_number":1,"days":[{"day_index":0,"type":"agua","title":"título corto","description":"instrucciones completas"}]}]}

Reglas:
- day_index: 0=Lunes, 1=Martes, 2=Miércoles, 3=Jueves, 4=Viernes, 5=Sábado, 6=Domingo  
- type: agua/tierra/gym/descanso/competencia
- description: copiá las instrucciones exactas del PDF
- Si no hay actividad un día, omitilo del array
- SOLO JSON, nada más`;

    // Intentar con varios modelos que soporten PDF
    const models = [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
    ];

    let data, lastStatus, lastError;

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
                  { text: prompt }
                ]
              }],
              generationConfig: { maxOutputTokens: 8192, temperature: 0 }
            })
          }
        );
        lastStatus = response.status;
        data = await response.json();
        if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          break;
        }
        lastError = data?.error?.message || 'Unknown error';
      } catch(e) {
        lastError = e.message;
      }
    }

    if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'No model could process the PDF', detail: lastError }) 
      };
    }

    let text = data.candidates[0].content.parts[0].text || '';
    
    // Extraer JSON de la respuesta
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return { statusCode: 500, body: JSON.stringify({ error: 'No JSON found in response', raw: text.substring(0, 500) }) };
    }
    text = text.substring(start, end + 1);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch(e) {
      return { statusCode: 500, body: JSON.stringify({ error: 'JSON parse failed', raw: text.substring(0, 500) }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed)
    };

  } catch (err) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: err.message, stack: err.stack?.substring(0, 300) }) 
    };
  }
};
