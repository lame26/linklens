const rateBuckets = new Map();
// In-memory best-effort limiter: per isolate/process, resets on cold start.

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      if (!isOriginAllowed(origin, env)) {
        return new Response(null, { status: 403, headers: corsHeaders(origin, env) });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    if (!isOriginAllowed(origin, env)) {
      return json({ error: 'Origin not allowed' }, 403, request, env);
    }

    const reqUrl = new URL(request.url);
    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405, request, env);
    }

    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Authorization header is required' }, 401, request, env);
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return json({ error: 'Authorization token is required' }, 401, request, env);
    }

    const user = await verifySupabaseUser(token, env);
    if (user.error) {
      return json({ error: user.error }, user.status || 401, request, env);
    }

    const limitPerMin = Number.parseInt(env.RATE_LIMIT_PER_MIN || '30', 10);
    if (!checkRateLimit(user.data.id, Number.isFinite(limitPerMin) ? limitPerMin : 30)) {
      return json({ error: 'Rate limit exceeded' }, 429, request, env);
    }

    let articleUrl = '';
    try {
      const body = await request.json();
      articleUrl = body?.url || '';
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, request, env);
    }

    if (!articleUrl) {
      return json({ error: 'url is required' }, 400, request, env);
    }

    if (reqUrl.pathname === '/preview') {
      return handlePreview(articleUrl, request, env);
    }

    if (reqUrl.pathname === '/analyze') {
      if (!env.OPENAI_API_KEY) {
        return json({ error: 'OPENAI_API_KEY is missing' }, 500, request, env);
      }
      return handleAnalyze(articleUrl, env.OPENAI_API_KEY, request, env);
    }

    return json({ error: 'Use POST /preview or POST /analyze' }, 404, request, env);
  },
};

function checkRateLimit(userId, limitPerMinute) {
  const now = Date.now();
  const bucket = rateBuckets.get(userId);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (bucket.count >= limitPerMinute) {
    return false;
  }
  bucket.count += 1;
  return true;
}

async function verifySupabaseUser(token, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return { error: 'Worker is missing SUPABASE_URL or SUPABASE_ANON_KEY', status: 500 };
  }

  const url = `${env.SUPABASE_URL}/auth/v1/user`;
  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (e) {
    return { error: 'Auth verification failed: ' + e.message, status: 401 };
  }

  if (!res.ok) {
    return { error: 'Invalid or expired session', status: 401 };
  }

  try {
    const data = await res.json();
    if (!data?.id) return { error: 'Invalid user payload', status: 401 };
    return { data };
  } catch {
    return { error: 'Invalid auth response', status: 401 };
  }
}

async function handlePreview(articleUrl, request, env) {
  try {
    const htmlRes = await fetch(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkLensBot/1.0)',
        Accept: 'text/html',
      },
      redirect: 'follow',
      cf: { timeout: 8000 },
    });

    if (!htmlRes.ok) {
      return json({ title: '', source: getSource(articleUrl) }, 200, request, env);
    }

    const html = await htmlRes.text();
    const title = extractTitleFromHtml(html);
    return json({ title, source: getSource(articleUrl) }, 200, request, env);
  } catch {
    return json({ title: '', source: getSource(articleUrl) }, 200, request, env);
  }
}

async function handleAnalyze(articleUrl, apiKey, request, env) {
  let rawText = '';
  let fetchedTitle = '';

  const [htmlRes, jinaRes] = await Promise.allSettled([
    fetch(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkLensBot/1.0)',
        Accept: 'text/html',
      },
      redirect: 'follow',
      cf: { timeout: 8000 },
    }),
    fetch('https://r.jina.ai/' + articleUrl, {
      headers: { Accept: 'text/plain', 'X-Return-Format': 'markdown' },
    }),
  ]);

  if (htmlRes.status === 'fulfilled' && htmlRes.value.ok) {
    try {
      const html = await htmlRes.value.text();
      fetchedTitle = extractTitleFromHtml(html);
    } catch {}
  }

  if (jinaRes.status === 'fulfilled' && jinaRes.value.ok) {
    try {
      const text = await jinaRes.value.text();
      if (!fetchedTitle) {
        const m = text.match(/^Title:\s*(.+)$/m);
        if (m) fetchedTitle = m[1].trim();
      }
      rawText = text
        .replace(/^(Title|URL|Published Time|Description|Markdown Content):.*$/gm, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/#{1,6}\s+/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 3000);
    } catch {}
  }

  const titleHint = fetchedTitle ? `원문 제목: "${fetchedTitle}"\n\n` : '';
  const prompt = rawText
    ? `${titleHint}다음 기사를 분석해주세요.\n\n${rawText}`
    : `다음 URL의 기사를 분석해주세요: ${articleUrl}`;

  let aiRes;
  try {
    aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              '반드시 JSON 객체만 반환하세요. 키: title, summary, keywords, category. category는 tech|economy|ai|science|politics|default 중 하나.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });
  } catch (e) {
    return json({ error: 'OpenAI connection failed: ' + e.message }, 500, request, env);
  }

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    return json({ error: 'OpenAI ' + aiRes.status + ': ' + errText }, 500, request, env);
  }

  let parsed = {};
  try {
    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || '{}';
    parsed = JSON.parse(content);
  } catch (e) {
    return json({ error: 'OpenAI response parse failed: ' + e.message }, 500, request, env);
  }

  return json(
    {
      title: parsed.title || fetchedTitle || '',
      summary: parsed.summary || '',
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      category: parsed.category || 'default',
    },
    200,
    request,
    env,
  );
}

function extractTitleFromHtml(html) {
  const ogTitle =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const plainTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i);

  let title = (ogTitle?.[1] || plainTitle?.[1] || '').trim();
  title = title.replace(/\s*[\|\-·:]\s*[^|\-·:]{2,40}$/, '').trim() || title;
  return title;
}

function getSource(articleUrl) {
  try {
    return new URL(articleUrl).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function json(body, status = 200, request, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(request?.headers.get('Origin') || '', env),
  });
}

function parseAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin, env) {
  const allowed = parseAllowedOrigins(env);
  if (!allowed.length) return true;
  return !!origin && allowed.includes(origin);
}

function resolveAllowOrigin(origin, env) {
  const allowed = parseAllowedOrigins(env);
  if (!allowed.length) return '*';
  if (origin && allowed.includes(origin)) return origin;
  return '';
}

function corsHeaders(origin, env) {
  const allowOrigin = resolveAllowOrigin(origin, env);
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (allowOrigin) headers['Access-Control-Allow-Origin'] = allowOrigin;
  if (allowOrigin !== '*') headers.Vary = 'Origin';
  return headers;
}
