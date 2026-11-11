export type Position = { x: number; y: number };

export function keepOnScreen(point: Position, viewport: { width: number; height: number }, panel: { width: number; height: number }): Position {
  return {
    x: Math.max(8, Math.min(point.x, viewport.width - panel.width - 8)),
    y: Math.max(8, Math.min(point.y, viewport.height - panel.height - 8)),
  };
}
