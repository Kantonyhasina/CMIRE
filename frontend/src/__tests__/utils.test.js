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

import { ajouterMois, bornesDuMois, formaterPeriode, joursDuMois, moisCourant, nomMois, trimestreDe } from '../utils/dates.js';

describe('mois et trimestres', () => {
  it('moisCourant / ajouterMois traversent les années', () => {
    expect(moisCourant(new Date(2025, 11, 31))).toBe('2025-12');
    expect(ajouterMois('2025-12', 1)).toBe('2026-01');
    expect(ajouterMois('2026-01', -1)).toBe('2025-12');
    expect(ajouterMois('2025-11', 14)).toBe('2027-01');
  });

  it('joursDuMois gère les mois de 28, 29, 30 et 31 jours', () => {
    expect(joursDuMois('2025-02')).toHaveLength(28);
    expect(joursDuMois('2024-02')).toHaveLength(29);
    expect(joursDuMois('2025-04')).toHaveLength(30);
    expect(joursDuMois('2025-12')).toHaveLength(31);
    expect(joursDuMois('2025-12')[0]).toBe('2025-12-01');
  });

  it('bornesDuMois donne le premier et le dernier jour', () => {
    expect(bornesDuMois('2024-02')).toEqual(['2024-02-01', '2024-02-29']);
    expect(bornesDuMois('2025-12')).toEqual(['2025-12-01', '2025-12-31']);
  });

  it('nomMois écrit le mois en français', () => {
    expect(nomMois('2025-02')).toBe('février 2025');
    expect(nomMois('2025-08')).toBe('août 2025');
  });

  it('trimestreDe : les 12 mois tombent dans le bon trimestre', () => {
    const attendu = [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4];
    attendu.forEach((t, mois) => expect(trimestreDe(new Date(2025, mois, 15))).toEqual({ trimestre: t, annee: 2025 }));
  });

  it('formaterPeriode : un jour ou une période', () => {
    expect(formaterPeriode('2025-12-18', '2025-12-18')).toBe('18/12/2025');
    expect(formaterPeriode('2025-12-10', '2025-12-14')).toBe('du 10/12/2025 au 14/12/2025');
  });
});
