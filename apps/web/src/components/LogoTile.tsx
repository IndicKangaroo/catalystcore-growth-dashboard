import { useState } from 'react';

interface LogoTileProps {
  /** For the letter shown when there is no picture: the studio's, or the app's, name. */
  name: string;
  /** An https address from the stored settings or app. Null, or one that fails to load, shows the letter. */
  imageUrl?: string | null;
  /** A pale tint instead of the solid accent colour, for the many small tiles in a list. */
  soft?: boolean;
}

/**
 * A 32px square: the studio's logo or an app's icon, or the first letter of its name when there is
 * none. Decorative, because the name is always written next to it.
 */
export function LogoTile({ name, imageUrl = null, soft = false }: LogoTileProps) {
  // Keyed by address, so a new address gets another chance to load after one failed.
  return <Tile key={imageUrl ?? ''} name={name} imageUrl={imageUrl} soft={soft} />;
}

function Tile({ name, imageUrl, soft }: { name: string; imageUrl: string | null; soft: boolean }) {
  const [failed, setFailed] = useState(false);

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt=""
        onError={() => setFailed(true)}
        className="h-8 w-8 shrink-0 rounded-[8px] object-contain"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-sm font-semibold ${
        soft ? 'bg-accent/10 text-accent' : 'bg-accent text-accent-fg'
      }`}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
