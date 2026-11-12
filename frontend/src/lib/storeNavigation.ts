/** Map detail pages and checkout to their parent navigation destination. */
export function storeNavTarget(pathname: string): string {
  switch (pathname.split("/")[1]) {
    case "cart":
    case "checkout": return "/cart";
    case "orders": return "/orders";
    case "support": return "/support";
    default: return "/";
  }
}
