import assert from "node:assert/strict";
import { formatPlural, pluralCategory } from "./plural.js";

assert.equal(pluralCategory(1, "ru"), "one");
assert.equal(pluralCategory(21, "ru"), "one");
assert.equal(pluralCategory(101, "ru"), "one");
assert.equal(pluralCategory(2, "ru"), "few");
assert.equal(pluralCategory(3, "ru"), "few");
assert.equal(pluralCategory(4, "ru"), "few");
assert.equal(pluralCategory(22, "ru"), "few");
assert.equal(pluralCategory(0, "ru"), "many");
assert.equal(pluralCategory(5, "ru"), "many");
assert.equal(pluralCategory(10, "ru"), "many");
assert.equal(pluralCategory(11, "ru"), "many");
assert.equal(pluralCategory(12, "ru"), "many");
assert.equal(pluralCategory(14, "ru"), "many");
assert.equal(pluralCategory(100, "ru"), "many");
assert.equal(pluralCategory(1000, "ru"), "many");

assert.equal(pluralCategory(1, "en"), "one");
assert.equal(pluralCategory(0, "en"), "other");
assert.equal(pluralCategory(2, "en"), "other");

const ruForms = {
  one: "У тебя {balance} уточка",
  few: "У тебя {balance} уточки",
  many: "У тебя {balance} уточек",
};

assert.equal(
  formatPlural(ruForms, 1, { balance: 1 }, "ru"),
  "У тебя 1 уточка",
);
assert.equal(
  formatPlural(ruForms, 2, { balance: 2 }, "ru"),
  "У тебя 2 уточки",
);
assert.equal(
  formatPlural(ruForms, 3, { balance: 3 }, "ru"),
  "У тебя 3 уточки",
);
assert.equal(
  formatPlural(ruForms, 10, { balance: 10 }, "ru"),
  "У тебя 10 уточек",
);
assert.equal(
  formatPlural(ruForms, 100, { balance: "100" }, "ru"),
  "У тебя 100 уточек",
);
assert.equal(
  formatPlural(ruForms, 1000, { balance: "1\u00A0000" }, "ru"),
  "У тебя 1\u00A0000 уточек",
);

console.log("plural: ok");
