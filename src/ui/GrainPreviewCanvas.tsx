import { useEffect, useRef } from 'react';
import type { Segment } from '../physics/contours';
import { contourAtLevel, regDistToLevel, type GrainPreview } from '../physics/preview';

interface Props {
  preview: GrainPreview | null;
  /**
   * Real-unit (m) regression distance to render burn state at, e.g. from the time scrubber. Omit
   * for the static (fully unburned) view. Requires `diameter`.
   */
  regDist?: number;
  /** Real-unit (m) grain diameter — required together with `regDist`, to convert it into the
   * preview's own normalized units (see `regDistToLevel`). */
  diameter?: number;
  size?: number;
  /** false shows just the current core shape with no regression contours ("Face" tab). */
  showContours?: boolean;
}

function drawSegments(ctx: CanvasRenderingContext2D, segments: Segment[], dim: number, size: number, style: string, width: number) {
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  const scale = size / dim;
  ctx.beginPath();
  for (const seg of segments) {
    // The background raster below renders source pixel r as covering canvas span
    // [r*scale, (r+1)*scale) — i.e. its center sits at (r+0.5)*scale — but marching squares'
    // coordinates (from contours.ts) treat grid point r as a point sample sitting exactly at r,
    // not at the center of a cell. Drawing segments at `coord*scale` directly put every contour
    // half a source pixel above and to the left of where the raster actually places that same
    // point, a systematic bias visible as the whole contour sitting slightly up-and-left of the
    // background it's supposed to trace. The +0.5 re-aligns the two conventions.
    ctx.moveTo((seg.a[1] + 1.5) * scale, (seg.a[0] + 1.5) * scale);
    ctx.lineTo((seg.b[1] + 1.5) * scale, (seg.b[0] + 1.5) * scale);
  }
  ctx.stroke();
}

export function GrainPreviewCanvas({ preview, regDist, diameter, size = 220, showContours = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);

    if (!preview) {
      ctx.fillStyle = 'var(--muted-text, #888)';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No preview', size / 2, size / 2);
      return;
    }

    // Only defined when the caller wants a burn-state snapshot (the time scrubber) rather than the
    // grain's static unburned shape (the property editor's Face/Regression tabs).
    const level = regDist !== undefined && diameter ? regDistToLevel(preview, regDist, diameter) : undefined;

    const { dim, coreMap, inDomain, regressionMap } = preview;
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      const srcRow = Math.min(dim - 1, Math.floor((y / size) * dim));
      for (let x = 0; x < size; x++) {
        const srcCol = Math.min(dim - 1, Math.floor((x / size) * dim));
        const srcIdx = srcRow * dim + srcCol;
        const destIdx = (y * size + x) * 4;
        let r = 255;
        let g = 255;
        let b = 255;
        if (inDomain[srcIdx] === 1) {
          const isOriginalCore = coreMap[srcIdx] === 0;
          // Burned-away propellant gets its own char color, distinct from the original core void,
          // so it's clear how much has actually been consumed vs. how much was always open —
          // matches the original desktop app's per-timestep erosion (resultsWidget.py's
          // updateGrainTab thresholds the same regression map directly) rather than only drawing a
          // single moving contour line over an otherwise-static unburned picture.
          const isBurnedAway = !isOriginalCore && level !== undefined && regressionMap[srcIdx] <= level;
          if (isOriginalCore) {
            r = 250;
            g = 250;
            b = 250;
          } else if (isBurnedAway) {
            r = 52;
            g = 46;
            b = 42;
          } else {
            r = 194;
            g = 148;
            b = 88;
          }
        } else {
          r = 24;
          g = 24;
          b = 27;
        }
        image.data[destIdx] = r;
        image.data[destIdx + 1] = g;
        image.data[destIdx + 2] = b;
        image.data[destIdx + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);

    if (showContours) {
      // A rainbow sweep across the contour set (one hue per regression depth) rather than a single
      // flat color — matches the original desktop app's multi-colored regression preview, and
      // incidentally makes it easy to see at a glance which contours are earliest/latest in the burn.
      const n = preview.contours.length;
      preview.contours.forEach((contour, i) => {
        const hue = n <= 1 ? 0 : (i / (n - 1)) * 300; // red -> violet, skipping the red/red wrap
        drawSegments(ctx, contour, dim, size, `hsla(${hue}, 85%, 60%, 0.8)`, 1.25);
      });
    }

    if (level !== undefined) {
      // A precise edge on top of the erosion fill above. Note this can legitimately draw nothing
      // right at full burnout — see contourAtLevel's doc comment — which is fine since the erosion
      // fill (not this line) is what actually carries "how much is burned" once that happens.
      const highlight = contourAtLevel(preview, level);
      drawSegments(ctx, highlight, dim, size, '#1d4ed8', 2);
    }
  }, [preview, regDist, diameter, size, showContours]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: 8, background: '#fff' }} />;
}
