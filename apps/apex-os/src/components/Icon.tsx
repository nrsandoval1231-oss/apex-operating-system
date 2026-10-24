import type { CSSProperties } from 'react';

export type IconName = 'today' | 'checklist' | 'calendar' | 'jobs' | 'more' | 'plus' | 'photo' | 'note' | 'designer' | 'history' | 'brief' | 'close';
const paths: Record<IconName, string> = {
  today: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  checklist: 'm3 6 2 2 3-4m3 2h10M3 13l2 2 3-4m3 2h10M3 20l2 2 3-4m3 2h10',
  calendar: 'M7 3v4m10-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2ZM7 14h3m4 0h3m-10 3h3',
  jobs: 'M3 21V8h18v13H3Zm5-13V4h8v4M3 13h18m-11-2v4h4v-4',
  more: 'M5 11h.01M12 11h.01M19 11h.01M6 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm7 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm7 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  plus: 'M12 5v14M5 12h14',
  photo: 'M3 7h4l2-3h6l2 3h4v14H3V7Zm13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  note: 'M5 3h14v18H5V3Zm4 5h6m-6 4h6m-6 4h4',
  designer: 'm4 16 12-12 4 4L8 20H4v-4Zm9-9 4 4M3 3h6M3 3v6',
  history: 'M3 4v6h6M3 10a9 9 0 1 1 1 8m8-12v6l4 2',
  brief: 'M8 5H4v17h16V5h-4M8 3h8v5H8V3Zm0 10h8m-8 4h5',
  close: 'm6 6 12 12M6 18 18 6',
};
export default function Icon({ name, size = 22, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={style}><path d={paths[name]} /></svg>;
}
