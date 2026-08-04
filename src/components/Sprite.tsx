import manifest from '../../public/sprites/sprites.json';

// Sprite de criatura: art font de 32x32 px renderitzat a 2x o 3x, sempre
// amb escalat de veí més proper (pixelated) — els píxels es col·loquen,
// no es renderitzen. El manifest (public/sprites/sprites.json) mapa
// nom de criatura -> fitxer; qualsevol nom desconegut cau a la silueta.
type SpriteManifest = {
  tile: number;
  fallback: string;
  creatures: Record<string, string>;
};

const M = manifest as SpriteManifest;

export default function Sprite({ name, size = 2 }: { name: string; size?: 2 | 3 }) {
  const file = M.creatures[name] ?? M.fallback;
  const px = M.tile * size;
  return (
    <img
      src={`/sprites/${file}`}
      alt={name}
      width={px}
      height={px}
      draggable={false}
      style={{ width: px, height: px, imageRendering: 'pixelated' }}
    />
  );
}
