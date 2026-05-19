'use client';
import React, { useState } from 'react';
import { SPELL_TYPES } from '@/constants';
import type { SpellMenuState } from '@/types';

interface Props {
  spellMenu: SpellMenuState | null;
  onClose: () => void;
  onAddSpell: (type: string) => void;
}

const MODE_LABEL: Record<string, string> = {
  path: 'Hechizo',
  line: 'Direccional',
  area: 'Área',
};

const SVG_SIZE = 200;
const CX = SVG_SIZE / 2;
const CY = SVG_SIZE / 2;
const OUTER_R = 82;
const OUTER_R_HOV = 92;
const INNER_R = 46;
const GAP_DEG = 6; // degrees of gap between sectors

function sectorPath(outerR: number, innerR: number, startAngle: number, endAngle: number): string {
  const cos = Math.cos, sin = Math.sin;
  const x1 = CX + outerR * cos(startAngle), y1 = CY + outerR * sin(startAngle);
  const x2 = CX + outerR * cos(endAngle),   y2 = CY + outerR * sin(endAngle);
  const x3 = CX + innerR * cos(endAngle),   y3 = CY + innerR * sin(endAngle);
  const x4 = CX + innerR * cos(startAngle), y4 = CY + innerR * sin(startAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M${x1} ${y1} A${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4}Z`;
}

export function SpellMenuOverlay({ spellMenu, onClose, onAddSpell }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (!spellMenu) return null;

  const modeFilter = spellMenu.mode ?? 'path';
  const spells = SPELL_TYPES.filter(s => (s.mode ?? 'path') === modeFilter);
  const N = spells.length;
  const gapRad = (GAP_DEG * Math.PI) / 180;
  const sectorAngle = (Math.PI * 2 - gapRad * N) / N;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
      onClick={onClose}
    >
      <svg
        width={SVG_SIZE}
        height={SVG_SIZE}
        style={{
          position: 'fixed',
          left: spellMenu.cx - CX,
          top: spellMenu.cy - CY,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        {spells.map(({ type, emoji, color, title }, i) => {
          const startAngle = -Math.PI / 2 + i * (sectorAngle + gapRad) + gapRad / 2;
          const endAngle = startAngle + sectorAngle;
          const midAngle = (startAngle + endAngle) / 2;
          const isHov = hovered === i;
          const oR = isHov ? OUTER_R_HOV : OUTER_R;
          const midR = (oR + INNER_R) / 2;
          const ex = CX + midR * Math.cos(midAngle);
          const ey = CY + midR * Math.sin(midAngle);

          return (
            <g
              key={type}
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onMouseDown={e => { e.stopPropagation(); onAddSpell(type); }}
            >
              <path
                d={sectorPath(oR, INNER_R, startAngle, endAngle)}
                fill={`${color}${isHov ? '44' : '1a'}`}
                stroke={color}
                strokeWidth={isHov ? 2 : 1.2}
                style={{ transition: 'all 0.12s ease' }}
              />
              {/* Glow ring on hover */}
              {isHov && (
                <path
                  d={sectorPath(oR + 4, INNER_R - 2, startAngle, endAngle)}
                  fill="none"
                  stroke={color}
                  strokeWidth={1}
                  opacity={0.25}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              <text
                x={ex} y={ey}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={isHov ? 22 : 18}
                style={{ pointerEvents: 'none', userSelect: 'none', transition: 'font-size 0.12s ease' }}
              >
                {emoji}
              </text>
            </g>
          );
        })}

        {/* Center donut label */}
        <circle cx={CX} cy={CY} r={INNER_R - 2} fill="rgba(10,13,18,0.88)" style={{ pointerEvents: 'none' }} />
        <text
          x={CX} y={CY - 7}
          textAnchor="middle"
          fill="rgba(255,210,0,0.65)"
          fontSize={8}
          fontWeight="bold"
          letterSpacing="0.08em"
          style={{ pointerEvents: 'none', userSelect: 'none', textTransform: 'uppercase' }}
        >
          {hovered !== null ? spells[hovered]?.title : MODE_LABEL[modeFilter] ?? 'Hechizo'}
        </text>
        {hovered !== null && (
          <text
            x={CX} y={CY + 7}
            textAnchor="middle"
            fill={spells[hovered]?.color ?? '#ffd200'}
            fontSize={10}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {spells[hovered]?.emoji}
          </text>
        )}
        {hovered === null && (
          <circle cx={CX} cy={CY} r={5} fill="rgba(255,210,0,0.3)" style={{ pointerEvents: 'none' }} />
        )}
      </svg>
    </div>
  );
}
