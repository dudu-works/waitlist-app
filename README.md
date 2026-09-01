# waitlist-app - 랜딩 + 가입 알림 (Supabase + Vercel + Gmail API)

빈 랜딩 페이지에서 waitlist 를 받고, 등록되면 메일이 두 통 나간다.

```
[유저]  index.html 폼 --------> /api/waitlist --> Supabase waitlist 테이블 (본체)
                                          +--> 유저에게 "등록 완료" 메일
                                          +--> admin 에게 "신규 등록" 메일
[admin] admin.html 구글 로그인(gmail.send 동의) --> /api/register-sender
        --> admin_config 에 refresh token 저장 = 이 계정이 "발신자"가 된다
```

- 발신자 등록 = admin.html 에서 OAuth 로그인 한 번. GCP 콘솔 수동 절차 없음.
- admin 판정 = 서버 환경변수 ADMIN_EMAIL 과 로그인 이메일 대조.
- 열쇠는 전부 서버(환경변수 + DB)에만. 브라우저에는 공개 가능한 anon key 뿐.

## 환경변수 (Vercel)

SUPABASE_URL / SUPABASE_SERVICE_KEY / GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / ADMIN_EMAIL

## 사전 설정

1. Supabase: waitlist(email unique) + admin_config 테이블, Google provider(ID/Secret)
2. GCP Web 클라이언트 redirect URI: https://<프로젝트ref>.supabase.co/auth/v1/callback
3. Supabase URL Configuration: Site URL 과 Redirect URLs 에 배포 도메인
