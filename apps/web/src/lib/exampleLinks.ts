import type { ProfileLink } from '../data/types';
import { externalUrl } from './externalUrl';

export const EXAMPLE_PROFILE_LINKS: ProfileLink[] = [
  { label: 'LinkedIn', value: 'https://www.linkedin.com/', example: true },
  { label: 'Portfolio', value: 'https://example.com/', example: true },
  { label: 'Instagram', value: 'https://www.instagram.com/', example: true },
];

export function profileLinkDestination(link: ProfileLink) {
  const value = link.label === 'Instagram' && /^@[\w.]+$/.test(link.value)
    ? `https://www.instagram.com/${link.value.slice(1)}/` : link.value;
  const href = externalUrl(value);
  const fallback = EXAMPLE_PROFILE_LINKS.find(l => l.label === link.label)?.value ?? 'https://example.com/';
  return { href: href ?? fallback, example: !!link.example || !href };
}

export function exampleRegistrationUrl(id: string) {
  return `https://example.com/?competition=${encodeURIComponent(id)}`;
}

export function isExampleUrl(url: string) {
  return new URL(url).hostname === 'example.com';
}
