// Manuscript-style panel: book/chapter, Greek name in Greek script, excerpt or paraphrase, and the
// modern identification beneath with its confidence badge and citation.
import type { Species } from '../lib/types';
import { roman } from '../lib/format';
import { ConfidenceBadge } from './Badges';

/** "Sprengel 1830, vol. 2, p. 510; Fraas 1845, pp. 181-182" from a long evidence string. */
function shortCitation(src: string): string {
  const refs = src.match(/(Sprengel\s+1830[^:;('|]*?p+\.\s*[\d\-–]+|Fraas\s+1845[^:;'|]*?p+\.\s*[\d\-–]+|Osbaldeston\s+2000|Wellmann\s+19\d\d[^:;(|]*?p\.\s*\d+|Beck\s+2005)/g);
  if (refs && refs.length) return [...new Set(refs.map((r) => r.replace(/\s+/g, ' ').replace(/,?\s*Synopsis plantarum florae classicae,?/, ',').trim()))].join('; ');
  return src.length > 160 ? `${src.slice(0, 157)}…` : src;
}

export function DioscoridesCard({ sp }: { sp: Species }) {
  const d = sp.dioscorides;
  const [genus, epithet, ...author] = sp.accepted_name.split(' ');
  return (
    <article aria-label="Dioscorides entry" className="manuscript flex flex-col gap-3 px-6 py-7 sm:px-8">
      <div className="eyebrow flex flex-wrap justify-between gap-3 text-ochre">
        <span>De Materia Medica · Book {roman(d.book)}{d.chapter ? ` · ch. ${d.chapter}` : ''}</span><span>c. 50–70 CE</span>
      </div>
      <div lang="grc" className="font-serif text-[44px] leading-[1.05]">{d.greek_name}</div>
      {d.greek_translit && <div className="latin text-[17px] text-muted">{d.greek_translit}</div>}
      {d.excerpt && (
        <blockquote lang="grc" className="m-0 mt-1.5 font-serif text-[20px] leading-normal">
          {d.excerpt}{' '}<span className="text-muted">…</span>
        </blockquote>
      )}
      {d.paraphrase && (
        <p className="m-0 font-serif text-[17px] text-muted">
          Paraphrase: {d.paraphrase}{d.paraphrase_ai_assisted && <em> (AI-assisted paraphrase, reviewed by the team.)</em>}
        </p>
      )}
      <div aria-hidden="true" className="my-2 h-px bg-ochre opacity-50" />
      <div className="eyebrow text-muted">Modern identification</div>
      <div className="flex flex-wrap items-center gap-2.5">
        <em className="font-serif text-[22px]">{genus} {epithet}</em>
        <span className="text-[14px] text-muted">{author.join(' ')}{sp.family ? ` · ${sp.family}` : ''}</span>
        <ConfidenceBadge level={sp.identification.confidence} />
      </div>
      <p className="m-0 text-[14px]">
        {sp.identification.note && <>{sp.identification.note} </>}
        <span className="text-muted">Source: {shortCitation(sp.identification.source) || 'no identification source verified yet'}.{sp.identification.reviewed_by ? ` Reviewed by: ${sp.identification.reviewed_by}.` : ''}</span>
      </p>
      {sp.identification.source && sp.identification.source.length > 160 && (
        <details className="text-[13px] text-muted">
          <summary className="cursor-pointer">Full citation and quoted evidence</summary>
          <p className="m-0 mt-1.5 whitespace-pre-line break-words">{sp.identification.source.replace(/ \| /g, '\n')}</p>
        </details>
      )}
      <p className="m-0 text-[13px] text-muted">
        Opening words of the chapter (Wellmann numbering). Edition: {d.edition}.
        {d.excerpt_url && <> <a href={d.excerpt_url}>See the page scan</a>.</>}
      </p>
    </article>
  );
}
