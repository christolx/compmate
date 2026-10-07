import { useEffect, useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { defaultState } from '../data/state';
import { NavContext } from '../app/nav';
import { ViewportContext } from '../app/viewport';
import { ApplySheet } from '../components/ApplySheet';
import { CompTile } from '../components/CompTile';
import { PersonTile } from '../components/PersonTile';
import { TeamTile } from '../components/TeamTile';
import { Competition } from '../screens/Competition';
import { Discover } from '../screens/Discover';
import { Explore } from '../screens/Explore';
import { ForYou } from '../screens/ForYou';
import { Manage } from '../screens/Manage';
import { People } from '../screens/People';
import { Profile } from '../screens/Profile';
import { Team } from '../screens/Team';
import { cx } from '../lib/cx';
import { StoreContext, createStaticStore } from '../store/store';

const INERT_NAV = { nav: () => {}, inert: true };
const SECTION_LABEL = 'font-mono text-[12px] font-semibold tracking-[.08em] text-slate-600';

/**
 * The round 3 design board: directions A/B, the eight core screens at desktop
 * 1440 and mobile 390, and the key states. Every frame renders the real
 * components against the sample state; nothing in a frame navigates.
 */
export function Board() {
  const sample = useMemo(() => createStaticStore(), []);
  const nothingSaved = useMemo(() => createStaticStore({ ...defaultState(), saved: [] }), []);
  useEffect(() => {
    document.title = 'Design board · CompMate';
    // Presentation-only page: reachable by direct URL, never indexed.
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  return (
    <StoreContext.Provider value={sample}>
      <NavContext.Provider value={INERT_NAV}>
        <ViewportContext.Provider value={false}>
          <div className="min-h-screen w-max min-w-full bg-[#EEF1F5]">
            <div className="flex w-max flex-col gap-[120px] p-20 font-sans text-ink">
              <section className="max-w-[1100px]">
                <div className={SECTION_LABEL}>COMPMATE · ROUND 3 · CORE EXPERIENCE REDESIGN</div>
                <h1 className="mt-3.5 mb-0 text-[64px] leading-[1.02] font-extrabold tracking-[-0.045em]">
                  Find competitions.
                  <br />
                  <span className="text-brand">Build your team.</span>
                </h1>
                <p className="mt-[22px] mb-0 max-w-[820px] text-[19px] leading-[1.6] text-slate-700">
                  Less boxing, more browsing. Competitions lead with their posters, teams lead with people, and every recommendation lists its reasons. The sample user is a fictional Management student; she appears as “You” almost everywhere.
                </p>
                <div className="mt-[26px] flex flex-wrap gap-3">
                  <Link to="/" className="inline-flex h-12 items-center rounded-[12px] bg-brand px-5 text-[15px] font-bold text-white hover:text-white">
                    Open the clickable prototype →
                  </Link>
                  {[
                    ['#directions', '01 · Directions A/B'],
                    ['#core', '02 · Core screens'],
                    ['#states', '03 · States'],
                  ].map(([href, label]) => (
                    <a key={href} href={href} className="inline-flex h-12 items-center rounded-[12px] bg-white px-5 text-[15px] font-bold text-ink hover:text-ink">
                      {label}
                    </a>
                  ))}
                </div>
              </section>

              <section id="directions">
                <div className={SECTION_LABEL}>01 · DIRECTIONS · A = MINIMAL / EDITORIAL · B = ENERGETIC / DISCOVERY</div>
                <div className="mt-9 flex flex-col gap-20">
                  <DirectionRow
                    title="Competition card"
                    chosen="A chosen"
                    text="The poster carries the visual weight, so the text block can stay quiet and scan fast in a grid. B's tinted footer and big countdown compete with the poster. A keeps B's best idea: an explicit Closing soon tag on the image."
                  >
                    <Labeled label="A · editorial">
                      <div data-frame="dir-comp-a" className="grid grid-cols-2 gap-6 rounded-[16px] bg-white p-7">
                        <CompTile cid="techno" />
                        <CompTile cid="nuiux" />
                      </div>
                    </Labeled>
                    <Labeled label="B · energetic">
                      <div data-frame="dir-comp-b" className="grid grid-cols-2 gap-6 rounded-[16px] bg-white p-7">
                        <CompTile cid="techno" variant="b" />
                        <CompTile cid="nuiux" variant="b" />
                      </div>
                    </Labeled>
                  </DirectionRow>
                  <DirectionRow
                    title="Team card"
                    chosen="B chosen"
                    text="Empty dashed seats next to real faces answer “how many are needed?” before you read a number. A is tidy but reads like a database row. B stays restrained: skills are plain text, only roles get chips."
                  >
                    <Labeled label="A · editorial row">
                      <div data-frame="dir-team-a" className="rounded-[16px] bg-white px-7 py-3">
                        <TeamTile tid="apex" variant="a" />
                        <TeamTile tid="orion" variant="a" />
                        <TeamTile tid="kinara" variant="a" />
                      </div>
                    </Labeled>
                    <Labeled label="B · people-first">
                      <div data-frame="dir-team-b" className="grid grid-cols-2 gap-5 rounded-[16px] bg-canvas p-7">
                        <TeamTile tid="apex" />
                        <TeamTile tid="orion" />
                      </div>
                    </Labeled>
                  </DirectionRow>
                  <DirectionRow
                    wide
                    title="Competition detail header"
                    chosen="A chosen"
                    text="A keeps the poster readable and puts deadline, fee and actions in a sticky rail that follows you down the page. B's dark band is striking but crops the poster and pushes the facts into big numbers with no context."
                  >
                    <div className="flex flex-col gap-8">
                      <Labeled label="A · editorial + sticky rail">
                        <Frame name="dir-detail-a" w={1440} h={760} radius="rounded-[14px]">
                          <Competition cid="nbcc" />
                        </Frame>
                      </Labeled>
                      <Labeled label="B · dark banner">
                        <Frame name="dir-detail-b" w={1440} h={520} radius="rounded-[14px]">
                          <Competition cid="nbcc" hero="b" />
                        </Frame>
                      </Labeled>
                    </div>
                  </DirectionRow>
                  <DirectionRow
                    wide
                    title="Logged-in home"
                    chosen="A chosen"
                    text="A starts with what needs doing (a deadline, applicants to review, a pending application) and keeps team status in a side rail. B is fun to browse but hides those actions in small chips, so you can miss an applicant or a deadline."
                  >
                    <div className="flex flex-col gap-8">
                      <Labeled label="A · action-first">
                        <Frame name="dir-home-a" w={1440} h={1180} radius="rounded-[14px]">
                          <ForYou />
                        </Frame>
                      </Labeled>
                      <Labeled label="B · discovery-first">
                        <Frame name="dir-home-b" w={1440} h={1180} radius="rounded-[14px]">
                          <ForYou dir="b" />
                        </Frame>
                      </Labeled>
                    </div>
                  </DirectionRow>
                </div>
              </section>

              <section id="core">
                <div className={SECTION_LABEL}>02 · CORE SCREENS · DESKTOP 1440 + MOBILE 390</div>
                <div className="mt-9 flex flex-col gap-[88px]">
                  <CoreRow n="01" name="discover" title="Discover" text="Logged-out landing. Real competitions and recruiting teams in the first viewport." h={[2300, 1700]} screen={() => <Discover />} />
                  <CoreRow n="02" name="explore" title="Explore competitions" text="Category tabs, horizontal filter popovers, live result count." h={[1500, 1500]} screen={() => <Explore />} />
                  <CoreRow
                    n="03"
                    name="comp"
                    title="Competition detail"
                    text="Editorial header, sticky info rail, then “Find your team” as the second half of the page."
                    h={[2500, 1300]}
                    screen={(mobile) => <Competition cid="nbcc" authed tab={mobile ? 'teams' : undefined} />}
                  />
                  <CoreRow n="04" name="team" title="Team detail" text="People first. Match strip explains why this team fits you." h={[1400, 2000]} screen={() => <Team tid="apex" authed />} />
                  <CoreRow n="05" name="foryou" title="For you (logged-in home)" text="Actions first, then recommended competitions, then teams for you." h={[1600, 2700]} screen={() => <ForYou />} />
                  <CoreRow n="06" name="manage" title="Team management" text="Applications, team skill coverage, recommended teammates with reasons." h={[1900, 1600]} screen={() => <Manage />} />
                  <CoreRow n="07" name="people" title="Discover people" text="Search and filter teammates. Rank for yourself or for your team's open roles." h={[1500, 1700]} screen={() => <People rank="vertex" />} />
                  <CoreRow n="08" name="profile" title="Profile · seen by a team leader" text="Trust signals, experience, teams, and fit for your open role." h={[1400, 2100]} screen={() => <Profile pid="raka" />} />
                </div>
              </section>

              <section id="states">
                <div className={SECTION_LABEL}>03 · STATES · APPLY, CONNECTIONS, EMPTY, VALIDATION</div>
                <div className="mt-9 flex w-[1880px] flex-wrap items-start gap-10">
                  <StateFrame title="Apply · desktop modal">
                    <div data-frame="apply-desktop" className="h-[760px] w-[540px] overflow-hidden rounded-[20px] shadow-[0_20px_50px_rgba(15,23,42,.15)]">
                      <ApplySheet tid="apex" />
                    </div>
                  </StateFrame>
                  <StateFrame title="Apply · success">
                    <div data-frame="apply-success" className="h-[560px] w-[540px] overflow-hidden rounded-[20px] shadow-[0_20px_50px_rgba(15,23,42,.15)]">
                      <ApplySheet tid="apex" sent />
                    </div>
                  </StateFrame>
                  <StateFrame title="Apply · mobile bottom sheet">
                    <div data-frame="apply-mobile" className="h-[760px] w-[390px] overflow-hidden rounded-t-[20px] shadow-[0_20px_50px_rgba(15,23,42,.15)]">
                      <ViewportContext.Provider value>
                        <ApplySheet tid="apex" />
                      </ViewportContext.Provider>
                    </div>
                  </StateFrame>
                  <div className="flex w-[420px] flex-col gap-4">
                    <div className="text-[15px] font-extrabold">Validation</div>
                    {(['member', 'applied'] as const).map((block) => (
                      <div key={block} data-frame={'val-' + block} className="h-[250px] overflow-hidden rounded-[18px] shadow-[0_10px_30px_rgba(15,23,42,.1)]">
                        {/* Content height, so the message stays in view in this short crop. */}
                        <div>
                          <ApplySheet tid="apex" block={block} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div data-frame="conn-grid" className="grid w-[1880px] grid-cols-[repeat(4,340px)] gap-6">
                    <div className="col-span-full text-[15px] font-extrabold">Connection request states · Connect → Pending → Accept / Ignore → Connected</div>
                    <PersonTile pid="raka" conn="none" />
                    <PersonTile pid="clara" conn="sent" />
                    <PersonTile pid="nadia" conn="incoming" />
                    <PersonTile pid="rizky" conn="connected" />
                  </div>
                  <StateFrame title="Empty · no teams yet">
                    <Phone name="empty-noteams" h={760}>
                      <Competition cid="eic" tab="teams" noTeams />
                    </Phone>
                  </StateFrame>
                  <StateFrame title="Empty · nothing saved">
                    <StoreContext.Provider value={nothingSaved}>
                      <Phone name="empty-saved" h={600}>
                        <Explore mode="saved" authed />
                      </Phone>
                    </StoreContext.Provider>
                  </StateFrame>
                  <StateFrame title="Explore · mobile filter sheet">
                    <Phone name="explore-sheet" h={760}>
                      <Explore sheet />
                    </Phone>
                  </StateFrame>
                </div>
              </section>
            </div>
          </div>
        </ViewportContext.Provider>
      </NavContext.Provider>
    </StoreContext.Provider>
  );
}

function DirectionRow({ title, chosen, text, wide, children }: { title: string; chosen: string; text: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cx('grid items-start gap-12', wide ? 'grid-cols-[300px_1440px]' : 'grid-cols-[300px_720px_720px]')}>
      <div>
        <div className="text-[26px] font-extrabold tracking-[-0.02em]">{title}</div>
        <div className="mt-3 inline-flex h-[26px] items-center rounded-full bg-success-tint px-2.5 text-[12px] font-extrabold text-success">{chosen}</div>
        <p className="mt-3 mb-0 text-[15px] leading-[1.6] text-slate-700">{text}</p>
      </div>
      {children}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-3.5 text-[13px] font-extrabold text-slate-500">{label}</div>
      {children}
    </div>
  );
}

function Frame({ name, w, h, radius, shadow, children }: { name: string; w: number; h: number; radius: string; shadow?: string; children: ReactNode }) {
  return (
    <div data-frame={name} className={cx('overflow-hidden bg-white', radius, shadow)} style={{ width: w, height: h }}>
      {children}
    </div>
  );
}

function Phone({ name, h, className, children }: { name: string; h: number; className?: string; children: ReactNode }) {
  return (
    <ViewportContext.Provider value>
      {/* The transform makes fixed bars and sheets stay inside the phone. */}
      <div data-frame={name} className={cx('w-[390px] overflow-hidden rounded-[30px] bg-white shadow-[0_0_0_8px_#0F172A] [transform:translateZ(0)]', className)} style={{ height: h }}>
        {children}
      </div>
    </ViewportContext.Provider>
  );
}

function CoreRow({ n, name, title, text, h, screen }: { n: string; name: string; title: string; text: string; h: [number, number]; screen: (mobile: boolean) => ReactNode }) {
  return (
    <div>
      <div className="mb-[18px] flex items-baseline gap-4">
        <span className="font-mono text-[13px] font-bold text-brand">{n}</span>
        <span className="text-[26px] font-extrabold tracking-[-0.02em]">{title}</span>
        <span className="text-[15px] text-slate-600">{text}</span>
      </div>
      <div className="flex items-start gap-12">
        <Frame name={name + '-d'} w={1440} h={h[0]} radius="rounded-[14px]" shadow="shadow-[0_1px_3px_rgba(15,23,42,.08)]">
          {screen(false)}
        </Frame>
        <Phone name={name + '-m'} h={h[1]}>
          {screen(true)}
        </Phone>
      </div>
    </div>
  );
}

function StateFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-3 text-[15px] font-extrabold">{title}</div>
      {children}
    </div>
  );
}
