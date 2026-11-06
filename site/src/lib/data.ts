// Build-time data access. The site never computes science: it reads what pipeline stages 07–08
// (or `npm run data:sample`) wrote to public/data/.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Lineage, Meta, Species, SpeciesSummary } from './types';

const DATA = join(process.cwd(), 'public', 'data');
const read = <T>(rel: string): T => JSON.parse(readFileSync(join(DATA, rel), 'utf8')) as T;

export const getMeta = (): Meta => read<Meta>('meta.json');
export const getSpeciesList = (): SpeciesSummary[] => read<SpeciesSummary[]>('species.json').sort((a, b) => a.risk.rank - b.risk.rank);
export const getSpecies = (slug: string): Species => read<Species>(join('species', `${slug}.json`));
/** Full records for every species, in rank order. */
export const getAllSpecies = (): Species[] => getSpeciesList().map((s) => getSpecies(s.slug));
export const getLineage = (): Lineage[] => (existsSync(join(DATA, 'lineage.json')) ? read<Lineage[]>('lineage.json') : []);
