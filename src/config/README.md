# `src/config/` — константы приложения

| Файл | Экспорт | Назначение |
|------|---------|------------|
| `auth.js` | `EMAIL_AUTH_ENABLED` (= **false**) | Показывать Email OTP на `/registration` (+ `/registration/code`). Выключено, пока нет стабильного custom SMTP. |
| `home.js` | `RATING_TAB_ENABLED` (= **false**) | Вкладка «Рейтинг» (топ-50) на `/home`. Учёт reputation / жалобы не зависит от флага. Вернуть → `true`. |
| `review.js` | `REVIEW_SESSION_SECONDS` (= **60**) | Таймер просмотра на `/review` + `{seconds}` в copy intro-модалки home. **Не** claim TTL (20 min). iframe — пауза при скрытой вкладке; external — wall-clock без паузы; конец → `Timer-end.wav`. |
| `contacts.js` | `COMMUNITY_CONTACT_URL` | Telegram админа (FAB `feedback` на home, «Связаться» на `/banned`). |
| `contacts.js` | `TELEGRAM_COMMUNITY_URL` | Публичный канал (`t.me/obratka_dsgn`): account-menu «Сообщество», CTA лендинга. |

Оркестрация таймера / intro: `main.js`, [`home-screen/README.md`](../components/home-screen/README.md).  
Claim TTL: `.cursor/rules/review-claims.mdc`.  
Email OTP: [`auth-screen/README.md`](../components/auth-screen/README.md).
