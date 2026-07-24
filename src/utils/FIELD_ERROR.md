# Поле url-screen: ошибка и обводка

Два слоя:

1. **[`fieldError.js`](fieldError.js)** — плавное проявление текста `.url-screen__error` (opacity + blur + высота).
2. **[`urlScreenField.js`](urlScreenField.js)** — единый invalid-стейт поля: текст + `aria-invalid` + красная обводка.

Экраны не должны руками тоглить `url-screen__input-wrap--invalid` в одном месте и забывать в другом.

## `fieldError.js`

Анимация «из воздуха» для `<p class="url-screen__error">`.

| API | Роль |
|-----|------|
| `ensureFieldErrorInner(el)` | clip + `.url-screen__error-inner` |
| `setFieldErrorMessage(el, msg)` | текст во inner |
| `setFieldErrorVisible(el, visible, message?)` | open/close с transition; `hidden` после закрытия |
| `isFieldErrorVisible(el)` | есть класс `--open` |

Структура после ensure:

```html
<p class="url-screen__error">
  <span class="url-screen__error-clip">
    <span class="url-screen__error-inner">…</span>
  </span>
</p>
```

CSS: `styles/iframe-shell.css` (`.url-screen__error*`).  
Токены: `--motion-field-error-*`, `--url-screen-error-*` в `tokens.css`.  
JS duration: `getMotionFieldError()` в `motionTokens.js`.

## `urlScreenField.js`

### Text input (referral / auth email / url)

```js
setUrlScreenFieldInvalid(
  { wrap: inputWrap, input, error },
  { visible: true, message: "…" },
);
```

Делает:

1. `setFieldErrorVisible(error, …)`
2. `input` → `aria-invalid`
3. `wrap.classList.toggle("url-screen__input-wrap--invalid", visible)`

Обводка CSS (не дублировать):

```css
.url-screen__input-wrap--invalid .url-screen__input {
  box-shadow: inset 0 0 0 1px var(--color-error-border-strong);
}
```

### OTP (auth-code)

```js
setUrlScreenOtpInvalid(
  { cells, input: otpInput, error },
  { visible: true, message: "…" },
);
```

То же + `cells.classList.toggle("auth-code-screen__cells--invalid", …)`.

### Реэкспорт

`isFieldErrorVisible` реэкспортируется из `urlScreenField.js` для удобства экранов.

## Типичный `setError` на brand-экране

```js
function setError(visible, message) {
  setUrlScreenFieldInvalid({ wrap, input, error }, { visible, message });
  brandVisual.setVariant(visible ? "invalid" : "default");
}
```

Visual: [`brand-screen-visual/README.md`](../components/brand-screen-visual/README.md).

## Auth: email vs provider

| Ошибка | Outline инпута | Текст | Visual `invalid` |
|--------|----------------|-------|------------------|
| Email | да (`setUrlScreenFieldInvalid`) | да | да (OR) |
| Provider | нет | да (`setFieldErrorVisible` на providerError) | да (OR) |

## Где используется

| Экран | API |
|-------|-----|
| referral | `setUrlScreenFieldInvalid` |
| auth | email → FieldInvalid; provider → только `setFieldErrorVisible` |
| url | `setUrlScreenFieldInvalid` |
| auth-code | `setUrlScreenOtpInvalid` |
