# Мобильный UX — Обратка

Продуктовые экраны адаптивны через CSS (split brand-экраны, home, review-shell). Брейкпоинт десктоп/узкий: **768px** (`--breakpoint-min-desktop` в `styles/tokens.css`; в `@media` — литералы `768px` / `767px`).

Этот файл — ориентиры для QA и вёрстки **текущего** продукта. Карта экранов: [`SCREENS.md`](SCREENS.md).

## Область действия

- **Входит:** ширины до 767px, портрет как основной сценарий.
- **Планшет 768+:** тот же продуктовый UI, что и десктоп (нет отдельного waitlist-лейаута).
- **Не entry:** старый dual-tree `.layout-desktop` / `.layout-mobile` и waitlist-форма — **удалены** из репозитория; историческая спека ниже.

## Чеклист QA (продукт)

| Экран / сценарий | Проверить |
|------------------|-----------|
| `/referral` | поле кода, validate RPC, ошибки exhausted/invalid, handoff на auth |
| `/registration` | email → `/registration/code` (OTP + cooldown resend / назад); Telegram; Google (редирект) |
| `/registration/code` | 6 ячеек; cooldown «Повторно через N с»; ошибки identity / rate-limit |
| `/onboarding` | шаги, валидация, запись в `profiles` |
| `/home` | Чужие/Мои/Рейтинг (топ-50 по репутации, `listRatingTop`), query + Back/Forward, SWR `feed`/`feedReviewed`/`mine`/`rating` без skeleton на hit, tabbar-dock (3 tabs + submit) glass blur + `--on-dark`, entrance cascade на open/reload, intro до claim, сегменты Ждёт/Уже + Ещё/Завершенные, free-slot / pending-limit, mine gate / report, точки feedSeen + 3/3, баланс / репутация / invite; fixed «Топы в сети» слева снизу; FAB feedback |
| `/settings` | заглушка из account-menu; «На главную» |
| `/portfolio` | ввод URL, чип «На главную» (скрыт на done), нехватка баланса, done |
| `/review` | iframe / external, таймер 45 s, чип rec (заметки), выход |
| `/quiz` | квиз; микрофон в поле «Главный совет» |
| `/quiz` → done | шаги, PDF reveal |
| `/report` | листы (+ dictation), жалоба (1 тег v1, окно 6ч от done), PDF |
| `/banned` | красный mesh, «Выйти» / «Связаться»; deep link escape-proof |
| Язык | `?lang=en`, кнопка RU↔EN, aria/title |
| Тема | `data-theme="dark"`, контраст контролов |
| Safe area | notch / home indicator на iOS Safari |

Отступы и размеры — только через токены (`styles/tokens.css`), без сырых `#hex` в компонентных CSS (правило `.cursor/rules/design-tokens.mdc`).

## Подключённые стили (entry)

Из `index.html`: `tokens.css`, `base.css`, `entrance.css`, `app-modal.css`, `side-panel.css`, `iframe-shell.css`, `success-screen.css`, `home-screen.css`, `legendary-online-panel.css`, `feedback.css`, `tabs-panel.css`, `account-menu.css`, `settings-screen.css`, `ban-screen.css`, `report-screen.css`.

---

## Архив: waitlist-макет (не продукт)

Ниже — историческая спека лендинга вейтлиста (таймер «В базе N», apply-card, dual layout). **Не** описывает текущий `main.js`. Код waitlist удалён; текст оставлен для сверки со старым Figma.

<details>
<summary>Старая спека (767px waitlist)</summary>

Целевой референс для узкого экрана waitlist (`max-width: 767px`). Отступы от краёв: **16px**.

Бывшая реализация: `styles/mobile.css` + классы `mobile-*` / `.layout-mobile` — удалены.

Хедер waitlist: таймер слева, текст «В базе N», язык справа; pill `border-radius` ~500px; фон поверхности — через токены (`--color-surface-muted`), не хардкод `#f3f4f7` в новом коде.

Форма: email + CTA (бывшие `apply-card` / `email-field`).

При переносе идей из архива в продукт — сразу переводить значения в `styles/tokens.css`.

</details>
