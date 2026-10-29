import type { EntryMethodRow } from './types.ts'

// Admission methods per university (一般・学校推薦・スポーツ推薦・総合型): published 募集要項 etc., row by
// row with year, source and check date. Starts empty; the odds of passing are model assumptions, not
// statistics (PROJECT_PLAN §11.11).
export const ENTRY_METHODS: EntryMethodRow[] = []
