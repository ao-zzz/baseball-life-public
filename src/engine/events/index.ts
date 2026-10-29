import type { EventSpec } from './spec.ts'
import { HS_LIFE } from './hsLife.ts'
import { UNIV_LIFE } from './univLife.ts'
import { LATE_LIFE } from './lateLife.ts'
import { PRO_LIFE } from './proLife.ts'
import { AFTER_LIFE } from './afterLife.ts'
import { DAILY_LIFE } from './dailyLife.ts'
import { RICH_LIFE } from './richLife.ts'
import { FOLLOW_LIFE } from './followLife.ts'
import { TRAINER_LIFE } from './trainerLife.ts'
import { DIAMOND_LIFE } from './diamondLife.ts'
import { LIFE_STORIES } from './lifeStories.ts'
import { MORE_LIFE } from './moreLife.ts'
import { BRANCH_LIFE } from './branchLife.ts'
import { EARLY_LIFE } from './earlyLife.ts'
import { LIFE_CHOICES } from './lifeChoices.ts'
import { POTENTIAL_LIFE } from './potentialLife.ts'
import { COACH_LIFE } from './coachLife.ts'
import { CREATOR_LIFE } from './creatorLife.ts'
import { ENTERTAIN_LIFE } from './entertainLife.ts'
import { WORK_LIFE } from './workLife.ts'
import { PUBLIC_CAREER } from './publicCareer.ts'
import { BASEBALL_CAREER } from './baseballCareer.ts'
import { SNS_LIFE } from './snsLife.ts'
import { LICENSE_LIFE } from './licenseLife.ts'

// Declarative events by domain (PROJECT_PLAN §11.10–11.12): high-school life, university life (the team, the
// circle, the students who do not play) and old age. They are drawn in the extra pass (events.ts
// runExtraEvents), on their own random stream. More domains come with the other routes (company and
// independent teams, pro, after baseball).
export const SPECS: EventSpec[] = [...HS_LIFE, ...UNIV_LIFE, ...PRO_LIFE, ...AFTER_LIFE, ...LATE_LIFE, ...DAILY_LIFE, ...RICH_LIFE, ...FOLLOW_LIFE, ...TRAINER_LIFE, ...DIAMOND_LIFE, ...LIFE_STORIES, ...MORE_LIFE, ...BRANCH_LIFE, ...EARLY_LIFE, ...LIFE_CHOICES, ...POTENTIAL_LIFE, ...COACH_LIFE, ...CREATOR_LIFE, ...ENTERTAIN_LIFE, ...WORK_LIFE, ...PUBLIC_CAREER, ...BASEBALL_CAREER, ...SNS_LIFE, ...LICENSE_LIFE]
