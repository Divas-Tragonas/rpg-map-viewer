'use client';
import React from 'react';
import { SPELL_TYPES, SPELL_MODES, AREA_SPELL_DATA } from '@/constants';
import { RadialMenu } from '@/components/ui/RadialMenu';
import type { SpellMenuState } from '@/types';

interface Props {
  spellMenu: SpellMenuState | null;
  onClose: () => void;
  onAddSpell: (type: string) => void;
}

/**
 * Roda de màgies. Quines surten depèn del gest (veure `SPELL_MODES`): traç obert →
 * trajectòria, Maj+arrossegar → direccional, Alt+clic o traç creuat → àrea. La roda és la
 * mateixa `RadialMenu` que la de les zones màgiques.
 */
export function SpellMenuOverlay({ spellMenu, onClose, onAddSpell }: Props) {
  if (!spellMenu) return null;
  const mode = spellMenu.mode ?? 'path';
  const meta = SPELL_MODES[mode];
  const items = SPELL_TYPES.filter(s => s.mode === mode && !s.tokenOnly).map(s => {
    const area = AREA_SPELL_DATA[s.type];
    return {
      id: s.type, icon: s.emoji, label: s.title, color: s.color,
      detail: area ? `Radi ${area.aoeRadiusFt} ft · abast ${area.rangeFt} ft` : undefined,
    };
  });
  return (
    <RadialMenu x={spellMenu.cx} y={spellMenu.cy} title={meta.title} subtitle={meta.subtitle}
      items={items} onPick={onAddSpell} onClose={onClose} />
  );
}
