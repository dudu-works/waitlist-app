// GET /api/config - 브라우저가 쓸 수 있는 "공개용" 설정만 내려준다.
// 코드에 키를 박지 않기 위한 창구다. 여기서 내보내는 두 값은 공개돼도 되는 값이고,
// service_role 이나 GOOGLE_CLIENT_SECRET 같은 비밀은 절대 내보내지 않는다.

export default function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return res.status(500).json({
      error: "환경변수 미설정 - Vercel 에 SUPABASE_URL 과 SUPABASE_ANON_KEY 를 넣고 다시 배포하세요.",
    });
  }
  res.setHeader("Cache-Control", "public, max-age=60");
  return res.status(200).json({ url, anonKey });
}
