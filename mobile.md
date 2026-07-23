# Мобильный UX — Обратка

Продуктовые экраны адаптивны через CSS (split brand-экраны, home, review-shell). Брейкпоинт десктоп/узкий: **768px** (`--breakpoint-min-desktop` в `styles/tokens.css`; в `@media` — литералы `768px` / `767px`).

Этот файл — ориентиры для QA и вёрстки **текущего** продукта. Карта экранов: [`SCREENS.md`](SCREENS.md).

## Область действия

- **Входит:** ширины до 767px, портрет как основной сценарий.
- **Планшет 768+:** тот же продуктовый UI, что и десктоп (нет отдельного waitlist-лейаута).
- **Не entry:** старый dual-tree `.layout-desktop` / `.layout-mobile` и waitlist-форма — код legacy, не монтируется из `index.html` / `main.js`.

## Чеклист QA (продукт)

| Экран / сценарий | Проверить |
|------------------|-----------|
| `/referral` | поле кода, submit, handoff на auth |
| `/registration` | email → `/registration/code` (OTP + cooldown resend / назад); Telegram; Google (редирект) |
| `/registration/code` | 6 ячеек; cooldown «Повторно через N с»; ошибки identity / rate-limit |
| `/onboarding` | шаги, валидация, запись в `profiles` |
| `/home` | лента, баланс, CTA review / submit |
| `/portfolio` | ввод URL, нехватка баланса, done |
| `/review` | iframe / external, таймер, выход |
| `/quiz` → done | шаги, PDF reveal |
| Язык | `?lang=en`, кнопка RU↔EN, aria/title |
| Тема | `data-theme="dark"`, контраст контролов |
| Safe area | notch / home indicator на iOS Safari |

Отступы и размеры — только через токены (`styles/tokens.css`), без сырых `#hex` в компонентных CSS (правило `.cursor/rules/design-tokens.mdc`).

## Подключённые стили (entry)

Из `index.html`: `tokens.css`, `base.css`, `entrance.css`, `iframe-shell.css`, `success-screen.css`, `home-screen.css`.

Не подключены (legacy waitlist): `desktop.css`, `mobile.css`, `apply.css`, …

---

## Архив: waitlist-макет (не продукт)

Ниже — историческая спека лендинга вейтлиста (таймер «В базе N», apply-card, dual layout). **Не** описывает текущий `main.js`. Оставлена для сверки со старым Figma / legacy CSS.

<details>
<summary>Старая спека (767px waitlist)</summary>

Целевой референс для узкого экрана waitlist (`max-width: 767px`). Отступы от краёв: **16px**.

Реализация legacy: `styles/mobile.css` + классы `mobile-*` / `.layout-mobile` — **не** в текущем `index.html`.

Хедер waitlist: таймер слева, текст «В базе N», язык справа; pill `border-radius` ~500px; фон поверхности — через токены (`--color-surface-muted`), не хардкод `#f3f4f7` в новом коде.

Форма: email + CTA; см. legacy `apply-card` / `email-field`.

При переносе идей из архива в продукт — сразу переводить значения в `styles/tokens.css`.

</details>
