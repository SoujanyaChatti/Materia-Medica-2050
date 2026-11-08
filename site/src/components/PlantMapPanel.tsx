// Plant page "Then and now": herbal illustration beside the modelled range map, with the scenario
// toggle, layer switches and a legend that follows the scenario.
import { useState } from 'react';
import type { Meta, PlantPhotoCredit, ScenarioKey } from '../lib/types';
import { PlantPhoto } from './PlantPhoto';
import { MapLegend } from './MapLegend';
import { RangeMap } from './RangeMap';
import { ScenarioToggle } from './ScenarioToggle';

export default function PlantMapPanel({ slug, commonName, translit, scenarios, lowConfidence, photo, greekName }: {
  slug: string; commonName: string; translit: string; scenarios: Meta['scenarios']; lowConfidence: boolean; photo: PlantPhotoCredit | null; greekName: string;
}) {
  const [scenario, setScenario] = useState<ScenarioKey>('ssp245');
  const [layers, setLayers] = useState({ range: true, cult: true, natura: false, labels: true, occ: false });
  const toggle = (k: keyof typeof layers) => setLayers((l) => ({ ...l, [k]: !l[k] }));
  const future = scenario !== 'now';
  const box = (k: keyof typeof layers, label: string) => (
    <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-[15px]">
      <input type="checkbox" checked={layers[k]} onChange={() => toggle(k)} className="h-[18px] w-[18px]" style={{ accentColor: 'var(--ink)' }} />{label}
    </label>
  );
  return (
    <section aria-labelledby="h-map" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h2 id="h-map" className="h-section">Then and now</h2>
        <ScenarioToggle value={scenario} onChange={setScenario} scenarios={scenarios} />
      </div>
      <div className="flex flex-wrap items-stretch gap-4">
        <div className="m-0 flex flex-[1_1_260px] flex-col gap-3 rounded-md border border-rule bg-sunk p-4">
          <div className="flex items-baseline justify-between gap-2">
            <div className="eyebrow text-ochre">The plant</div>
            <div lang="grc" className="font-serif text-[20px] text-ochre" title={translit}>{greekName}</div>
          </div>
          {photo
            ? <PlantPhoto slug={slug} credit={photo} name={commonName} imgClass="aspect-[4/5]" />
            : <p className="m-0 text-[14px] text-muted">No openly licensed photo found for this plant.</p>}
        </div>
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-2.5">
          <div className="flex flex-wrap gap-4">
            <div className="min-w-0 flex-[999_1_380px]">
              <RangeMap mode="range" slug={slug} scenario={scenario} layers={layers} tableHref="#range-table"
                chip={scenarios[scenario].title}
                ariaLabel={`Map of Greece showing the modelled range of ${commonName}, ${scenarios[scenario].title}. Data table below the map.`} />
            </div>
            <fieldset className="card-data m-0 flex flex-[1_1_180px] flex-col gap-1 self-start px-4 py-3.5">
              <legend className="px-1 text-[13px] font-bold">Layers</legend>
              {box('range', 'Modelled range')}
              {box('cult', 'Cultivation zones')}
              {box('natura', 'Natura 2000 sites')}
              {box('occ', 'Occurrence cells')}
              {box('labels', 'Place names')}
              <div aria-hidden="true" className="my-2 h-px bg-data-rule" />
              <MapLegend layout="column" items={[future ? 'kept' : 'current', ...(future ? ['lost', 'gained'] as const : []), 'cult', 'natura', 'occ']} note="Cells ≈ 10 × 10 km" />
            </fieldset>
          </div>
          <p className="m-0 text-[13px] text-muted">
            {lowConfidence && <strong className="text-warn">Exploratory map (low-confidence model). </strong>}
            Occurrences are aggregated to ~10 km cells; exact points are never published.{' '}
            <a href="#range-table">View range data as a table</a>
          </p>
        </div>
      </div>
    </section>
  );
}
