# `src/components/` — UI-компоненты

Компоненты здесь не завязаны на фреймворк: каждый модуль создаёт/обновляет DOM и навешивает нужные обработчики.

Архитектура будущих экранов: [`SCREENS.md`](../../SCREENS.md).

## Состав

### Продуктовый флоу (каркас)

- `brand-screen-shell/BrandScreenShell.js` — общий split (лево + brand visual); база для referral/auth/onboarding/url.
- `referral-screen/ReferralScreen.js` — ввод реферальной ссылки / кода.
- `auth-screen/AuthScreen.js` — вход и регистрация.
- `onboarding-screen/OnboardingScreen.js` — вопросы слева, visual справа.
- `home-screen/HomeScreen.js` — главная: очередь портфолио на ревью.

### Сессия ревью (есть)

- `url-screen/UrlScreen.js` — полноэкранный ввод ссылки на портфолио (эталон visual для brand-shell).
- `review-screen/ReviewScreen.js` — полноэкранный опросник после таймера (split + report reveal).
- `review-panel/ReviewPanel.js` — шаги опроса, слайдеры, финал с шарингом PDF.

### Прочее

- `access-modal/AccessModal.js` — модальное окно с доступом/подтверждением действий.
- `apply-card/ApplyCard.js` — основной блок формы и hero-секция.
- `cta-button/CtaButton.js` — кнопка основного целевого действия.
- `divider-or/DividerOr.js` — декоративный разделитель `OR` между блоками.
- `email-field/EmailField.js` — поле ввода email с состояниями.
- `locale-toggle/LocaleToggle.js` — переключение языков (десктоп/мобилка).
- `logo/Logo.js` — рендер логотипа с параметрами размера/классов.
- `notification/Notification.js` — всплывающие уведомления успеха/ошибки.
- `privacy-policy/PrivacyPolicyPanel.js` — панель политики конфиденциальности.
- `timer/Timer.js` — таймер обратного отсчёта.
- `waitlist-counter/WaitlistCounter.js` — счётчик подписчиков waitlist.
