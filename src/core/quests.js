// Quest + secrets state. Pure logic (DOM-free) so it stays testable;
// main.js renders it into the banner.
export const QUESTS = [
  { id: 'circle', label: 'Stand on a circle' },
  { id: 'project', label: 'Open a project' },
  { id: 'hi', label: 'Say hi (H)' },
];

export function createQuests() {
  return { done: new Set(), circles: new Set() };
}

export function questText(q, phone = false) {
  const parts = QUESTS.map((d) =>
    `${q.done.has(d.id) ? '✓' : '○'} ${phone && d.id === 'hi' ? 'Say hi' : d.label}`);
  return `${parts.join(' · ')} — ${q.circles.size}/8 circles`;
}
