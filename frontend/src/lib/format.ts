// ISO "YYYY-MM-DD" to German "DD.MM.YYYY". Dates are stored as ISO strings, so no
// Date object (and no time zone) is involved.
export function formatDateDe(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}
