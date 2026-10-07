import { useContext, type AnchorHTMLAttributes } from 'react';
import { NavContext, hrefFor, type NavArgs, type NavRoute, type PageRoute } from './nav';

type AppLinkProps<K extends PageRoute> = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  to: K;
  args?: NavArgs[K];
};

/**
 * A real link (open in new tab, copy address, keyboard focus) whose plain
 * clicks go through the shell's `nav`, so sign-in gates still apply.
 */
export function AppLink<K extends PageRoute>({ to, args, onClick, ...rest }: AppLinkProps<K>) {
  const { nav, inert } = useContext(NavContext);
  if (inert) return <a {...rest} />;
  const list = (args ?? []) as unknown[];
  return (
    <a
      href={hrefFor(to, list)}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        (nav as (route: NavRoute, ...a: unknown[]) => void)(to, ...list);
      }}
      {...rest}
    />
  );
}
