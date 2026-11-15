import type { UnitData } from '../../types/quiz';
import { UNITS_1_TO_5 } from './units1to5';
import { UNITS_6_TO_10 } from './units6to10';
import { UNITS_11_TO_15 } from './units11to15';
import { UNITS_16_TO_20 } from './units16to20';

export const ALL_UNITS: UnitData[] = [
  ...UNITS_1_TO_5,
  ...UNITS_6_TO_10,
  ...UNITS_11_TO_15,
  ...UNITS_16_TO_20,
];

export function getUnitByNumber(unitNumber: number): UnitData | undefined {
  return ALL_UNITS.find((u) => u.unitNumber === unitNumber);
}
