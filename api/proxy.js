async function postWithRedirects(url, body, maxRedirects = 3) {
  let currentUrl = url;
  let redirects = 0;

  while (redirects <= maxRedirects) {
    const response = await fetch(currentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body,
      redirect: 'manual'
    });

    const status = Number(response.status || 0);
    const isRedirect = [301, 302, 303, 307, 308].includes(status);
    const location = response.headers.get('location');

    if (!isRedirect || !location) {
      return response;
    }

    currentUrl = new URL(location, currentUrl).toString();
    redirects += 1;
  }

  throw new Error(`Too many redirects while contacting upstream service (${maxRedirects}).`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const targetUrl = String(process.env.APPS_SCRIPT_WEBAPP_URL || '').trim();
  if (!targetUrl) {
    return res.status(500).json({
      error: 'Server is missing APPS_SCRIPT_WEBAPP_URL.'
    });
  }

  const payload =
    req.body && typeof req.body === 'object'
      ? req.body
      : (() => {
          try {
            return typeof req.body === 'string' && req.body.trim()
              ? JSON.parse(req.body)
              : {};
          } catch {
            return req.body ?? {};
          }
        })();

  const requestBody = JSON.stringify(payload);

  let upstream;
  try {
    upstream = await postWithRedirects(targetUrl, requestBody, 3);
  } catch (error) {
    return res.status(502).json({
      error: 'Failed to reach Apps Script backend.',
      details: String(error?.message || error)
    });
  }

  const raw = await upstream.text();
  const parseLenientJson = value => {
    const normalized = String(value || '').trim();
    if (!normalized) return {};

    try {
      return JSON.parse(normalized);
    } catch {}

    const firstBrace = normalized.indexOf('{');
    const lastBrace = normalized.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(normalized.slice(firstBrace, lastBrace + 1));
      } catch {}
    }

    if (normalized.includes('=') && !normalized.includes('<')) {
      try {
        const params = new URLSearchParams(normalized);
        if (Array.from(params.keys()).length) {
          const mapped = {};
          params.forEach((entryValue, entryKey) => {
            mapped[entryKey] = entryValue;
          });
          return mapped;
        }
      } catch {}
    }

    if (/^[A-Za-z0-9_.-]+\s*:\s*.+$/m.test(normalized) && !normalized.includes('<')) {
      const mapped = {};
      normalized.split(/\r?\n/).forEach(line => {
        const idx = line.indexOf(':');
        if (idx <= 0) return;
        const key = line.slice(0, idx).trim();
        const entryValue = line.slice(idx + 1).trim();
        if (!key) return;
        mapped[key] = entryValue;
      });
      if (Object.keys(mapped).length) return mapped;
    }

    return null;
  };

  const data = parseLenientJson(raw);
  if (data === null) {
    const contentType = upstream.headers.get('content-type') || 'unknown';
    const looksLikeHtml = /<!doctype html|<html[\s>]/i.test(String(raw || '').trim());
    const nonJsonError = {
      error: 'Apps Script returned invalid JSON.',
      contentType,
      sample: String(raw || '').slice(0, 500)
    };

    if (!upstream.ok || looksLikeHtml) {
      return res.status(502).json(nonJsonError);
    }

    return res.status(upstream.status).json({
      ok: true,
      message: String(raw || '').trim() || 'Apps Script returned a non-JSON success response.'
    });
  }

  return res.status(upstream.status).json(data);
}
