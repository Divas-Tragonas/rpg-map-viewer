'use client';
import React from 'react';
import Sprite from '@/components/Sprite';
import { T, U } from '@/theme';
import { CONDITIONS_BY_ID } from '@/constants';
import type { LibEnemy } from '@/types';

// ============================================================================
// CreatureCard — targeta de criatura del redesign (reconstruïda de zero).
// Consumeix tokens (T) i el mòdul de 8px (U); cap dependència de C.
// Tot glyph és pixel-art de 8x8 col·locat a mà (SVG crispEdges), mai text
// decoratiu ni barres contínues.
// ============================================================================

interface Props {
  enemy: LibEnemy;
  conditions: string[];          // ids de CONDITIONS actius
  defeated: boolean;
  onRemove: () => void;
  onToggleVisibility: () => void;
  onAdjustHp: (delta: number) => void;
}

// ── Glyph de 8x8: files de 8 caràcters, '#' = píxel ple ─────────────────────
function Glyph8({ rows, color, scale = 2 }: { rows: string[]; color: string; scale?: number }) {
  return (
    <svg width={8 * scale} height={8 * scale} viewBox="0 0 8 8" shapeRendering="crispEdges" style={{ display: 'block' }}>
      {rows.flatMap((r, y) =>
        [...r].map((ch, x) =>
          ch === '#' ? <rect key={`${x}.${y}`} x={x} y={y} width={1} height={1} fill={color} /> : null,
        ),
      )}
    </svg>
  );
}

// ── Glyphs de condició (8x8) ────────────────────────────────────────────────
const CONDITION_GLYPHS: Record<string, string[]> = {
  grappled:      ['.##..##.', '#..##..#', '#..##..#', '.##..##.', '.##..##.', '#..##..#', '#..##..#', '.##..##.'],
  frightened:    ['...##...', '...##...', '...##...', '...##...', '...##...', '........', '...##...', '...##...'],
  stunned:       ['#..#..#.', '.#.#.#..', '..###...', '###.###.', '..###...', '.#.#.#..', '#..#..#.', '........'],
  blinded:       ['........', '........', '#......#', '.######.', '..#..#..', '.#....#.', '........', '........'],
  prone:         ['...##...', '...##...', '...##...', '.######.', '..####..', '...##...', '........', '........'],
  deafened:      ['#.....#.', '.#...#..', '..#.#...', '...#....', '..#.#...', '.#...#..', '#.....#.', '........'],
  poisoned:      ['...#....', '..###...', '..###...', '.#####..', '.#####..', '.#####..', '..###...', '........'],
  charmed:       ['.##..##.', '########', '########', '.######.', '..####..', '...##...', '........', '........'],
  unconscious:   ['######..', '....#...', '...#....', '..#.....', '.#......', '######..', '........', '........'],
  invisible:     ['...#....', '........', '.#...#..', '........', '#.....#.', '........', '.#...#..', '...#....'],
  paralyzed:     ['...###..', '..###...', '.###....', '######..', '...###..', '..###...', '.###....', '.#......'],
  petrified:     ['........', '..####..', '.######.', '########', '########', '########', '.######.', '........'],
  restrained:    ['##.##.##', '##.##.##', '........', '##.##.##', '##.##.##', '........', '##.##.##', '##.##.##'],
  incapacitated: ['..####..', '.######.', '.#.##.#.', '.######.', '..####..', '..#..#..', '........', '........'],
};

// ── Pips de vida (cors 8x8): ple → esquerdat → buit. Mai barra contínua. ────
const HEART_FULL    = ['........', '.##..##.', '########', '########', '.######.', '..####..', '...##...', '........'];
const HEART_CRACKED = ['........', '.##..##.', '####.###', '###.####', '.###.##.', '..##.#..', '...##...', '........'];
const HEART_EMPTY   = ['........', '.##..##.', '#..##..#', '#......#', '.#....#.', '..#..#..', '...##...', '........'];

// ── Nivell i amenaça: derivats de hpMax fins que el model porti camps reals ─
function levelOf(hpMax: number): number {
  return Math.max(1, Math.ceil(hpMax / 15));
}
type Threat = 'easy' | 'elite' | 'boss' | 'downed';
function threatOf(hpMax: number, downed: boolean): Threat {
  if (downed) return 'downed';
  if (hpMax >= 100) return 'boss';
  if (hpMax >= 30) return 'elite';
  return 'easy';
}
const THREAT_COLOR: Record<Threat, string> = {
  easy: T.ok, elite: T.gold, boss: T.accent, downed: T.dim,
};

// Farciment d'espai mort: ◆ repetits fins a la vora (mai un buit).
function DiamondFill() {
  return (
    <div aria-hidden style={{
      flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', alignSelf: 'center',
      color: T.dim, fontSize: U, lineHeight: 1, letterSpacing: U / 2, userSelect: 'none',
    }}>
      {'◆'.repeat(64)}
    </div>
  );
}

function SquareButton({ label, title, onClick, onContextMenu, color, side = U * 2 + 4 }: {
  label: string; title: string; onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void; color: string; side?: number;
}) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={title}
      className="bevel"
      style={{
        width: side, height: side, flexShrink: 0, padding: 0,
        background: T.panelIn, border: 'none', cursor: 'pointer',
        color, fontSize: side - U, lineHeight: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {label}
    </button>
  );
}

