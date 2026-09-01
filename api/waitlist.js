// POST /api/waitlist - 등록의 본체는 DB 저장, 메일은 그 결과 알림 두 통
// 1) Supabase waitlist 테이블에 insert (중복이면 409 -> duplicate)
// 2) admin_config 의 발신자(refresh token)로 Gmail API 발송:
//    - 등록자에게 "등록 완료"
//    - admin 에게 "신규 등록"

const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

async function sbFetch(path, opts = {}) {
  return fetch(SB + path, {
    ...opts,
    headers: {
      apikey: KEY,
      Authorization: "Bearer " + KEY,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
}

async function accessToken(refresh_token) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token,
      grant_type: "refresh_token",
    }),
  }).then((x) => x.json());
  if (!r.access_token) throw new Error("token refresh failed");
  return r.access_token;
}

async function sendMail(token, to, subject, body) {
  const subjectB64 = "=?UTF-8?B?" + Buffer.from(subject, "utf-8").toString("base64") + "?=";
  const mime =
    "To: " + to + "\r\n" +
    "Subject: " + subjectB64 + "\r\n" +
    "Content-Type: text/plain; charset=utf-8\r\n\r\n" + body;
  const raw = Buffer.from(mime, "utf-8").toString("base64url");
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  }).then((x) => x.json());
  if (!r.id) throw new Error("send failed");
  return r.id;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const email = ((req.body || {}).email || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "올바른 이메일이 아니에요." });
  }

  // 1) DB 저장이 본체
  const ins = await sbFetch("/rest/v1/waitlist", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ email }),
  });
  if (ins.status === 409) return res.status(200).json({ ok: true, duplicate: true });
  if (!ins.ok) {
    console.error("insert failed", ins.status, await ins.text());
    return res.status(500).json({ error: "저장에 실패했어요." });
  }

  // 2) 발신자(admin) 확인 - admin.html 로그인으로 등록된 refresh token
  const cfgRes = await sbFetch("/rest/v1/admin_config?id=eq.1&select=sender_email,refresh_token");
  const cfg = (await cfgRes.json())[0];
  if (!cfg || !cfg.refresh_token) {
    return res.status(200).json({ ok: true, saved: true, notified: false, reason: "발신자 미등록 - admin.html에서 로그인 필요" });
  }

  // 3) 메일 두 통
  try {
    const token = await accessToken(cfg.refresh_token);
    const userMailId = await sendMail(
      token, email,
      "[등록 완료] 대기 명단에 올랐습니다",
      "등록해 주셔서 고맙습니다.\n\n오픈하는 날 이 주소로 가장 먼저 알려드리겠습니다.\n\n- " + cfg.sender_email
    );
    const adminMailId = await sendMail(
      token, cfg.sender_email,
      "[waitlist] 신규 등록: " + email,
      "대기 명단에 새 등록이 들어왔습니다.\n\n이메일: " + email + "\n저장: waitlist 테이블에 기록됨"
    );
    return res.status(200).json({ ok: true, saved: true, notified: true, user_mail: userMailId, admin_mail: adminMailId });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ ok: true, saved: true, notified: false, reason: String(e).slice(0, 120) });
  }
}
