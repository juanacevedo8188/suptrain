exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { pdfBase64 } = JSON.parse(event.body);
    const apiKey = process.env.GEMINI_API_KEY;

    const prompt = `Este es un plan de entrenamiento de SUP (Stand Up Paddle) en PDF.
Extraé todas las semanas y días que encuentres. Respondé ÚNICAMENTE con JSON válido, sin texto adicional:

{
  "title": "nombre del plan o atleta si aparece",
  "weeks": [
    {
      "week_number": 1,
      "days": [
        {
          "day_index": 0,
          "type": "agua|tierra|gym|descanso|competencia",
          "title": "nombre corto del entrenamiento",
          "description": "descripción completa con series, tiempos, instrucciones exactas"
        }
      ]
    }
  ]
}

Reglas:
- day_index: 0=Lunes, 1=Martes, 2=Miércoles, 3=Jueves, 4=Viernes, 5=Sábado, 6=Domingo
- type: "agua" para sesiones de paddle/remo, "tierra" para running/correr, "gym" para gimnasio, "descanso" para días libres
- Incluí TODAS las instrucciones, series, tiempos y notas en description exactamente como aparecen
- Si un día tiene múltiples actividades, ponelas en description separadas por salto de línea
- Respondé SOLO con el JSON`;

    const models = ['gemini-2.5-pro', 'gemini-3-flash-preview', 'gemini-flash-latest', 'gemini-3.5-flash'];
    let data, lastStatus;

    for (const model of models) {
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
            generationConfig: { maxOutputTokens: 4096, temperature: 0, responseMimeType: 'application/json' }
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

    let text = data.candidates[0].content.parts[0].text || '';
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) text = text.substring(start, end + 1);

    const parsed = JSON.parse(text);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed)
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
