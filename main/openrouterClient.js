const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemma-4-31b-it:free';
const REFERER = 'http://localhost/desktoppet';
const APP_TITLE = 'DesktopPet';
const ERROR_BODY_LIMIT = 240;

async function chat(userMessage, systemPrompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { ok: false, error: 'OPENROUTER_API_KEY not set' };

  const messages = [];
  if (systemPrompt && String(systemPrompt).trim()) {
    messages.push({ role: 'system', content: String(systemPrompt) });
  }
  messages.push({ role: 'user', content: String(userMessage ?? '') });

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': REFERER,
        'X-Title': APP_TITLE
      },
      body: JSON.stringify({ model: MODEL, messages })
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const trimmed = body.length > ERROR_BODY_LIMIT ? body.slice(0, ERROR_BODY_LIMIT) + '…' : body;
      return { ok: false, error: `${res.status}: ${trimmed || res.statusText}` };
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim() ?? '';
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

module.exports = { chat };
