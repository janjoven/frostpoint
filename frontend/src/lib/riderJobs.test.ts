import { expect, it } from "vitest";
import { canStartDelivery, groupRiderJobs } from "./riderJobs";

it("only allows starting orders confirmed or prepared by the shop", () => {
  expect(canStartDelivery("Order Placed")).toBe(false);
  expect(canStartDelivery("Order Confirmed")).toBe(true);
  expect(canStartDelivery("Preparing")).toBe(true);
  expect(canStartDelivery("Out for Delivery")).toBe(false);
  expect(canStartDelivery("Delivered Successfully")).toBe(false);
});

it("prioritizes deliveries on the road and separates completed jobs", () => {
  const jobs = [{ id: 1, status: "Preparing" }, { id: 2, status: "Delivered Successfully" }, { id: 3, status: "Out for Delivery" }, { id: 4, status: "Cancelled" }, { id: 5, status: "Order Confirmed" }];
  const grouped = groupRiderJobs(jobs);
  expect(grouped.active.map((job) => job.id)).toEqual([3, 1, 5]);
  expect(grouped.completed.map((job) => job.id)).toEqual([2]);
  expect(jobs[0].id).toBe(1);
});
