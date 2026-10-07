import { createContext, useContext } from 'react';

/**
 * Whether screens render their 390px mobile layout. The app derives it from
 * the window width (or the phone preview); the design board forces it per
 * frame, which a CSS media query could not do.
 */
export const ViewportContext = createContext(false);

export function useIsMobile() {
  return useContext(ViewportContext);
}
