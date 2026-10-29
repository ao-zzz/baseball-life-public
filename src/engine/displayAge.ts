/**
 * The age shown on screen. The model's `age` is the age at the start of the school year (4月1日): 高校1年 is 15, 大学1年 is 18. The
 * screen shows the age at the end of that year (the school-year-end age: 高校 16〜18, 大学 19〜22), so it is the model's age + 1.
 * Only what is shown changes: every check, stage, graduation and draft age in the engine reads the model's age.
 * Use this wherever the player's own age is written; the ages of parents, spouse and children are their own and are not shifted.
 */
export function shownAge(age: number): number {
  return age + 1
}
