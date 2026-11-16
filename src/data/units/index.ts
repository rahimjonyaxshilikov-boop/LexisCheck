import type { UnitData } from '../../types/quiz';
import { UNITS_1_TO_5 } from './units1to5';
import { UNITS_6_TO_10 } from './units6to10';
import { UNITS_11_TO_15 } from './units11to15';
import { UNITS_16_TO_20 } from './units16to20';
import { UNITS_21_TO_25 } from './units21to25';
import { UNITS_26_TO_30 } from './units26to30';
import { UNITS_31_TO_35 } from './units31to35';
import { UNITS_36_TO_40 } from './units36to40';
import { UNITS_41_TO_45 } from './units41to45';
import { UNITS_46_TO_50 } from './units46to50';
import { UNITS_51_TO_55 } from './units51to55';
import { UNITS_56_TO_60 } from './units56to60';
import { UNITS_61_TO_65 } from './units61to65';
import { UNITS_66_TO_70 } from './units66to70';
import { UNITS_71_TO_75 } from './units71to75';
import { UNITS_76_TO_80 } from './units76to80';
import { UNITS_81_TO_85 } from './units81to85';
import { UNITS_86_TO_90 } from './units86to90';
import { UNITS_91_TO_95 } from './units91to95';
import { UNITS_96_TO_101 } from './units96to101';

export const ALL_UNITS: UnitData[] = [
  ...UNITS_1_TO_5,
  ...UNITS_6_TO_10,
  ...UNITS_11_TO_15,
  ...UNITS_16_TO_20,
  ...UNITS_21_TO_25,
  ...UNITS_26_TO_30,
  ...UNITS_31_TO_35,
  ...UNITS_36_TO_40,
  ...UNITS_41_TO_45,
  ...UNITS_46_TO_50,
  ...UNITS_51_TO_55,
  ...UNITS_56_TO_60,
  ...UNITS_61_TO_65,
  ...UNITS_66_TO_70,
  ...UNITS_71_TO_75,
  ...UNITS_76_TO_80,
  ...UNITS_81_TO_85,
  ...UNITS_86_TO_90,
  ...UNITS_91_TO_95,
  ...UNITS_96_TO_101,
];

export function getUnitByNumber(unitNumber: number): UnitData | undefined {
  return ALL_UNITS.find((u) => u.unitNumber === unitNumber);
}
