import { describe, expect, it } from "vitest";

import type { RevealEntry, RevealTarget } from "./reveal-core";
import {
  createRevealController,
  INVIEW_ATTR,
  REVEAL_OBSERVER_OPTIONS,
} from "./reveal-core";

class FakeElement implements RevealTarget {
  readonly attrs = new Map<string, string>();
  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }
  hasAttribute(name: string): boolean {
    return this.attrs.has(name);
  }
}

function setup() {
  const observed = new Set<FakeElement>();
  let fire: (entries: readonly RevealEntry<FakeElement>[]) => void = () =>
    undefined;
  let options: unknown;
  let disconnected = false;

  const controller = createRevealController<FakeElement>((callback, opts) => {
    fire = callback;
    options = opts;
    return {
      observe: (el) => observed.add(el),
      unobserve: (el) => observed.delete(el),
      disconnect: () => {
        disconnected = true;
        observed.clear();
      },
    };
  });

  return {
    controller,
    observed,
    fire: (entries: readonly RevealEntry<FakeElement>[]) => fire(entries),
    options: () => options,
    disconnected: () => disconnected,
  };
}

describe("createRevealController", () => {
  it("creates a single observer with the shared options", () => {
    const { options } = setup();
    expect(options()).toEqual(REVEAL_OBSERVER_OPTIONS);
  });

  it("marks an element in view once and stops observing it", () => {
    const { controller, observed, fire } = setup();
    const el = new FakeElement();
    controller.track([el]);
    expect(observed.has(el)).toBe(true);

    fire([{ target: el, isIntersecting: true }]);
    expect(el.attrs.get(INVIEW_ATTR)).toBe("true");
    expect(observed.has(el)).toBe(false);
  });

  it("ignores entries that are not intersecting", () => {
    const { controller, observed, fire } = setup();
    const el = new FakeElement();
    controller.track([el]);
    fire([{ target: el, isIntersecting: false }]);
    expect(el.hasAttribute(INVIEW_ATTR)).toBe(false);
    expect(observed.has(el)).toBe(true);
  });

  it("does not track an element twice or one already revealed", () => {
    const { controller, observed } = setup();
    const fresh = new FakeElement();
    const done = new FakeElement();
    done.setAttribute(INVIEW_ATTR, "true");

    controller.track([fresh, fresh, done]);
    controller.track([fresh]);
    expect([...observed]).toEqual([fresh]);
  });

  it("disconnects the observer", () => {
    const { controller, disconnected } = setup();
    controller.disconnect();
    expect(disconnected()).toBe(true);
  });
});
