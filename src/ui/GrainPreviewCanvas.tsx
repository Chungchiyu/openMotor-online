import { useEffect, useRef } from 'react';
import type { Segment } from '../physics/contours';
import { contourAtFraction, type GrainPreview } from '../physics/preview';

interface Props {
  preview: GrainPreview | null;
  /** 0-1 fraction of the grain's max regression depth to highlight, e.g. from the time scrubber. */
  highlightFraction?: number;
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
    ctx.moveTo(seg.a[1] * scale, seg.a[0] * scale);
    ctx.lineTo(seg.b[1] * scale, seg.b[0] * scale);
  }
  ctx.stroke();
}

export function GrainPreviewCanvas({ preview, highlightFraction, size = 220, showContours = true }: Props) {
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

    const { dim, coreMap, inDomain } = preview;
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
          const isPropellant = coreMap[srcIdx] !== 0;
          r = isPropellant ? 194 : 250;
          g = isPropellant ? 148 : 250;
          b = isPropellant ? 88 : 250;
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

    if (highlightFraction !== undefined) {
      const highlight = contourAtFraction(preview, highlightFraction);
      drawSegments(ctx, highlight, dim, size, '#1d4ed8', 2);
    }
  }, [preview, highlightFraction, size, showContours]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: 8, background: '#fff' }} />;
}
