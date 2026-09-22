import { useEffect, useRef } from 'react';
import type { NozzleConfig } from '../physics/types';

interface Props {
  nozzle: NozzleConfig;
  width?: number;
  height?: number;
}

/**
 * A schematic 2D profile of the nozzle — converging section, throat, diverging section — matching
 * the original desktop app's nozzle preview widget (uilib/widgets/nozzlePreviewWidget.py) in
 * spirit. `NozzleConfig` has no chamber/case diameter of its own (that lives on the grains, which
 * the nozzle doesn't reference), so the convergent section's inlet radius is a fixed multiple of
 * the throat rather than the real case size — this is a proportional schematic, not a scaled
 * technical drawing.
 */
export function NozzlePreview({ nozzle, width = 260, height = 140 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    const throatR = nozzle.throat / 2;
    const exitR = nozzle.exit / 2;
    if (throatR <= 0) {
      ctx.fillStyle = 'rgba(169,173,186,0.7)';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Set a throat diameter to preview', width / 2, height / 2);
      return;
    }

    const inletR = Math.max(exitR, throatR * 2.2);
    const convAngleRad = (Math.max(nozzle.convAngle, 1) * Math.PI) / 180;
    const divAngleRad = (Math.max(nozzle.divAngle, 1) * Math.PI) / 180;
    const convLen = (inletR - throatR) / Math.tan(convAngleRad);
    const divLen = Math.max(exitR - throatR, 0) / Math.tan(divAngleRad);
    const throatLen = Math.max(nozzle.throatLength, throatR * 0.15);

    const totalLen = convLen + throatLen + divLen;
    const maxR = Math.max(inletR, exitR);
    const margin = 16;
    const scale = Math.min((width - 2 * margin) / totalLen, (height - 2 * margin) / (2 * maxR));
    const cx = margin;
    const cy = height / 2;

    const px = (x: number) => cx + x * scale;
    const pyTop = (r: number) => cy - r * scale;
    const pyBot = (r: number) => cy + r * scale;

    const xs = [0, convLen, convLen + throatLen, totalLen];
    const rs = [inletR, throatR, throatR, exitR];

    ctx.fillStyle = 'rgba(124, 109, 242, 0.18)';
    ctx.strokeStyle = '#7c6df2';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(px(xs[0]), pyTop(rs[0]));
    for (let i = 1; i < xs.length; i++) ctx.lineTo(px(xs[i]), pyTop(rs[i]));
    for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(px(xs[i]), pyBot(rs[i]));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Centerline
    ctx.strokeStyle = 'rgba(169,173,186,0.4)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(px(0), cy);
    ctx.lineTo(px(totalLen), cy);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [nozzle, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ background: 'var(--bg)', borderRadius: 8 }} />;
}
