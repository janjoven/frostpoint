import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "../store";

/** Mutation that toasts errors/success and refreshes the listed query keys. */
export function useAct<V = void, R = unknown>(fn: (v: V) => Promise<R>, opts: { invalidate?: string[]; success?: string | ((r: R) => string) } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      opts.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (opts.success) toast(typeof opts.success === "function" ? opts.success(r) : opts.success);
    },
    onError: (e) => toast((e as Error).message),
  });
}
