type TrackerBase = {
  id: string;
  title: string;
  created: number;
  days: Record<string, number>;
};

export type CountTracker = TrackerBase & {kind?: 'count'; slots: number};
export type DurationTracker = TrackerBase & {kind: 'duration'; goalMinutes: number};
export type TrackerHabit = CountTracker | DurationTracker;
