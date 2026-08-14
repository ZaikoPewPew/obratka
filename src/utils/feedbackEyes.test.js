import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeFeedbackEyePositions,
  eyeInnerGap,
  getFeedbackEyeGeom,
  idleFeedbackEyePositions,
  idleLookShift,
  isMouseBetweenEyes,
  lerpEyes,
  shouldSqueezeEyes,
} from "./feedbackEyes.js";

const geom = getFeedbackEyeGeom();
const EPS = 1e-9;
const REST_Y = 21;

describe("getFeedbackEyeGeom", () => {
  it("rests the pair 16px from the top with an 8px inner gap", () => {
    assert.equal(geom.rest.left.x, 19.5);
    assert.equal(geom.rest.right.x, 36.5);
    assert.equal(geom.rest.left.y, REST_Y);
    assert.equal(geom.rest.right.y, REST_Y);
    assert.equal(eyeInnerGap(geom.rest, geom.rx), 8);
  });

  it("keeps eye centers inside the 8px padding box", () => {
    assert.equal(geom.minX, 12.5);
    assert.equal(geom.maxX, 43.5);
    assert.equal(geom.minY, 13);
    assert.equal(geom.maxY, 43);
  });
});

describe("computeFeedbackEyePositions", () => {
  it("returns rest when mouse is null", () => {
    const pos = computeFeedbackEyePositions(null, geom);
    assert.deepEqual(pos, geom.rest);
    assert.equal(eyeInnerGap(pos, geom.rx), 8);
  });

  it("looks far left as a rigid pair (gap stays 8)", () => {
    const pos = computeFeedbackEyePositions({ x: -1000, y: REST_Y }, geom);
    assert.ok(Math.abs(pos.left.x - 12.5) < EPS);
    assert.ok(Math.abs(pos.right.x - 29.5) < EPS);
    assert.equal(pos.left.y, REST_Y);
    assert.equal(eyeInnerGap(pos, geom.rx), 8);
  });

  it("looks far right as a rigid pair (gap stays 8)", () => {
    const pos = computeFeedbackEyePositions({ x: 2000, y: REST_Y }, geom);
    assert.ok(Math.abs(pos.left.x - 26.5) < EPS);
    assert.ok(Math.abs(pos.right.x - 43.5) < EPS);
    assert.equal(eyeInnerGap(pos, geom.rx), 8);
  });

  it("looks down to the bottom padding as a pair", () => {
    const pos = computeFeedbackEyePositions({ x: -1000, y: 2000 }, geom);
    assert.ok(Math.abs(pos.left.y - 43) < EPS);
    assert.equal(pos.left.y, pos.right.y);
    assert.equal(eyeInnerGap(pos, geom.rx), 8);
  });

  it("cannot look above the top padding", () => {
    const pos = computeFeedbackEyePositions({ x: 28, y: -1000 }, geom);
    assert.equal(pos.left.y, 13);
    assert.equal(pos.right.y, 13);
  });

  it("squeezes only when the cursor is over the button between the eyes", () => {
    const onButton = computeFeedbackEyePositions({ x: 28, y: REST_Y }, geom);
    assert.equal(
      shouldSqueezeEyes(
        { x: 28, y: REST_Y },
        geom.rest.left,
        geom.rest.right,
        geom,
      ),
      true,
    );
    assert.ok(Math.abs(eyeInnerGap(onButton, geom.rx) - 4) < EPS);
    assert.ok(Math.abs(onButton.left.x - 21.5) < EPS);
    assert.ok(Math.abs(onButton.right.x - 34.5) < EPS);

    const above = computeFeedbackEyePositions({ x: 28, y: -400 }, geom);
    assert.equal(
      shouldSqueezeEyes(
        { x: 28, y: -400 },
        geom.rest.left,
        geom.rest.right,
        geom,
      ),
      false,
    );
    assert.ok(isMouseBetweenEyes(28, geom.rest.left, geom.rest.right, geom.rx));
    assert.ok(Math.abs(eyeInnerGap(above, geom.rx) - 8) < EPS);

    const aside = computeFeedbackEyePositions({ x: 0, y: REST_Y }, geom);
    assert.ok(Math.abs(eyeInnerGap(aside, geom.rx) - 8) < EPS);
  });

  it("never places an eye center outside the padding box", () => {
    const samples = [
      { x: -400, y: -400 },
      { x: 28, y: REST_Y },
      { x: 28, y: 40 },
      { x: 800, y: 800 },
      { x: 12, y: 20 },
      { x: 44, y: 20 },
    ];
    for (const mouse of samples) {
      const pos = computeFeedbackEyePositions(mouse, geom);
      for (const eye of [pos.left, pos.right]) {
        assert.ok(eye.x >= geom.minX - EPS, `x ${eye.x} >= ${geom.minX}`);
        assert.ok(eye.x <= geom.maxX + EPS, `x ${eye.x} <= ${geom.maxX}`);
        assert.ok(eye.y >= geom.minY - EPS, `y ${eye.y} >= ${geom.minY}`);
        assert.ok(eye.y <= geom.maxY + EPS, `y ${eye.y} <= ${geom.maxY}`);
      }
      assert.ok(eyeInnerGap(pos, geom.rx) >= geom.minGap - EPS);
    }
  });
});

describe("idleLookShift", () => {
  it("holds center, then looks right, then left", () => {
    assert.equal(idleLookShift(0), 0);
    assert.equal(idleLookShift(0.4), 0);
    assert.equal(idleLookShift(0.6), 1);
    assert.equal(idleLookShift(0.76), -1);
    assert.equal(idleLookShift(0.95), 0);
  });
});

describe("idleFeedbackEyePositions", () => {
  it("keeps the 8px gap and stays in the padding box", () => {
    const lookingRight = idleFeedbackEyePositions(0.6, geom);
    assert.equal(eyeInnerGap(lookingRight, geom.rx), 8);
    assert.ok(Math.abs(lookingRight.right.x - geom.maxX) < EPS);
    assert.equal(lookingRight.left.y, REST_Y);

    const lookingLeft = idleFeedbackEyePositions(0.76, geom);
    assert.equal(eyeInnerGap(lookingLeft, geom.rx), 8);
    assert.ok(Math.abs(lookingLeft.left.x - geom.minX) < EPS);
  });
});

describe("lerpEyes", () => {
  it("interpolates between rest and a look pose", () => {
    const to = computeFeedbackEyePositions({ x: -1000, y: REST_Y }, geom);
    const mid = lerpEyes(geom.rest, to, 0.5);
    assert.ok(Math.abs(mid.left.x - (19.5 + 12.5) / 2) < EPS);
    assert.deepEqual(lerpEyes(geom.rest, to, 0), geom.rest);
    assert.deepEqual(lerpEyes(geom.rest, to, 1), to);
  });
});
