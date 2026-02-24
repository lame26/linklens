// ================================================================
// LinkLens AI Worker
// ================================================================
// 환경변수 설정 (Workers > Settings > Variables and Secrets):
//   OPENAI_API_KEY = sk-proj-...
// ================================================================

export default {
  async fetch(request, env) {

    // CORS preflight — 모든 Origin 허용
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // POST /analyze 만 처리
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/analyze') {
      return json({ error: 'POST /analyze 로 요청하세요' }, 404);
    }

    // API 키 확인
    if (!env.OPENAI_API_KEY) {
      return json({ error: 'OPENAI_API_KEY 환경변수가 설정되지 않았습니다' }, 500);
    }

    let articleUrl;
    try {
      const body = await request.json();
      articleUrl = body.url;
    } catch {
      return json({ error: 'JSON 파싱 실패' }, 400);
    }

    if (!articleUrl) {
      return json({ error: 'url 필드가 필요합니다' }, 400);
    }

    // ── 1단계: 제목(HTML 직접) + 본문(Jina) 병렬 fetch ──
    let rawText = '';
    let fetchedTitle = '';

    const [htmlRes, jinaRes] = await Promise.allSettled([
      // 1-A: 직접 HTML fetch → og:title / <title> 추출 (Jina 오작동과 무관)
      fetch(articleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LinkLensBot/1.0)',
          'Accept': 'text/html',
        },
        redirect: 'follow',
        cf: { timeout: 8000 },
      }),
      // 1-B: Jina → 본문 텍스트 전용
      fetch('https://r.jina.ai/' + articleUrl, {
        headers: { 'Accept': 'text/plain', 'X-Return-Format': 'markdown' },
      }),
    ]);

    // 1-A 결과: og:title → twitter:title → <title> 순으로 추출
    if (htmlRes.status === 'fulfilled' && htmlRes.value.ok) {
      try {
        const html = await htmlRes.value.text();
        const ogTitle    = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
                        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
        const twTitle    = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i)
                        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["']/i);
        const plainTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i);

        fetchedTitle = (ogTitle?.[1] || twTitle?.[1] || plainTitle?.[1] || '').trim();
        // " | 사이트명" 같은 suffix 제거 (긴 쪽이 제목일 때는 유지)
        fetchedTitle = fetchedTitle.replace(/\s*[\|·—–-]\s*[^|·—–-]{2,40}$/, '').trim() || fetchedTitle;
      } catch {}
    }

    // 1-B 결과: 본문 텍스트
    if (jinaRes.status === 'fulfilled' && jinaRes.value.ok) {
      try {
        const text = await jinaRes.value.text();
        // Jina 제목은 htmlRes에서 못 가져왔을 때만 폴백으로 사용
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

    // ── 2단계: OpenAI 호출 ──
    // fetchedTitle을 프롬프트에 명시적으로 전달 → GPT가 제목을 새로 지어내지 않도록
    const titleHint = fetchedTitle
      ? `원문 제목: "${fetchedTitle}"\n\n`
      : '';

    const prompt = rawText
      ? `${titleHint}다음 기사를 분석해주세요.\n\n${rawText}`
      : `다음 URL의 기사를 분석해주세요: ${articleUrl}`;

    let aiRes;
    try {
      aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + env.OPENAI_API_KEY,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.3,
          max_tokens: 600,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `당신은 뉴스 기사 분석 전문가입니다. 반드시 아래 JSON 형식으로만 응답하세요.

{"title":"기사 제목","summary":"3~4문장 핵심 요약 (한국어)","keywords":["키워드1","키워드2","키워드3","키워드4","키워드5"],"category":"tech|economy|ai|science|politics|default 중 하나"}

title 규칙:
- 원문 제목이 제공된 경우 → 그대로 사용 (영어 제목이면 한국어로 번역)
- 원문 제목이 없는 경우 → 본문 내용을 바탕으로 핵심을 담은 제목 작성
- 제목은 클릭베이트 없이 기사 내용을 정확히 반영

category 기준: tech=IT/소프트웨어/하드웨어/스타트업, economy=경제/금융/주식/기업, ai=인공지능/머신러닝/LLM, science=과학/의학/우주/환경, politics=정치/사회/법/국제, default=그 외`,
            },
            { role: 'user', content: prompt },
          ],
        }),
      });
    } catch (e) {
      return json({ error: 'OpenAI 연결 실패: ' + e.message }, 500);
    }

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return json({ error: 'OpenAI ' + aiRes.status + ': ' + errText }, 500);
    }

    let parsed = {};
    try {
      const aiData = await aiRes.json();
      const content = aiData.choices?.[0]?.message?.content || '{}';
      parsed = JSON.parse(content);
    } catch (e) {
      return json({ error: 'OpenAI 응답 파싱 실패: ' + e.message }, 500);
    }

    return json({
      title:    parsed.title    || fetchedTitle || '',
      summary:  parsed.summary  || '',
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      category: parsed.category || 'default',
    }, 200);
  },
};

function json(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: corsHeaders() });
}

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
