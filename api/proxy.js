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

  if (String(payload?.resource || '').trim().toLowerCase() === 'workflow' && String(payload?.action || '').trim().toLowerCase() === 'validate_transition') {
    const targetResource =
      payload?.target_resource ??
      payload?.targetResource ??
      payload?.workflow_target_resource ??
      payload?.resource_target ??
      payload?.validated_resource ??
      payload?.validatedResource ??
      payload?.resource_name ??
      '';
    if (!String(targetResource || '').trim()) {
      return res.status(400).json({
        allowed: false,
        reason: 'Missing target workflow resource.',
        code: 'MISSING_TARGET_RESOURCE',
        http_status: 400
      });
    }
    payload.target_resource = String(targetResource).trim();
  }

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    return res.status(502).json({
      error: 'Failed to reach Apps Script backend.',
      details: String(error?.message || error)
    });
  }

  const raw = await upstream.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    const contentType = upstream.headers.get('content-type') || 'unknown';
    return res.status(502).json({
      error: 'Apps Script returned invalid JSON.',
      contentType,
      sample: raw.slice(0, 500)
    });
  }

  return res.status(upstream.status).json(data);
}
