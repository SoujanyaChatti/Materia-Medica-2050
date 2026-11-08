// A real, openly licensed photo of the plant (Wikimedia Commons), always shown with its credit and licence.
import type { PlantPhotoCredit } from '../lib/types';
import { href } from '../lib/url';

export function PlantPhoto({ slug, credit, name, className = '', imgClass = '' }: {
  slug: string; credit: PlantPhotoCredit | null; name: string; className?: string; imgClass?: string;
}) {
  if (!credit) return null;
  return (
    <figure className={`m-0 flex flex-col gap-1.5 ${className}`}>
      <img src={href(`images/plants/${slug}.jpg`)} alt={`Photograph of ${credit.taxon}`} loading="lazy"
        className={`block w-full rounded-sm object-cover ${imgClass}`} />
      <figcaption className="text-[12px] leading-snug text-muted">
        {credit.pooled_note && <><em>{credit.taxon}</em>, {credit.pooled_note}. </>}
        Photo: {credit.author} · <a href={credit.licence_url || credit.page} className="text-muted underline">{credit.licence}</a> · <a href={credit.page} className="text-muted underline">Wikimedia Commons</a>
        <span className="sr-only"> (photo of {name})</span>
      </figcaption>
    </figure>
  );
}
