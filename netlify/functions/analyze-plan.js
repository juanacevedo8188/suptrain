exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { pdfBase64 } = JSON.parse(event.body);
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY no está configurada en Netlify (Site settings → Environment variables)' }) };
    }
    if (!pdfBase64) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No PDF data received' }) };
    }

    const prompt = `Este es un plan de entrenamiento de SUP (stand up paddle) de alto rendimiento, típicamente exportado desde una planilla de cálculo a PDF. Extraé todas las semanas y días.
Respondé ÚNICAMENTE con este JSON (sin texto antes ni después):

{"title":"nombre del plan","weeks":[{"week_number":1,"days":[{"day_index":0,"type":"agua","title":"título corto","description":"instrucciones completas"}]}]}

Cómo leer la tabla:
- Es una tabla ancha con una fila por semana y una columna por día (Lunes a Domingo). Puede haber columnas extra tipo "Sábados Plus" / "Domingo Plus" para actividad opcional: tratalas como día_index 5 y 6.
- Algunas celdas tienen texto rotado 90° (una letra por línea, de arriba hacia abajo, ej: "M O V O G Y M S U A V E"). Leelo como una palabra normal ("MOVILIDAD O GYM SUAVE") y usalo como parte del título o descripción del día al que corresponde esa columna/bloque, no como un día aparte.
- Una celda puede estar fusionada y abarcar varias filas o aplicar a varios días de la semana: repetí su contenido en cada día al que corresponda.
- Si una columna está vacía o es solo un separador visual, omitila (no generes un día para ella).
- Texto suelto fuera de la grilla (frases motivacionales, notas al margen) no es un entrenamiento: ignoralo salvo que claramente sea instrucción para un día puntual.

Reglas de formato:
- day_index: 0=Lunes, 1=Martes, 2=Miércoles, 3=Jueves, 4=Viernes, 5=Sábado, 6=Domingo
- type: agua/tierra/gym/descanso/competencia
- description: copiá las instrucciones del PDF para ese día, ya desenredadas de la rotación/fusión de celdas
- Si no hay actividad un día, omitilo del array
- SOLO JSON, nada más`;

    // Solo modelos vigentes que soportan PDF. Flash primero: es rápido y evita
    // el timeout de 10s de Netlify; Pro queda como único fallback si flash falla.
    // (gemini-1.5-* está deprecado por Google y solo agregaba latencia con 404s)
    const models = [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
    ];

    let data, lastStatus, lastError, finishReason;

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
              generationConfig: { maxOutputTokens: 65536, temperature: 0, responseMimeType: 'application/json' }
            })
          }
        );
        lastStatus = response.status;
        data = await response.json();
        finishReason = data?.candidates?.[0]?.finishReason;
        if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text && finishReason !== 'MAX_TOKENS') {
          break;
        }
        lastError = data?.error?.message || (finishReason ? `finishReason: ${finishReason}` : 'Unknown error');
      } catch(e) {
        lastError = e.message;
      }
    }

    if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'No se pudo procesar el PDF', detail: lastError, status: lastStatus })
      };
    }

    let text = data.candidates[0].content.parts[0].text || '';

    // Con responseMimeType:'application/json' esto ya debería ser JSON puro,
    // pero dejamos la extracción como red de seguridad por si el modelo agrega texto extra.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return { statusCode: 500, body: JSON.stringify({ error: 'No se encontró JSON en la respuesta', raw: text.substring(0, 500) }) };
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
