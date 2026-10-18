type Kind = 'apple' | 'biscuit' | 'juice' | 'bath' | 'ball' | 'moon' | 'clock' | 'basket' | 'harvest' | 'trophy';
// Direct PNG rasterizations of the original web game's SWF artwork.
const sources: Record<Kind, string> = {
  apple: 'items/180027.png', biscuit: 'items/180017.png', juice: 'items/180008.png',
  bath: 'items/180003.png', ball: 'items/180004.png', moon: 'ui/icon-clock.png',
  clock: 'ui/icon-clock.png', basket: 'ui/icon-food.png', harvest: 'items/180027.png',
  trophy: 'ui/icon-medal.png',
};
export default function GameArt({ kind, className = '' }: { kind: Kind; className?: string }) {
  return <img aria-hidden="true" alt="" draggable={false} className={`raster-game-art ${className}`} src={`./assets/original/${sources[kind]}`} />;
}
