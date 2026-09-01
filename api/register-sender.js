// POST /api/register-sender - admin.html 로그인이 곧 발신자 등록이 되게 하는 서버 절차
// 1) Authorization: Bearer <supabase access token> 으로 로그인한 사람이 누구인지 확인
// 2) 그 이메일이 ADMIN_EMAIL 과 같을 때만 (사전에 권한을 준 계정)
// 3) 브라우저가 넘긴 Google refresh token 을 admin_config 에 저장 -> 발신자 등록 완료

const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return res.status(401).json({ error: "로그인이 필요합니다." });

  // 1) 이 토큰의 주인이 누구인지 Supabase 에 물어본다
  const who = await fetch(SB + "/auth/v1/user", {
    headers: { apikey: KEY, Authorization: auth },
  }).then((r) => r.json());
  const email = who && who.email;
  if (!email) return res.status(401).json({ error: "세션 확인 실패" });

  // 2) 사전에 admin 권한을 준 계정만 발신자가 될 수 있다
  if (email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: email + " 은 admin 이 아닙니다." });
  }

  const refresh_token = (req.body || {}).refresh_token;
  if (!refresh_token) return res.status(400).json({ error: "refresh token 없음" });

  // 3) 단일 행 upsert - 이 순간부터 이 계정이 발신자
  const up = await fetch(SB + "/rest/v1/admin_config", {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: "Bearer " + KEY,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ id: 1, sender_email: email, refresh_token, updated_at: new Date().toISOString() }),
  });
  if (!up.ok) {
    console.error("upsert failed", up.status, await up.text());
    return res.status(500).json({ error: "저장 실패" });
  }
  return res.status(200).json({ ok: true, sender: email });
}
