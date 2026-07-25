import test from "node:test";
import assert from "node:assert/strict";

import {
  appendFinalTranscript,
  createWebSpeechDictation,
  selectSpeechAlternative,
} from "./createWebSpeechDictation.js";

test("selectSpeechAlternative chooses the highest-confidence hypothesis", () => {
  const result = [
    { transcript: "  тест голоса ", confidence: 0.42 },
    { transcript: "текст голоса", confidence: 0.91 },
    { transcript: "тест колоса", confidence: 0.6 },
  ];

  assert.deepEqual(selectSpeechAlternative(result), {
    transcript: "текст голоса",
    confidence: 0.91,
  });
});

test("selectSpeechAlternative falls back to the first hypothesis", () => {
  const result = [
    { transcript: "  первый   вариант " },
    { transcript: "второй вариант", confidence: 0.99 },
  ];

  assert.deepEqual(selectSpeechAlternative(result), {
    transcript: "первый вариант",
    confidence: null,
  });
});

test("selectSpeechAlternative treats zero confidence as unavailable", () => {
  assert.deepEqual(
    selectSpeechAlternative([{ transcript: "финальный текст", confidence: 0 }]),
    {
      transcript: "финальный текст",
      confidence: null,
    },
  );
});

test("appendFinalTranscript removes a repeated restart overlap", () => {
  assert.equal(
    appendFinalTranscript(
      "Сначала проверим главный экран",
      "главный экран выглядит аккуратно",
    ),
    "Сначала проверим главный экран выглядит аккуратно",
  );
});

test("appendFinalTranscript keeps intentional single-word repetition", () => {
  assert.equal(
    appendFinalTranscript("Очень", "очень выразительный экран"),
    "Очень очень выразительный экран",
  );
});

test("appendFinalTranscript ignores a fully duplicated fragment", () => {
  assert.equal(
    appendFinalTranscript("Хорошая типографика", "хорошая типографика"),
    "Хорошая типографика",
  );
});

test("stopping during microphone permission prevents a late recognition start", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  let resolveStream;
  let recognitionStarts = 0;
  let trackStops = 0;

  class FakeRecognition {
    start() {
      recognitionStarts += 1;
    }

    stop() {}
  }

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      SpeechRecognition: FakeRecognition,
      clearInterval,
      setInterval,
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: () =>
          new Promise((resolve) => {
            resolveStream = resolve;
          }),
      },
    },
  });

  try {
    const engine = createWebSpeechDictation();
    const starting = engine.start();
    await engine.stop();
    resolveStream({
      getTracks: () => [
        {
          stop: () => {
            trackStops += 1;
          },
        },
      ],
    });

    assert.equal(await starting, false);
    assert.equal(recognitionStarts, 0);
    assert.equal(trackStops, 1);
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      delete globalThis.window;
    }
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    } else {
      delete globalThis.navigator;
    }
  }
});
