/** "1 team", "2 teams". Pass `many` for irregular plurals. */
export function plural(n: number, one: string, many = one + 's') {
  return n + ' ' + (n === 1 ? one : many);
}
