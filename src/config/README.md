# `src/config/` — константы приложения

Не путать с корневым `src/config.js` (legacy waitlist count, не продуктовый флоу).

| Файл | Экспорт | Назначение |
|------|---------|------------|
| `review.js` | `REVIEW_SESSION_SECONDS` (= **45**) | Таймер просмотра на `/review` + `{seconds}` в copy intro-модалки home. **Не** claim TTL (20 min). |
| `contacts.js` | `COMMUNITY_CONTACT_URL` | Telegram сообщества («Контакты» в account-menu, «Связаться» на `/banned`). |

Оркестрация таймера / intro: `main.js`, [`home-screen/README.md`](../components/home-screen/README.md).  
Claim TTL: `.cursor/rules/review-claims.mdc`.
