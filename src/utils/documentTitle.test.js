import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ALL_ROUTE_IDS } from "../app/routes.js";
import { ROUTE_META_TITLE_KEYS, titleForRoute } from "./documentTitle.js";

const locales = JSON.parse(
  readFileSync(new URL("../../content/locales.json", import.meta.url), "utf8"),
);

describe("documentTitle", () => {
  it("maps every route id to a locale key", () => {
    for (const id of ALL_ROUTE_IDS) {
      assert.ok(ROUTE_META_TITLE_KEYS[id], `missing title key for ${id}`);
    }
  });

  it("has ru and en strings for every route title key", () => {
    for (const key of Object.values(ROUTE_META_TITLE_KEYS)) {
      assert.ok(locales.locales.ru[key], `ru missing ${key}`);
      assert.ok(locales.locales.en[key], `en missing ${key}`);
    }
  });

  it("resolves a route title and falls back to metaTitle", () => {
    assert.equal(
      titleForRoute("auth", locales.locales.ru),
      "Обратка — Авторизация",
    );
    assert.equal(
      titleForRoute("url", locales.locales.ru),
      "Обратка — Подача портфолио",
    );
    assert.equal(titleForRoute("unknown", { metaTitle: "Обратка" }), "Обратка");
    assert.equal(titleForRoute(null, { metaTitle: "Обратка" }), "Обратка");
  });
});
