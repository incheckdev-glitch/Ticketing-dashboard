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
  const resource = String(payload?.resource || '').trim();
  const action = String(payload?.action || '').trim();

  console.log('[proxy] forwarding request', {
    targetUrl,
    resource,
    action
  });

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('[proxy] upstream fetch failed', {
      targetUrl,
      resource,
      action,
      error: String(error?.message || error)
    });
    return res.status(502).json({
      error: 'Failed to reach Apps Script backend',
      upstreamStatus: 502,
      targetUrl,
      details: String(error?.message || error)
    });
  }

  const raw = await upstream.text();
  const contentType = upstream.headers.get('content-type') || 'unknown';
  let data = null;
  let parsedJson = false;
  try {
    data = raw ? JSON.parse(raw) : {};
    parsedJson = true;
  } catch {
    parsedJson = false;
  }

  console.log('[proxy] upstream response', {
    targetUrl,
    resource,
    action,
    upstreamStatus: upstream.status,
    parsedJson
  });

  if (!parsedJson) {
    return res.status(upstream.status || 502).json({
      error: 'Apps Script returned invalid JSON',
      upstreamStatus: upstream.status || 502,
      targetUrl,
      contentType,
      upstreamBodySample: String(raw || '').slice(0, 1000)
    });
  }

  return res.status(upstream.status).json(data);
}
