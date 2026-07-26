# `locale-toggle`

Legacy UI переключения языка для удалённого waitlist-лейаута (глобус, мобильное меню языков).

## Статус

**Не в продуктовом entry.** Модуль лежит в репо, но:

- не монтируется из `main.js`;
- CSS `locale-toggle` **не** подключён в `index.html`;
- смена языка в продукте — `?lang=` / `data-action="lang"` + `src/i18n.js` (см. `.cursor/rules/i18n.mdc`).

Не восстанавливать waitlist dual-layout и этот переключатель без явной задачи. Историческая спека: [`mobile.md`](../../../mobile.md) § Архив.

## API (если понадобится)

`LocaleToggle.js` экспортирует фабрики кнопок / меню (`createLocaleToggleButton`, …) с `ariaLabel` и `onClick`. Строки — через `getStrings()`.

См. [`src/components/README.md`](../README.md).
