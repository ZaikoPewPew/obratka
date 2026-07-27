import assert from "node:assert/strict";
import { fixHangingPrepositions } from "./hangingPrepositions.js";

assert.equal(
  fixHangingPrepositions("ревью от признанных"),
  "ревью от\u00A0признанных",
);
assert.equal(
  fixHangingPrepositions("оскорбления и оффтоп авторы"),
  "оскорбления и\u00A0оффтоп авторы",
);
assert.equal(
  fixHangingPrepositions("пожаловаться на твою обратку"),
  "пожаловаться на\u00A0твою обратку",
);
assert.equal(
  fixHangingPrepositions("плавает и крякает как утка"),
  "плавает и\u00A0крякает как\u00A0утка",
);
assert.equal(
  fixHangingPrepositions("Репутация в нашей обратке"),
  "Репутация в\u00A0нашей обратке",
);
assert.equal(
  fixHangingPrepositions("без коротких"),
  "без\u00A0коротких",
);
assert.equal(fixHangingPrepositions(""), "");
assert.equal(fixHangingPrepositions("Ясн"), "Ясн");

console.log("hangingPrepositions: ok");
