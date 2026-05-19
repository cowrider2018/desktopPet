const ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MODEL = 'whisper-large-v3-turbo';

function extFromMime(mimeType) {
  const m = String(mimeType || '').toLowerCase();
  if (m.includes('webm')) return 'webm';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('wav')) return 'wav';
  if (m.includes('mp4') || m.includes('m4a')) return 'm4a';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  return 'webm';
}

async function transcribe(audioBuffer, mimeType) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ok: false, error: 'GROQ_API_KEY missing in .env' };
  if (!audioBuffer || !audioBuffer.length) return { ok: false, error: 'empty audio' };

  const ext = extFromMime(mimeType);
  const blob = new Blob([audioBuffer], { type: mimeType || 'audio/webm' });
  const form = new FormData();
  form.append('file', blob, `phrase.${ext}`);
  form.append('model', MODEL);
  form.append('response_format', 'json');
  form.append('temperature', '0');
  form.append('prompt', '請使用繁體中文。');

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    });
  } catch (err) {
    return { ok: false, error: `network: ${err?.message || err}` };
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.text();
      if (body) detail += `: ${body.slice(0, 300)}`;
    } catch {}
    return { ok: false, error: detail };
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    return { ok: false, error: `parse: ${err?.message || err}` };
  }

  const text = typeof data?.text === 'string' ? data.text.trim() : '';
  return { ok: true, text };
}

module.exports = { transcribe };
