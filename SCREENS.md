# Экраны приложения — архитектура

Карта будущих экранов «Обратки» и того, как они стыкуются с уже существующим `url-screen` / iframe-сессией.

Статус: **каркас и контракты**. Реализация UI — отдельными задачами; stub-модули экспортируют API, но не монтируются из `main.js`.

## Продуктовый флоу

```text
referral-screen  →  auth-screen  →  onboarding-screen  →  home-screen
                                                              │
                                                              ▼
                                                     url-screen (есть)
                                                              │
                                                              ▼
                                                     iframe-shell + review (есть)
```

| Шаг | Экран | Смысл |
|-----|--------|--------|
| 1 | `referral-screen` | Ввод реферальной ссылки / кода приглашения |
| 2 | `auth-screen` | Создание аккаунта, вход, регистрация |
| 3 | `onboarding-screen` | Вопросы профиля + навигация по шагам |
| 4 | `home-screen` | Главная: очередь портфолио на ревью |
| — | `url-screen` | Уже есть: «Ссылка на портфолио» перед сессией |
| — | `iframe-shell` | Уже есть: таймер + портфолио |
| — | `review-screen` + `review-panel` | Уже есть: опрос после таймера, финал с PDF |

Вход с `?ref=` может префиллить referral-экран. Повторный визит с сессией пропускает шаги 1–3 и открывает `home-screen` (логика в `src/app/flow.js`).

## Визуальная база

Экраны **referral / auth / onboarding** строятся на том же split-layout, что и страница «Ссылка на портфолио» (`UrlScreen`):

| Зона | Классы / роль | Поведение |
|------|----------------|-----------|
| Корень | `brand-screen` (сейчас в DOM: `url-screen`) | Полноэкранный слой, open/close + transition |
| Левая | `brand-screen__form-pane` | **Меняется** по экрану: поле / форма auth / вопросы |
| Правая | `brand-screen__visual` | **Общая**: mesh-wash, noise, бренд-марк |

`url-screen` остаётся рабочим эталоном. При реализации новых экранов сначала вынести общий каркас в `brand-screen-shell`, затем перевести `UrlScreen` на него (без смены внешнего вида).

`home-screen` — **другой** лейаут: список/очередь, без обязательного правого visual-pane.

## Дерево файлов

```text
SCREENS.md                          ← этот документ

src/app/
  README.md
  flow.js                           ← порядок экранов, skip-правила
  session.js                        ← заглушка сессии пользователя

src/components/
  brand-screen-shell/
    README.md
    BrandScreenShell.js             ← общий split + visual
  referral-screen/
    README.md
    ReferralScreen.js
  auth-screen/
    README.md
    AuthScreen.js
  onboarding-screen/
    README.md
    OnboardingScreen.js
  home-screen/
    README.md
    HomeScreen.js
  url-screen/UrlScreen.js           ← эталон (есть)
  review-screen/                    ← есть: split + report reveal
    README.md
    ReviewScreen.js
  review-panel/                     ← есть: шаги опроса + done
    README.md
    ReviewPanel.js

styles/
  brand-screen.css                  ← общие стили split-экранов (вынести из iframe-shell)
  home-screen.css                   ← стили главной / очереди
  iframe-shell.css                  ← оболочка сессии + пока ещё url-screen

content/
  onboarding.json                   ← шаги/вопросы онбординга
  onboarding.md                     ← описание схемы JSON
  locales.json                      ← UI-строки (ключи ниже)
```

## Контракты компонентов

Паттерн как у `createUrlScreen`: фабрика возвращает `{ root, open, close }` (и доп. методы при необходимости). Монтаж — из `main.js` / `flow.js`, не из HTML-слотов.

### `createBrandScreenShell(opts)`

Общий каркас. Экраны кладут контент в левую панель.

```js
// opts (направление)
{
  labelledById: string,           // id заголовка для aria-labelledby
  content: HTMLElement,           // левая панель
  // visual — внутренний, общий
}

// return
{ root, open, close, setContent(el), getVisualRoot() }
```

Токены и классы — префикс `brand-screen` / `--brand-screen-*`. Пока в CSS живут как `--url-screen-*`; при выносе завести алиасы или переименовать с миграцией `UrlScreen`.

### `createReferralScreen({ onSubmit })`

- Визуал: brand-shell.
- Левая: заголовок + поле ссылки/кода (+ ошибка валидации).
- `onSubmit(referral: string)` после нормализации.

