/* Skills are derived from the projects we already ship — no second list to
 * maintain and it can't drift out of date. Pure function so it stays testable. */
export function skillsFrom(projects) {
  const counts = new Map();
  for (const p of projects || []) {
    for (const s of p.stack || []) {
      const key = String(s).trim();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
