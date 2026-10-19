// Retrieve only cover metadata. Media content never passes through this function.
const OWNER_USER_ID = "35bd70b7-54c4-4238-b583-e4fbcd2fea52";
const ALLOWED_ORIGINS = new Set([
  "https://joestarzhang.cn",
  "https://www.joestarzhang.cn",
  "https://kurimi-hutao.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function getPublishableKey(): string {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    return typeof keys.default === "string" ? keys.default : "";
  } catch {
    return "";
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed" }, 403, headers);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, headers);

  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer [^.\s]+\.[^.\s]+\.[^.\s]+$/.test(authorization)) {
    return json({ error: "Sign in as the blog owner" }, 401, headers);
  }
  const apiUrl = Deno.env.get("SUPABASE_URL");
  const apiKey = getPublishableKey();
  if (!apiUrl || !apiKey) return json({ error: "Auth configuration missing" }, 503, headers);
  try {
    const authResponse = await fetch(`${apiUrl}/auth/v1/user`, {
      headers: { authorization, apikey: apiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!authResponse.ok) return json({ error: "Authentication failed" }, 401, headers);
    const user = await authResponse.json();
    if (user?.id !== OWNER_USER_ID) return json({ error: "Owner permission required" }, 403, headers);
  } catch {
    return json({ error: "Authentication temporarily unavailable" }, 503, headers);
  }

  let bvid: string | undefined;
  try {
    const input = await request.json();
    bvid = input?.bvid;
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }
  if (typeof bvid !== "string" || !/^BV[a-zA-Z0-9]{10}$/.test(bvid)) {
    return json({ error: "Invalid Bilibili BV number" }, 400, headers);
  }

  try {
    const upstream = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; personal-blog-metadata/1.0)",
        Referer: "https://www.bilibili.com/",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) return json({ error: "Bilibili metadata unavailable" }, 502, headers);
    const result = await upstream.json();
    if (result?.code !== 0 || result?.data?.bvid !== bvid) {
      return json({ error: "Bilibili video not accessible" }, 502, headers);
    }
    const picture = new URL(result.data.pic);
    if ((picture.protocol !== "https:" && picture.protocol !== "http:") ||
        !/^i\d{1,2}\.hdslb\.com$/.test(picture.hostname) ||
        !/^\/bfs\/archive\/[a-zA-Z0-9._@-]+$/.test(picture.pathname)) {
      return json({ error: "Unexpected Bilibili cover address" }, 502, headers);
    }
    picture.protocol = "https:";
    return json({
      bvid,
      coverUrl: picture.toString(),
      durationSeconds: Number.isFinite(result.data.duration) ? result.data.duration : null,
    }, 200, headers);
  } catch {
    return json({ error: "Bilibili metadata request failed" }, 502, headers);
  }
});
