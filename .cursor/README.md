# Cursor — проект «Обратка»

Краткая карта для агента. Продукт и архитектура: [`PROJECT.md`](../PROJECT.md). Экраны: [`SCREENS.md`](../SCREENS.md).

## Дизайн-система

| Что | Где |
|-----|-----|
| Токены | `styles/tokens.css` |
| Правило токенов | `.cursor/rules/design-tokens.mdc` |
| Локали ru/en | `content/locales.json`, `src/i18n.js` |
| Правило i18n | `.cursor/rules/i18n.mdc` |
| Правило экранов / флоу | `.cursor/rules/screens.mdc` |
| Git remote / Pages | `.cursor/rules/git-remote.mdc` — только `ZaikoPewPew/obratka` |
| Оболочка iframe + квиз | `styles/iframe-shell.css`, `index.html`, `src/main.js` |
| Motion | `--motion-*`, `entrance.css`, `motionTokens.js`, `brandScreenTransition.js` |
| Шрифт | `@fontsource/montserrat` → `src/main.js` |

## Экраны и URL

Источник правды: [`SCREENS.md`](../SCREENS.md).

| Path | Экран |
|------|--------|
| `/referral` | Реферальный код |
| `/registration` | Email → `/registration/code` / Telegram / Google |
| `/registration/code` | 6 ячеек OTP из письма |
| `/onboarding` | Онбординг → `profiles` |
| `/home` | Главная (лента + баланс + профиль) |
| `/portfolio` | Подача своего URL |
| `/review` | Ревью: iframe + таймер |
| `/quiz` | Квиз |
| `/quiz/done` | Финал квиза |
| `/done` | Успех подачи портфолио (success / url done sync) |

| Что | Где |
|-----|-----|
| Routes / router / flow | `src/app/` |
| Brand split-shell | `src/components/brand-screen-shell/` |
| Referral / auth / onboarding / home / url / success | `src/components/*-screen/` |
| Квиз | `review-screen/` + `review-panel/` |
| Онбординг-контент | `content/onboarding.json`, `content/onboarding.md` |
| Auth API | `src/api/auth.js` (Email OTP + Google + Telegram) |
| Telegram Edge | `supabase/functions/telegram-auth/` |
| Auth UI | `auth-screen` + `auth-code-screen` |

Эталон split: `url-screen`. Соседние brand-экраны: `handoff` без анимации правого visual.  
Оркестрация: `main.js` → `go()` / `applyRoute()`.

**Не монтировать** legacy waitlist (`apply-card`, `desktop.css` / `mobile.css`) без явной задачи — entry только iframe-shell + screen-фабрики.

## Auth (шпаргалка)

| Провайдер | Не делать |
|-----------|-----------|
| Email OTP (`signInWithOtp` → `verifyOtp`) | password-форму / обязательный magic-link UI; спам resend без cooldown |
| Telegram | дублировать verify вне Edge Function; ждать склейки с email |
| Google | класть Client Secret в клиентский `.env` |

| Защита | Где |
|--------|-----|
| Automatic linking Email↔Google | Supabase Auth (из коробки); чеклист — `auth-screen/README.md` |
| Resend cooldown 60s | `--auth-code-resend-cooldown` + `auth-code-screen` |
| Identity conflict / rate-limit | `mapSupabaseAuthErrorCode` → `authIdentityConflict` / `authOtpRateLimit` |
| Manual `linkIdentity` | **не** строить — `PROJECT.md` roadmap #4 |

Новые auth-строки — ключи `auth*` / `authCode*` / `authOtp*` / `authIdentityConflict` в `locales.json` (ru+en).

## Темы и языки

- Тема: `<html data-theme="dark">` (семантика в `tokens.css`)
- Язык: `?lang=en` / кнопка RU↔EN; default `ru`

## Исследования

| Что | Где |
|-----|-----|
| Опрос: дизайнеры и портфолио (2026) | `.cursor/research/designers-portfolio-2026.md` |
| Опросы: дизайн овчарка | `.cursor/research/design-ovcharka-polls.md` |
| Каталог встраивания площадок | `content/embed-hosts.md` |
