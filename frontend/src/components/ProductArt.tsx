import { Cube, Cylinder, Drop, Snowflake } from "@phosphor-icons/react";
import { useState } from "react";

const PHOTOS: Record<string, string> = {
  "Ice Block": "ice-block",
  "Ice Tube": "ice-tube",
  "Crushed Ice": "crushed-ice",
  "Purified Water": "purified-h20",
};

const ICONS: Record<string, typeof Cube> = {
  "Ice Block": Cube,
  "Ice Tube": Cylinder,
  "Crushed Ice": Snowflake,
  "Purified Water": Drop,
};

export function ProductArt({ category, badge, compact }: { category: string; badge?: string; compact?: boolean }) {
  const Icon = ICONS[category] ?? Snowflake;
  const photo = PHOTOS[category];
  const [failedPhoto, setFailedPhoto] = useState("");
  const showPhoto = photo && failedPhoto !== photo;
  return (
    <div className={`product-art${compact ? " compact" : ""}`} role="img" aria-label={category}>
      {showPhoto ? <img
        className="product-photo"
        src={`/products/${photo}-${compact ? 256 : 960}.webp`}
        srcSet={`/products/${photo}-256.webp 256w, /products/${photo}-960.webp 960w`}
        sizes={compact ? "100px" : "(max-width: 720px) calc(100vw - 64px), 640px"}
        alt=""
        loading={compact ? "lazy" : "eager"}
        decoding="async"
        onError={() => setFailedPhoto(photo)}
      /> : <Icon size={compact ? 32 : 56} weight="duotone" aria-hidden="true" />}
      {badge && !compact && <span className="badge" style={{ position: "absolute", top: 8, left: 8 }}>{badge}</span>}
    </div>
  );
}
