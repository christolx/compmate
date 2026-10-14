/** Allow web links only; normalize organizer/profile links without a scheme. */
export function externalUrl(value?: string): string | null {
  const input = value?.trim();
  if (!input) return null;
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(input);
  try {
    const url = new URL(input.startsWith('//') ? `https:${input}` : hasScheme ? input : `https://${input}`);
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}
