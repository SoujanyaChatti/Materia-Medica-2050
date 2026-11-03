// Build-time data access. The site never computes science: it reads what pipeline stage 07
// (or `npm run data:sample`) wrote to public/data/.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Meta, Species, SpeciesSummary } from './types';

const DATA = join(process.cwd(), 'public', 'data');
const read = <T>(rel: string): T => JSON.parse(readFileSync(join(DATA, rel), 'utf8')) as T;

export const getMeta = (): Meta => read<Meta>('meta.json');
export const getSpeciesList = (): SpeciesSummary[] => read<SpeciesSummary[]>('species.json').sort((a, b) => a.risk.rank - b.risk.rank);
export const getSpecies = (slug: string): Species => read<Species>(join('species', `${slug}.json`));
