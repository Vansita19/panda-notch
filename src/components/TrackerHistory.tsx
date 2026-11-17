import {useState} from 'react';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {Button} from '../arc/button/button';
import {dayFromKey, monthGrid} from '../month-progress.mjs';
import {trackerCount} from '../tracker.mjs';
import type {TrackerHabit} from './tracker-types';
import './month-progress.css';
import './tracker-history.css';

const weekdays = [
  ['Mon', 'Monday'], ['Tue', 'Tuesday'], ['Wed', 'Wednesday'], ['Thu', 'Thursday'],
  ['Fri', 'Friday'], ['Sat', 'Saturday'], ['Sun', 'Sunday'],
];
const monthLabel = new Intl.DateTimeFormat(undefined, {month:'long', year:'numeric'});
const dayLabel = new Intl.DateTimeFormat(undefined, {weekday:'long', day:'numeric', month:'long', year:'numeric'});
const ringLength = 2 * Math.PI * 13.5;

function monthIndex(day: string) {
  const date = new Date(dayFromKey(day) ?? Date.now());
  return date.getFullYear() * 12 + date.getMonth();
}

function trackedValue(habit: TrackerHabit, day: string) {
  if (!Object.hasOwn(habit.days, day)) return null;
  return habit.kind === 'duration' ? habit.days[day] : trackerCount(habit, day);
}

function HistoryDay({cell, habit, today, onSelectDay}: {
  cell: ReturnType<typeof monthGrid>[number];
  habit: TrackerHabit;
  today: string;
  onSelectDay: (day: string) => void;
}) {
  const isToday = cell.key === today;
  const isFuture = cell.date > dayFromKey(today);
  const canOpen = cell.inMonth && !isFuture;
  const duration = habit.kind === 'duration';
  const goal = duration ? habit.goalMinutes : habit.slots;
  const value = canOpen ? trackedValue(habit, cell.key) : null;
  const progress = value === null ? 0 : Math.min(1, value / goal);
  const classes = `month-progress-day${isToday ? ' is-today' : ''}${progress === 1 ? ' is-complete' : ''}`;
  const summary = value === null
    ? 'No entry'
    : duration ? `${value} of ${goal} minutes` : `${value} of ${goal} checks`;
  const label = `${dayLabel.format(cell.date)}. ${isToday ? 'Today. ' : ''}${summary}.`;
  const date = cell.key.split('-').map((part, index) => index ? part.padStart(2, '0') : part).join('-');
  const content = <>
    <time className="month-progress-date" dateTime={date}>{cell.day}</time>
    {value !== null && <span className="month-day-progress has-progress">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle className="month-ring-track" cx="16" cy="16" r="13.5"/>
        {progress > 0 && <circle className="month-ring-fill" cx="16" cy="16" r="13.5"
          strokeDasharray={ringLength} strokeDashoffset={ringLength * (1 - progress)}
          transform="rotate(-90 16 16)"/>}
      </svg>
      <span className="month-progress-ratio">{duration ? `${value}m` : `${value}/${goal}`}</span>
    </span>}
  </>;

  return <td className={`month-progress-cell${canOpen ? '' : ' is-outside'}`}>
    {canOpen
      ? <button type="button" className={classes} aria-current={isToday ? 'date' : undefined}
          aria-label={label} title={summary} onClick={() => onSelectDay(cell.key)}>{content}</button>
      : <div className={classes}>{content}</div>}
  </td>;
}

export function TrackerHistory({trackers, today, day, onSelectDay}: {
  trackers: TrackerHabit[];
  today: string;
  day: string;
  onSelectDay: (day: string) => void;
}) {
  const [habitId, setHabitId] = useState(trackers[0]?.id);
  const [selectedMonth, setSelectedMonth] = useState(() => monthIndex(day));
  const habit = trackers.find(item => item.id === habitId) ?? trackers[0];

  if (!habit) return <p className="tracker-history-empty">No trackers yet.</p>;

  const currentMonth = monthIndex(today);
  const month = Math.min(selectedMonth, currentMonth);
  const grid = monthGrid(Math.floor(month / 12), month % 12);
  const firstDay = grid.find(cell => cell.inMonth);
  const monthName = monthLabel.format(firstDay.date);
  const rows = [];
  for (let index = 0; index < grid.length; index += 7) {
    const week = grid.slice(index, index + 7);
    if (!week.some(cell => cell.inMonth)) break;
    rows.push(week);
  }
  const duration = habit.kind === 'duration';
  const goal = duration ? habit.goalMinutes : habit.slots;
  const todayStamp = dayFromKey(today);
  const recorded = grid
    .filter(cell => cell.inMonth && cell.date <= todayStamp)
    .map(cell => trackedValue(habit, cell.key))
    .filter(value => value !== null);
  const goalsMet = recorded.filter(value => value >= goal).length;

  return <section className="tracker-history-month month-task-progress" aria-label="Monthly tracker history">
    <div className="tracker-history-filter">
      <label>
        <span>Habit</span>
        <select aria-label="Habit" value={habit.id} onChange={event => setHabitId(event.target.value)}>
          {trackers.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}
        </select>
      </label>
      <span className="tracker-history-goal">{goal} {duration ? 'min' : 'checks'} daily goal</span>
    </div>
    <header className="month-progress-heading">
      <div>
        <h2 aria-live="polite">{monthName}</h2>
        {recorded.length > 0 && <p className="tracker-history-summary">
          At goal on {goalsMet} of {recorded.length} logged {recorded.length === 1 ? 'day' : 'days'}
        </p>}
      </div>
      <div className="month-progress-navigation">
        <Button type="button" variant="ghost" size="sm" aria-label="Previous month"
          disabled={month <= 12} onClick={() => setSelectedMonth(month - 1)}><ChevronLeft size={13}/></Button>
        <Button type="button" variant="ghost" size="sm" className="month-jump-today"
          disabled={month === currentMonth} onClick={() => setSelectedMonth(currentMonth)}>Today</Button>
        <Button type="button" variant="ghost" size="sm" aria-label="Next month"
          disabled={month === currentMonth} onClick={() => setSelectedMonth(month + 1)}><ChevronRight size={13}/></Button>
      </div>
    </header>
    <table className="month-progress-table" aria-label={`${monthName}, ${habit.title} history`}>
      <thead><tr>{weekdays.map(([short, long]) =>
        <th scope="col" key={short} abbr={long}><span>{short}</span></th>
      )}</tr></thead>
      <tbody>{rows.map(week => <tr key={week[0].key}>{week.map(cell =>
        <HistoryDay key={cell.key} cell={cell} habit={habit} today={today} onSelectDay={onSelectDay}/>
      )}</tr>)}</tbody>
    </table>
  </section>;
}
