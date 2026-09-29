'use client';
import React from 'react';
import { ELEMENTS, SPELL_MODES } from '@/constants';
import { RadialMenu } from '@/components/ui/RadialMenu';
import type { ShapeMenuState } from '@/types';

interface Props {
  shapeMenu: ShapeMenuState | null;
  onClose: () => void;
  onAddZone: (elementId: string) => void;
}

/** Roda d'elements en tancar un traç amb l'eina Màgies (la mateixa `RadialMenu` que les màgies). */
export function ShapeMenuOverlay({ shapeMenu, onClose, onAddZone }: Props) {
  if (!shapeMenu) return null;
  const meta = SPELL_MODES.zone;
  return (
    <RadialMenu x={shapeMenu.cx} y={shapeMenu.cy} title={meta.title} subtitle={meta.subtitle}
      items={ELEMENTS.map(el => ({ id: el.id, icon: el.emoji, label: el.label, color: el.color }))}
      onPick={onAddZone} onClose={onClose} />
  );
}