export function CreatureCard({ enemy, conditions, defeated, onRemove, onToggleVisibility, onAdjustHp }: Props) {
  const hp = Math.max(0, enemy.hp ?? enemy.hpMax);
  const downed = defeated || hp <= 0;
  const threat = threatOf(enemy.hpMax, downed);
  const active = new Set(conditions);

  // Transformacions del render del sprite segons condicions actives.
  const filters: string[] = [];
  if (active.has('petrified')) filters.push('grayscale(1)');
  const spriteStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    filter: filters.length ? filters.join(' ') : undefined,
    transform: active.has('prone') ? 'rotate(90deg)' : undefined,
    opacity: active.has('invisible') ? 0.25 : 1,
  };

  // Pips: màxim 10; cada pip val hpMax/nPips. Ple / esquerdat (pip en curs) / buit.
  const nPips = Math.max(1, Math.min(10, enemy.hpMax));
  const perPip = enemy.hpMax / nPips;
  const pips = Array.from({ length: nPips }, (_, i) => {
    const pipHp = hp - i * perPip;
    if (pipHp >= perPip) return 'full';
    if (pipHp > 0) return 'cracked';
    return 'empty';
  });

  const condSlots = Array.from({ length: 6 }, (_, i) => conditions[i] ?? null);

  return (
    <div className="bevel" style={{ background: T.panel, padding: U, opacity: !enemy.visible ? 0.55 : 1 }}>
      {/* ── Capçalera: retrat + identitat + vida ── */}
      <div style={{ display: 'flex', gap: U }}>
        {/* Retrat 64x64 bisellat, sprite a 2x. Les condicions transformen el render. */}
        <div
          className="bevel-in"
          style={{
            width: U * 8, height: U * 8, flexShrink: 0, background: T.panelIn,
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
            outline: active.has('invisible') ? `1px dotted ${T.dim}` : undefined,
            outlineOffset: -3,
          }}
        >
          <div style={spriteStyle}>
            <Sprite name={enemy.templateId} size={2} />
          </div>
          {/* poisoned: vel verd */}
          {active.has('poisoned') && (
            <div style={{ position: 'absolute', inset: 0, background: T.ok, opacity: 0.3, pointerEvents: 'none' }} />
          )}
          {/* charmed: vel magenta */}
          {active.has('charmed') && (
            <div style={{ position: 'absolute', inset: 0, background: T.magic, opacity: 0.3, pointerEvents: 'none' }} />
          )}
          {/* unconscious: màscara de dithering al 50% (tauler 2px) */}
          {active.has('unconscious') && (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: `repeating-conic-gradient(${T.bevelLo} 0% 25%, transparent 0% 50%)`,
              backgroundSize: '4px 4px',
            }} />
          )}
        </div>

        {/* Identitat + vida */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: U / 2 }}>
          <div style={{ display: 'flex', gap: U / 2, minWidth: 0 }}>
            <span style={{
              color: THREAT_COLOR[threat], fontSize: U * 2, lineHeight: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%',
            }}>
              {enemy.name}
            </span>
            <DiamondFill />
            <SquareButton
              label={enemy.visible ? '👁' : '·'}
              title={enemy.visible ? 'Ocultar' : 'Mostrar'}
              onClick={onToggleVisibility}
              color={enemy.visible ? T.bone : T.dim}
            />
            <SquareButton label="✕" title="Treure de l'escena" onClick={onRemove} color={T.danger} />
          </div>

          <div style={{ color: T.dim, fontSize: U * 1.5, lineHeight: 1 }}>lv{levelOf(enemy.hpMax)}</div>

          {enemy.hpMax > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: U / 2 }}>
                <span style={{ color: T.danger, fontSize: U * 2, lineHeight: 1 }}>♥</span>
                <span style={{ color: T.bone, fontSize: U * 2, lineHeight: 1 }}>{hp}</span>
                <DiamondFill />
                <SquareButton
                  label="−" title="−1 (clic dret −10)" color={T.danger} side={U * 2}
                  onClick={() => onAdjustHp(-1)}
                  onContextMenu={e => { e.preventDefault(); onAdjustHp(-10); }}
                />
                <SquareButton
                  label="+" title="+1 (clic dret +10)" color={T.ok} side={U * 2}
                  onClick={() => onAdjustHp(1)}
                  onContextMenu={e => { e.preventDefault(); onAdjustHp(10); }}
                />
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                {pips.map((p, i) => (
                  <Glyph8
                    key={i}
                    rows={p === 'full' ? HEART_FULL : p === 'cracked' ? HEART_CRACKED : HEART_EMPTY}
                    color={p === 'empty' ? T.dim : T.danger}
                    scale={1}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Condicions: sis ranures fixes de 20x20 sota el retrat ── */}
      <div style={{ display: 'flex', gap: U / 2, marginTop: U }}>
        {condSlots.map((id, i) => {
          const cond = id ? CONDITIONS_BY_ID.get(id) : null;
          return (
            <div
              key={i}
              className="bevel-in"
              title={cond?.label ?? undefined}
              style={{
                width: U * 2 + 4, height: U * 2 + 4, background: T.panelIn,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {id && CONDITION_GLYPHS[id]
                ? <Glyph8 rows={CONDITION_GLYPHS[id]} color={T.bone} scale={2} />
                : <div style={{ width: 2, height: 2, background: T.dim }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
