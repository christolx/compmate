import type { SVGProps } from 'react';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'strokeWidth'> & {
  size: number;
  /** Stroke width. */
  sw?: number;
  /** Round line caps (default true). */
  cap?: boolean;
  /** Round line joins (default true). */
  join?: boolean;
};

export function Icon({ size, sw = 2, cap = true, join = true, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap={cap ? 'round' : undefined}
      strokeLinejoin={join ? 'round' : undefined}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

type Sized = Omit<IconProps, 'children'>;

export const SearchIcon = (p: Sized) => (
  <Icon sw={2.2} join={false} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);
export const BookmarkIcon = (p: Sized) => (
  <Icon cap={false} {...p}>
    <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Icon>
);
export const BellIcon = (p: Sized) => (
  <Icon {...p}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </Icon>
);
export const CheckIcon = (p: Sized) => (
  <Icon sw={3} {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);
export const CloseIcon = (p: Sized) => (
  <Icon join={false} {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
);
export const ChevronDownIcon = (p: Sized) => (
  <Icon sw={2.4} {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);
export const ChevronRightIcon = (p: Sized) => (
  <Icon sw={2.2} {...p}>
    <path d="m9 18 6-6-6-6" />
  </Icon>
);
export const BackIcon = (p: Sized) => (
  <Icon sw={2.2} {...p}>
    <path d="m15 18-6-6 6-6" />
  </Icon>
);
export const ShareIcon = (p: Sized) => (
  <Icon {...p}>
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
  </Icon>
);
export const FiltersIcon = (p: Sized) => (
  <Icon sw={2.2} join={false} {...p}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </Icon>
);
export const VerifiedIcon = (p: Sized) => (
  <Icon sw={2.6} {...p}>
    <path d="M9 12l2 2 4-4M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7z" />
  </Icon>
);

export function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="var(--color-brand)" />
      <path d="M18 13.1 A8 8 0 1 0 14 28 H23 V12 L29 19.5 L35 12 V28" fill="none" stroke="#FFFFFF" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
