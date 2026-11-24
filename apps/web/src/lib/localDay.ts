/** Calendar date (YYYY-MM-DD) of an instant in the viewer's time zone. */
export function localDay(instant: string | Date): string {
  const d = new Date(instant);
  if (Number.isNaN(d.getTime())) return String(instant).slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
