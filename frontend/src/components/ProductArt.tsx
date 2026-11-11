import { Cube, Cylinder, Drop, Snowflake } from "@phosphor-icons/react";

const ICONS: Record<string, typeof Cube> = {
  "Ice Block": Cube,
  "Ice Tube": Cylinder,
  "Crushed Ice": Snowflake,
  "Purified Water": Drop,
};

export function ProductArt({ category, badge, compact }: { category: string; badge?: string; compact?: boolean }) {
  const Icon = ICONS[category] ?? Snowflake;
  return (
    <div className={`product-art${compact ? " compact" : ""}`} role="img" aria-label={category}>
      <Icon size={compact ? 32 : 56} weight="duotone" aria-hidden="true" />
      {badge && !compact && <span className="badge" style={{ position: "absolute", top: 8, left: 8 }}>{badge}</span>}
    </div>
  );
}
