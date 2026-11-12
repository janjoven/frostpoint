import { expect, it } from "vitest";
import { storeNavTarget } from "./storeNavigation";

it.each([
  ["/", "/"],
  ["/product/1", "/"],
  ["/cart", "/cart"],
  ["/checkout", "/cart"],
  ["/checkout/", "/cart"],
  ["/orders", "/orders"],
  ["/orders/1035", "/orders"],
  ["/support", "/support"],
])("selects the correct customer navigation item for %s", (path, expected) => {
  expect(storeNavTarget(path)).toBe(expected);
});
