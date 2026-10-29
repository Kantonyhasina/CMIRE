import { afterEach, describe, expect, it, vi } from 'vitest';
import { formaterDateFr, semaineCourante } from '../utils/dates.js';

describe('semaineCourante', () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    ['un lundi', new Date(2025, 11, 15)],
    ['un mercredi', new Date(2025, 11, 17)],
    ['un dimanche', new Date(2025, 11, 21)],
  ])('renvoie lundi 15 -> dimanche 21 décembre 2025 pour %s', (_nom, date) => {
    expect(semaineCourante(date)).toEqual(['2025-12-15', '2025-12-21']);
  });

  it('gère le passage de mois et d\'année', () => {
    expect(semaineCourante(new Date(2026, 0, 1))).toEqual(['2025-12-29', '2026-01-04']);
  });
});

describe('formaterDateFr', () => {
  it('formate AAAA-MM-JJ en JJ/MM/AAAA sans passer par Date', () => {
    expect(formaterDateFr('2025-12-05')).toBe('05/12/2025');
  });
});

import { ajouterJours, lundiDe } from '../utils/dates.js';

describe('ajouterJours / lundiDe', () => {
  it('ajoute des jours en franchissant mois et années', () => {
    expect(ajouterJours('2025-12-29', 7)).toBe('2026-01-05');
    expect(ajouterJours('2025-12-15', -7)).toBe('2025-12-08');
    expect(ajouterJours('2024-02-28', 2)).toBe('2024-03-01'); // année bissextile
  });

  it('trouve le lundi de la semaine', () => {
    expect(lundiDe('2025-12-17')).toBe('2025-12-15');
    expect(lundiDe('2025-12-21')).toBe('2025-12-15');
    expect(lundiDe('2026-01-01')).toBe('2025-12-29');
  });
});
