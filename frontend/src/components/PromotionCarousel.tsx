import { useCallback, useEffect, useRef, useState } from "react";

export type Promotion = { id: number; title: string; message: string };

export function PromotionCarousel({ promotions }: { promotions: Promotion[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [reducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [holding, setHolding] = useState(false);
  const [focused, setFocused] = useState(false);
  const multiple = promotions.length > 1;

  const show = useCallback((index: number) => {
    const element = track.current;
    if (!element) return;
    const next = (index + promotions.length) % promotions.length;
    element.scrollTo({ left: next * element.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [promotions.length]);

  useEffect(() => {
    if (!multiple || reducedMotion || holding || focused) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) show(active + 1);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [active, multiple, reducedMotion, holding, focused, show]);

  if (!promotions.length) return null;

  return (
    <section className="hero promotion-carousel" data-ui-id="promotions" aria-label="Promotions" aria-roledescription={multiple ? "carousel" : undefined}
      onFocusCapture={(event) => setFocused(event.target.matches(":focus-visible"))} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}>
      <div className="promotion-track" ref={track} tabIndex={multiple ? 0 : undefined} aria-label={multiple ? "Hold to pause promotions, or swipe to browse" : undefined}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setHolding(true);
        }}
        onPointerUp={() => setHolding(false)} onPointerCancel={() => setHolding(false)} onLostPointerCapture={() => setHolding(false)}
        onScroll={(event) => {
        const element = event.currentTarget;
        if (element.clientWidth) setActive(Math.round(element.scrollLeft / element.clientWidth));
      }}>
        {promotions.map((promotion, index) => (
          <div key={promotion.id} className="promotion-slide" role="group" aria-roledescription={multiple ? "slide" : undefined} aria-label={multiple ? `${index + 1} of ${promotions.length}` : undefined}>
            <h2 className="wrap-any">{promotion.title}</h2>
            <p className="wrap-any">{promotion.message}</p>
          </div>
        ))}
      </div>
      {multiple && <div className="promotion-controls">
        <div className="promotion-pages" role="group" aria-label="Choose promotion">
          {promotions.map((promotion, index) => <button key={promotion.id} type="button" className="promotion-page" aria-label={`Show promotion ${index + 1}: ${promotion.title}`} aria-current={active === index ? "true" : undefined} onClick={() => show(index)}><span /></button>)}
        </div>
        <span className="sr-only" aria-live={reducedMotion || holding || focused ? "polite" : "off"}>Promotion {active + 1} of {promotions.length}</span>
      </div>}
    </section>
  );
}