### `createAuthScreen({ onSuccess, mode? })`

- Визуал: brand-shell.
- Левая: табы/режимы «Вход» | «Регистрация» (или единая форма с переключением).
- Поля: email, пароль; при регистрации — подтверждение / имя по продукту.
- `onSuccess(session)` → `src/app/session.js`.
- Сеть: будущий `src/api/auth.js` (Supabase Auth или аналог).

### `createOnboardingScreen({ onComplete })`

- Визуал: brand-shell, **правая часть как у UrlScreen**.
- Левая: вместо инпута — вопрос текущего шага + навигация (назад / далее), прогресс.
- Данные шагов: `content/onboarding.json`; подписи кнопок — `locales.json`.
- Паттерн шагов можно опираться на `ReviewPanel` (прогресс, required, next/back).
- `onComplete(answers)`.

### `createHomeScreen({ onOpenPortfolio, onAddPortfolio? })`

- Список портфолио на ревью (карточки/строки: имя, превью/favicon, статус).
- Не обязан использовать brand-shell.
- Данные: будущий `src/api/portfolios.js` (+ локальный mock на этапе UI).
- Клик по элементу → существующий путь `url-screen` или сразу сессия iframe (решить при реализации).

## Стили

| Файл | Когда |
|------|--------|
| `styles/brand-screen.css` | Вынести общие правила `.url-screen` → `.brand-screen`; подключить в `index.html` |
| `styles/iframe-shell.css` | Оставить оболочку сессии; url-screen-блоки удалить после миграции |
| `styles/home-screen.css` | Список на главной |
| `styles/tokens.css` | Новые семантики только через токены; для brand — алиасы от текущих `--url-screen-*` |

Правила: `.cursor/rules/design-tokens.mdc`.

### Motion на url-screen (эталон)

Staggered reveal при `.url-screen--open`: visual → title → field → platforms/avatars → brand.  
Токены `--motion-*` (алиасы `--url-screen-reveal-*`). Тот же паттерн стоит перенести на referral / auth / onboarding через `brand-screen-shell`.

## i18n

Все видимые строки — ключи в `content/locales.json` (ru + en). Черновой набор:

| Префикс | Назначение |
|---------|------------|
| `referral*` | Заголовок, placeholder, submit, invalid |
| `auth*` | Вход/регистрация, поля, ошибки, CTA |
| `onboarding*` | Прогресс, next/back, ошибки шага |
| `home*` | Заголовок очереди, пустое состояние, CTA «добавить» |
| `review*` / `report*` | Опрос ревью, done-экран, тексты PDF-отчёта |

Контент вопросов онбординга — в `content/onboarding.json` (как структура ревью), не хардкод в JS.

## App-слой

- `src/app/flow.js` — какой экран показать, переходы `next` / `back`, skip при наличии сессии/флагов онбординга.
- `src/app/session.js` — `getSession` / `setSession` / `clearSession` (localStorage или Supabase); stub без реального API.

Пока `main.js` открывает `urlScreen` и после таймера — `reviewScreen` / `reviewPanel`. Подключение флоу 1–4 — когда готовы экраны referral → home.

## API (будущее)

| Модуль | Роль |
|--------|------|
| `src/api/auth.js` | signUp / signIn / signOut |
| `src/api/referrals.js` | validate / redeem кода |
| `src/api/portfolios.js` | список очереди на ревью |
| `src/api/onboarding.js` | опционально: сохранить ответы на бэкенд |

См. заготовки в `src/api/README.md`.

## Порядок реализации (рекомендуемый)

1. Вынести `BrandScreenShell` + CSS из `UrlScreen` (визуальный паритет).
2. `ReferralScreen` на shell.
3. `AuthScreen` + `api/auth` stub.
4. `OnboardingScreen` + `content/onboarding.json`.
5. `HomeScreen` + mock списка.
6. Склеить в `flow.js`, оставить текущую iframe-сессию как следующий шаг с home.

## Связанные документы

- [`STRUCTURE.md`](STRUCTURE.md) — карта репозитория
- [`PROJECT.md`](PROJECT.md) — общий контекст продукта
- [`content/onboarding.md`](content/onboarding.md) — схема вопросов
- [`src/components/brand-screen-shell/README.md`](src/components/brand-screen-shell/README.md) — контракт shell
- [`.cursor/README.md`](.cursor/README.md) — карта для агента
