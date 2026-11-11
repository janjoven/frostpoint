import { expect, it } from "vitest";
import { keepOnScreen } from "./position";

it("keeps the panel reachable when dragged past a screen edge", () => {
  expect(keepOnScreen({ x: -50, y: 900 }, { width: 393, height: 852 }, { width: 200, height: 80 })).toEqual({ x: 8, y: 764 });
});

it("fits the expanded panel after a viewport resize", () => {
  expect(keepOnScreen({ x: 500, y: 700 }, { width: 320, height: 600 }, { width: 304, height: 160 })).toEqual({ x: 8, y: 432 });
});

it("preserves positions that are already on screen", () => {
  expect(keepOnScreen({ x: 30, y: 100 }, { width: 393, height: 852 }, { width: 200, height: 80 })).toEqual({ x: 30, y: 100 });
});
