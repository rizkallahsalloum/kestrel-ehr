"use client";

import { useEffect, useState } from "react";

export type ContrastPair = {
  label: string;
  fg: string;
  bg: string;
  /** "text" needs 4.5:1, "large" and "ui" need 3:1 (WCAG 2.2 AA); "decorative" has no minimum. */
  kind: "text" | "large" | "ui" | "decorative";
};

const THRESHOLD = { text: 4.5, large: 3, ui: 3, decorative: 1 } as const;

function toRgb(color: string): [number, number, number] | null {
  const match = color.match(/rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
  if (match) return [Number(match[1]), Number(match[2]), Number(match[3])];
  // color-mix() resolves to `color(srgb r g b)` with 0–1 channels.
  const srgb = color.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/);
  if (srgb) return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255];
  return null;
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Resolves a CSS color (including var() references) to rgb() through the browser. */
function resolve(probe: HTMLElement, value: string): [number, number, number] | null {
  probe.style.color = value;
  return toRgb(getComputedStyle(probe).color);
}

export function ContrastTable({ pairs }: { pairs: ContrastPair[] }) {
  const [ratios, setRatios] = useState<(number | null)[]>([]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const probe = document.createElement("span");
      document.body.appendChild(probe);
      setRatios(
        pairs.map(({ fg, bg }) => {
          const a = resolve(probe, fg);
          const b = resolve(probe, bg);
          if (!a || !b) return null;
          const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
          return (hi + 0.05) / (lo + 0.05);
        }),
      );
      probe.remove();
    });
    return () => cancelAnimationFrame(frame);
  }, [pairs]);

  return (
    <table className="w-full text-left text-body-sm">
      <thead>
        <tr className="border-b border-line-subtle">
          <th scope="col" className="label-caps py-2 pr-4">Pair</th>
          <th scope="col" className="label-caps py-2 pr-4">Sample</th>
          <th scope="col" className="label-caps py-2 pr-4">Needs</th>
          <th scope="col" className="label-caps py-2">Ratio</th>
        </tr>
      </thead>
      <tbody>
        {pairs.map((pair, i) => {
          const ratio = ratios[i];
          const pass = ratio != null && ratio >= THRESHOLD[pair.kind];
          return (
            <tr key={pair.label} className="border-b border-line-subtle last:border-0">
              <td className="py-2 pr-4">{pair.label}</td>
              <td className="py-2 pr-4">
                <span
                  data-contrast-sample={pair.kind}
                  className="inline-block rounded-sm px-2 py-0.5 font-medium"
                  style={{ color: pair.fg, background: pair.bg, outline: pair.kind === "ui" ? `var(--border-width-emphasis) solid ${pair.fg}` : undefined }}
                >
                  Aa 123
                </span>
              </td>
              <td className="py-2 pr-4 font-mono text-label-sm">
                {pair.kind === "decorative" ? "none (decorative)" : `${THRESHOLD[pair.kind]}:1 ${pair.kind}`}
              </td>
              <td className="py-2">
                {ratio == null ? (
                  <span className="text-ink-muted">measuring</span>
                ) : (
                  <span
                    className={`rounded-pill px-2 py-0.5 font-mono text-label-sm ${pass ? "bg-ok-subtle text-ok" : "bg-warning-subtle text-warning"}`}
                    data-testid="contrast-ratio"
                    data-pass={pass}
                  >
                    {ratio.toFixed(2)}:1 {pass ? "pass" : "fail"}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
