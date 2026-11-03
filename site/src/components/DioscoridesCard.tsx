// Manuscript-style panel: book/chapter, Greek name in Greek script, excerpt or paraphrase, and the
// modern identification beneath with its confidence badge and citation.
import type { Species } from '../lib/types';
import { roman } from '../lib/format';
import { ConfidenceBadge } from './Badges';

export function DioscoridesCard({ sp }: { sp: Species }) {
  const d = sp.dioscorides;
  const [genus, epithet, ...author] = sp.accepted_name.split(' ');
  return (
    <article aria-label="Dioscorides entry" className="manuscript flex flex-col gap-3 px-6 py-7 sm:px-8">
      <div className="eyebrow flex flex-wrap justify-between gap-3 text-ochre">
        <span>De Materia Medica · Book {roman(d.book)} · ch. {d.chapter ?? '[n]'}</span><span>c. 50–70 CE</span>
      </div>
      <div lang="grc" className="font-serif text-[44px] leading-[1.05]">{d.greek_name}</div>
      {d.greek_translit && <div className="latin text-[17px] text-muted">{d.greek_translit}</div>}
      <blockquote lang={d.excerpt ? 'grc' : undefined} className="m-0 mt-1.5 font-serif text-[20px] leading-normal">
        {d.excerpt ?? `[Greek excerpt, 1–2 lines, from ${d.edition} (public domain) — to be added.]`}
      </blockquote>
      <p className="m-0 font-serif text-[17px] text-muted">
        {d.paraphrase
          ? <>Paraphrase: {d.paraphrase}{d.paraphrase_ai_assisted && <em> (AI-assisted paraphrase, reviewed by the team.)</em>}</>
          : 'Paraphrase: [one sentence on the plant’s appearance and habitat as the chapter gives it. Historical description only.]'}
      </p>
      <div aria-hidden="true" className="my-2 h-px bg-ochre opacity-50" />
      <div className="eyebrow text-muted">Modern identification</div>
      <div className="flex flex-wrap items-center gap-2.5">
        <em className="font-serif text-[22px]">{genus} {epithet}</em>
        <span className="text-[14px] text-muted">{author.join(' ')}{sp.family ? ` · ${sp.family}` : ''}</span>
        <ConfidenceBadge level={sp.identification.confidence} />
      </div>
      <p className="m-0 text-[14px]">
        {sp.identification.note && <>{sp.identification.note} </>}
        <span className="text-muted">Source: {sp.identification.source}.{sp.identification.reviewed_by ? ` Reviewed by: ${sp.identification.reviewed_by}.` : ''}</span>
      </p>
      <p className="m-0 text-[13px] text-muted">Edition: {d.edition}.</p>
    </article>
  );
}
