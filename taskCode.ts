import type { CategoryMaster, Task } from './types';
import { categoryCodeMapping, orgCodeMapping } from './data';

type MemberInfoForCode = {
  department: string;
  team: string;
  group: string;
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pad2 = (n: number) => String(n).padStart(2, '0');

const normalizeTaskCodeForCompare = (code: string): string => {
  const raw = String(code || '').trim();
  // Expected: DI-AI-NLP-PL01.02.04.01 (orgPrefix 3 parts + "-" + cat1Code + "." + NN "." + NN "." + NN)
  const m = raw.match(/^([^-]+-[^-]+-[^-]+)-([A-Za-z0-9]+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return raw;
  const [, org, cat1, a, b, c] = m;
  const aN = parseInt(a, 10);
  const bN = parseInt(b, 10);
  const cN = parseInt(c, 10);
  if ([aN, bN, cN].some(x => Number.isNaN(x))) return raw;
  return `${org}-${cat1}.${pad2(aN)}.${pad2(bN)}.${pad2(cN)}`;
};

const getCategory1Code = (category1: string): string => {
  if (!category1) return 'X01';

  // Prefer explicit mapping (supports both "기획" and "기획 (PL01)" if present)
  const mapped = (categoryCodeMapping.category1 as any)[category1];
  if (mapped) return mapped;

  // Try extracting "(CODE)" pattern e.g. "기획 (PL01)" -> "PL01"
  const m = category1.match(/\(([^)]+)\)\s*$/);
  if (m?.[1]) return m[1].trim();

  // Try mapping by stripping " (CODE)"
  const stripped = category1.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const mappedStripped = (categoryCodeMapping.category1 as any)[stripped];
  if (mappedStripped) return mappedStripped;

  return 'X01';
};

const buildOrgPrefix = (memberInfo: MemberInfoForCode): string => {
  const deptCode = (orgCodeMapping.departments as any)[memberInfo.department] || 'DXX';
  const teamCode = (orgCodeMapping.teams as any)[memberInfo.team] || 'TXX';
  const groupCode = (orgCodeMapping.groups as any)[memberInfo.group] || 'GXX';
  return `${deptCode}-${teamCode}-${groupCode}`;
};

const getNextSequenceForPrefix = (existingTasks: Task[], orgPrefix: string, cat1Code: string, cat2Index: number, cat3Index: number): number => {
  // We generate strictly monotonic: max(existing)+1 (never reuse gaps)
  // Support both padded and non-padded historical codes for cat2/cat3/seq
  const re = new RegExp(
    `^${escapeRegExp(orgPrefix)}-${escapeRegExp(cat1Code)}\\.` +
      `0*${cat2Index}\\.` +
      `0*${cat3Index}\\.` +
      `(\\d+)(?:$|\\D)`
  );
  let max = 0;
  for (const t of existingTasks) {
    const code = t.taskCode || '';
    const m = code.match(re);
    if (m?.[1]) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return max + 1;
};

export const generateTaskCodeForTask2 = (params: {
  taskName: string; // Task 2
  category1: string;
  category2: string;
  category3: string;
  memberInfo: MemberInfoForCode | null;
  adminCategoryMaster: CategoryMaster;
  existingTasks: Task[];
}): string => {
  const { taskName, category1, category2, category3, memberInfo, adminCategoryMaster, existingTasks } = params;

  if (!memberInfo || !category1 || !category2 || !category3) {
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    return `T-${dateStr}-${Math.floor(Math.random() * 1000)}`;
  }

  const orgPrefix = buildOrgPrefix(memberInfo);
  const cat1Code = getCategory1Code(category1);

  const cat1Data = adminCategoryMaster[category1] || {};
  const cat2Keys = Object.keys(cat1Data);
  const cat2Index = Math.max(1, cat2Keys.indexOf(category2) + 1);

  const cat3Keys = cat1Data[category2] || [];
  const cat3Index = Math.max(1, cat3Keys.indexOf(category3) + 1);

  const prefix = `${orgPrefix}-${cat1Code}.${pad2(cat2Index)}.${pad2(cat3Index)}`;

  let seq = getNextSequenceForPrefix(existingTasks, orgPrefix, cat1Code, cat2Index, cat3Index);
  let candidate = `${prefix}.${pad2(seq)}`;
  const normalizedCandidate = () => normalizeTaskCodeForCompare(candidate);
  while (existingTasks.some(t => normalizeTaskCodeForCompare(t.taskCode || '') === normalizedCandidate())) {
    seq += 1;
    candidate = `${prefix}.${pad2(seq)}`;
  }
  return candidate;
};

