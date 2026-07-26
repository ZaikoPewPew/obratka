import test from "node:test";
import assert from "node:assert/strict";

import {
  amplifyRms,
  appendFinalTranscript,
  buildWaveformLevels,
  createWebSpeechDictation,
  selectSpeechAlternative,
  smoothWaveformLevels,
  timeDomainRms,
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

test("buildWaveformLevels collapses silence to zero", () => {
  assert.deepEqual(buildWaveformLevels(new Uint8Array(24).fill(128), 12), [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
});

test("timeDomainRms is zero for a silent buffer", () => {
  assert.equal(timeDomainRms(new Uint8Array(8).fill(128)), 0);
});

test("amplifyRms lifts quiet speech above linear gain", () => {
  assert.equal(amplifyRms(0), 0);
  const quiet = amplifyRms(0.03);
  const loud = amplifyRms(0.12);
  assert.ok(quiet > 0.35);
  assert.ok(loud > quiet);
  assert.ok(loud <= 1);
});

test("smoothWaveformLevels rises faster than it falls", () => {
  const rising = smoothWaveformLevels([0, 0], [1, 1]);
  const falling = smoothWaveformLevels([1, 1], [0, 0]);
  assert.ok(rising[0] > 0.4);
  assert.ok(falling[0] > 0.7);
  assert.ok(rising[0] > 1 - falling[0]);
});

test("buildWaveformLevels keeps bars independently responsive", () => {
  const samples = new Uint8Array([
    128, 128,
    128, 128,
    128, 128,
    80, 176,
    128, 128,
    128, 128,
  ]);

  const levels = buildWaveformLevels(samples, 6);

  assert.equal(levels.length, 6);
  assert.ok(levels[3] > levels[0]);
  assert.ok(levels[3] > levels[5]);
  assert.ok(levels.every((level) => level >= 0 && level <= 1));
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

test("stop commits interim transcript into final so text is not lost", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  /** @type {FakeRecognition | null} */
  let activeRec = null;

  class FakeRecognition {
    constructor() {
      activeRec = this;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
    }

    start() {}

    stop() {}
  }

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      SpeechRecognition: FakeRecognition,
      AudioContext: class {
        createMediaStreamSource() {
          return { connect() {} };
        }
        createAnalyser() {
          return { fftSize: 256, getByteTimeDomainData() {} };
        }
        close() {
          return Promise.resolve();
        }
      },
      clearInterval,
      setInterval: () => 1,
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop() {} }],
        }),
      },
    },
  });

  try {
    const engine = createWebSpeechDictation();
    /** @type {Array<[string, string]>} */
    const updates = [];
    engine.onTranscript((finalText, interim) => {
      updates.push([finalText, interim]);
    });

    assert.equal(await engine.start(), true);
    assert.ok(activeRec?.onresult);

    activeRec.onresult({
      resultIndex: 0,
      results: [
        Object.assign(
          [{ transcript: "Как тебе кандидат", confidence: 0.8 }],
          { isFinal: false, length: 1 },
        ),
      ],
    });

    await engine.stop();

    const last = updates.at(-1);
    assert.deepEqual(last, ["Как тебе кандидат", ""]);
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
