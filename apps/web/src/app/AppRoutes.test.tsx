import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { defaultState } from '../data/state';
import { StoreContext, createStaticStore } from '../store/store';
import { AppRoutes } from './AppRoutes';

function renderRoute(path: string, authed: boolean) {
  const store = createStaticStore({ ...defaultState(), authed });
  return renderToStaticMarkup(
    <StoreContext.Provider value={store}>
      <MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>
    </StoreContext.Provider>,
  );
}

describe('landing and dashboard routes', () => {
  it.each([false, true])('keeps original landing at / with authed=%s', (authed) => {
    const html = renderRoute('/', authed);
    expect(html).toContain('data-screen-label="Discover"');
    expect(html).toContain('Find competitions.');
    expect(html).toContain('Build your team.');
    expect(html).toContain('Teams recruiting right now');
    expect(html).toContain('Trending competitions');
    expect(html).not.toContain('data-screen-label="For You"');
  });

  it('keeps personal dashboard available separately after login', () => {
    const html = renderRoute('/for-you', true);
    expect(html).toContain('data-screen-label="For You"');
    expect(html).not.toContain('data-screen-label="Discover"');
  });

  it('preserves original dashboard action hierarchy and incoming-connection preview', () => {
    const html = renderRoute('/for-you', true);
    const deadline = html.indexOf('TechnoScape Hackathon 9.0 closes in 3 days');
    const review = html.indexOf('Vertex has 2 new applicants');
    const match = html.indexOf('Apex needs a Presenter');
    const application = html.indexOf('Your application to Orion is pending');
    expect(deadline).toBeGreaterThan(-1);
    expect(review).toBeGreaterThan(deadline);
    expect(match).toBeGreaterThan(review);
    expect(application).toBeGreaterThan(match);
    expect(html).toContain('Nadia Chen');
  });

  it('requires login for personal dashboard', () => {
    expect(renderRoute('/for-you', false)).not.toContain('data-screen-label="For You"');
  });
});
