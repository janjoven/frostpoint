import { CheckCircle, Package, Receipt, Truck } from "@phosphor-icons/react";
import { STATUS_FLOW, STEP_LABEL, fmtDayTime } from "../lib/format";

const STEP_ICON = [Receipt, CheckCircle, Package, Truck, CheckCircle];

/** Five-step order progress with the day and time each step was reached. */
export function OrderSteps({ order, compact = false }: { order: { status: string; events: { status: string; at: string }[] }; compact?: boolean }) {
  const at = STATUS_FLOW.indexOf(order.status as (typeof STATUS_FLOW)[number]);
  return (
    <ol className={`steps${compact ? " steps-compact" : ""}`} aria-label={`Order progress: ${STEP_LABEL[order.status] ?? order.status}`}>
      {STATUS_FLOW.map((s, i) => {
        const iso = order.events.find((e) => e.status === s)?.at;
        const when = fmtDayTime(iso);
        const Icon = STEP_ICON[i];
        const cls = [i <= at ? "done" : "", i === at ? "now" : "", i < at && !when ? "skipped" : ""].join(" ");
        return (
          <li key={s} className={cls} aria-current={i === at ? "step" : undefined}>
            <span className="node"><Icon size={16} weight="fill" aria-hidden="true" /></span>
            <span>{STEP_LABEL[s]}</span>
            {!compact && <time dateTime={iso}>
              {when ? <>{when.day}<br />{when.time}</> : <span aria-hidden="true">&nbsp;<br />&nbsp;</span>}
            </time>}
          </li>
        );
      })}
    </ol>
  );
}
