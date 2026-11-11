export function canStartDelivery(status: string) {
  return status === "Order Confirmed" || status === "Preparing";
}

export function groupRiderJobs<T extends { status: string }>(jobs: T[]) {
  return {
    active: jobs.filter((job) => job.status !== "Delivered Successfully" && job.status !== "Cancelled")
      .sort((a, b) => Number(b.status === "Out for Delivery") - Number(a.status === "Out for Delivery")),
    completed: jobs.filter((job) => job.status === "Delivered Successfully"),
  };
}
