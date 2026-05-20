const MODEL = 'gemini-3.1-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const ERROR_BODY_LIMIT = 240;

const ALLOWED_EMOTIONS = ['happy', 'sad', 'excited', 'angry', 'surprised', 'thoughtful', 'neutral'];

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    emotion: { type: 'string', enum: ALLOWED_EMOTIONS }
  },
  required: ['text', 'emotion'],
  propertyOrdering: ['text', 'emotion']
};

function parseModelOutput(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return { text: '', emotion: 'neutral' };

  const tryParse = (s) => {
    try {
      const obj = JSON.parse(s);
      if (obj && typeof obj === 'object' && typeof obj.text === 'string') return obj;
    } catch {}
    return null;
  };

  let obj = tryParse(trimmed);
  if (!obj) {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      obj = tryParse(trimmed.slice(start, end + 1));
    }
  }

  if (!obj) return { text: trimmed, emotion: 'neutral' };

  const emotion = ALLOWED_EMOTIONS.includes(obj.emotion) ? obj.emotion : 'neutral';
  return { text: String(obj.text).trim(), emotion };
}

async function chat(userMessage, systemPrompt) {
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) return { ok: false, error: 'GOOGLE_AI_STUDIO_API_KEY not set' };

  const basePrompt = systemPrompt && String(systemPrompt).trim() ? String(systemPrompt).trim() : '';

  const body = {
    contents: [{ role: 'user', parts: [{ text: String(userMessage ?? '') }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA
    }
  };
  if (basePrompt) {
    body.systemInstruction = { parts: [{ text: basePrompt }] };
  }

  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      const trimmed = errBody.length > ERROR_BODY_LIMIT ? errBody.slice(0, ERROR_BODY_LIMIT) + '…' : errBody;
      return { ok: false, error: `${res.status}: ${trimmed || res.statusText}` };
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const raw = Array.isArray(parts) ? parts.map((p) => p?.text ?? '').join('') : '';
    const { text, emotion } = parseModelOutput(raw);
    return { ok: true, text, emotion };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

module.exports = { chat };
