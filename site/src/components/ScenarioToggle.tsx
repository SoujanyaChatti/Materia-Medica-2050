// Now · 2050 moderate · 2050 high, with a short live label explaining the selected scenario.
import type { Meta, ScenarioKey } from '../lib/types';

const KEYS: ScenarioKey[] = ['now', 'ssp245', 'ssp585'];

export function ScenarioToggle({ value, onChange, scenarios, showNote = true }: {
  value: ScenarioKey; onChange: (s: ScenarioKey) => void; scenarios: Meta['scenarios']; showNote?: boolean;
}) {
  const cur = scenarios[value];
  return (
    <div className="flex flex-col gap-1.5">
      <div role="group" aria-label="Climate scenario" className="flex w-fit flex-wrap overflow-hidden rounded-md border border-ink">
        {KEYS.map((k, i) => {
          const on = k === value;
          return (
            <button key={k} type="button" aria-pressed={on} onClick={() => onChange(k)}
              className={`min-h-11 cursor-pointer px-4 text-[15px] font-semibold ${i < KEYS.length - 1 ? 'border-r border-ink' : ''} ${on ? 'bg-ink text-bg' : 'bg-transparent text-ink'}`}>
              {scenarios[k].label}
            </button>
          );
        })}
      </div>
      {showNote && (
        <p aria-live="polite" className="m-0 text-[14px] text-muted"><strong className="text-ink">{cur.title}.</strong> {cur.description}</p>
      )}
    </div>
  );
}
