# Habit Dashboard · Streak Algorithm

The Habit Dashboard uses a rolling-window streak model that rewards consistency while allowing intentional rest days. This document formalises the algorithm so contributors and power users know exactly how streaks are computed.

## Terminology
- **Success day**: A day with at least one completed entry or an explicit skip. For numeric types (count/value/time/rating) a completion requires meeting or exceeding the configured target. If no target is defined, any recorded value counts as success.
- **Window**: The number of trailing days examined when evaluating a streak (default 7). Configurable per habit via “Streak window (days)”.
- **Goal**: Minimum number of success days required in the window (default 5). Configurable per habit via “Streak goal (days)”.
- **Evaluation day**: The day used to test whether the habit is currently in a streak. If today already has a success or skip, today is used; otherwise the algorithm evaluates yesterday.

## Algorithm Steps
1. **Collect history**
   - Gather up to 365 days of entries (configurable via `CONSTANTS.streakLookbackDays`) plus a 60-day pre-seed range for consecutive streak fallback.
   - For each day, determine `success`, `skipped`, `value`, and `entries`.

2. **Determine evaluation index**
   ```text
   if today.successOrSkip -> evaluationIndex = todayIndex
   else -> evaluationIndex = todayIndex - 1 (yesterday)
   evaluationIndex = clamp(evaluationIndex, 0, history.length - 1)
   ```

3. **Check activation**
   - Slide a window of length `window` ending at the evaluation index.
   - Count the number of success days inside the window.
   - If the count ≥ `goal`, the streak is **active**.
   - For short histories (fewer than `window` days), require at least `goal` successes overall to activate.

4. **Find streak start**
   - Starting from the evaluation index, walk backwards one day at a time.
   - For each index `i`, calculate successes within the window `[i - window + 1, i]`.
   - Stop the walk when a window fails the goal. The streak start is the day after the failure.
   - The streak length is the number of success or skipped days between start and evaluation (inclusive).

5. **Longest streak**
   - Iterate each day in history as a hypothetical evaluation point and repeat steps 3–4.
   - Track the longest streak length; ties favour the earliest start (widest span).

6. **Outputs**
   - `currentStreak`: length (days) of the active streak; `0` if inactive.
   - `streakActive`: boolean flag from step 3.
   - `streakGoal`: goal used for the habit.
   - `streakWindow`: window length used for the habit.
   - `longestStreak`: maximal streak length found in history.
   - `streakStart` / `streakEnd`: ISO dates bounding the active streak, when active.

## Worked Examples
Patterns are listed oldest → newest (rightmost character is the evaluation day unless today was a miss).

| Pattern (`O`=success, `S`=skip, `X`=miss) | Goal/Window | Evaluation Day | Result |
| --- | --- | --- | --- |
| `O O O O O O O` | 5 / 7 | Today (success) | Active, `currentStreak = 7` |
| `O O X O O O O` | 5 / 7 | Today (success) | Active, window still has 6 successes |
| `O X O S O X O` | 4 / 7 | Today (success) | Active, skips count as success (`currentStreak = 7`) |
| `O O X O X O X` | 5 / 7 | Today (miss) → Yesterday | Inactive, last window only has 4 successes |
| `X O O O O O O` | 5 / 7 | Yesterday (today miss) | Active, evaluation shifts to yesterday and streak length = 6 |

## Debugging & Instrumentation
- Add the `habitDebug` label to the dashboard note (or the script note) to display a “Streak debug” line under each card.
- The debug line prints the last ~30 days of success pattern, evaluation index/date, goal/window, current/longest streaks, and rolling window counts.
- Console logs prefixed with `[habit-dashboard/vXX]` also include streak evaluation objects during development builds.

## Implementation References
- Frontend logic: `calculateRollingStreak`, `evaluateHabitDayStatus`, and related helpers in [`habits/habit-dashboard.js`](../habit-dashboard.js).
- Constants: `CONSTANTS.streakWindowDays`, `CONSTANTS.streakLookbackDays`, and `CONSTANTS.streakPreseedDays`.
