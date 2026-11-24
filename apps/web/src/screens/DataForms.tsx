import { externalUrl } from '../lib/externalUrl';
import type { ProfileLink } from '../data/types';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router';
import { COMPETITION_BY_ID, ALL_COMPETITIONS, PERSONS, TEAM_BY_ID } from '../data/model';
import { isCompetitionRecruiting } from '../data/selectors';
import { FACULTIES, GROUPS, TEAMS } from '../data/seed';
import { AppLink } from '../app/AppLink';
import { useNav } from '../app/nav';
import { useAppState, useStore } from '../store/store';
import { TopNav } from '../components/TopNav';
import { BottomNav } from '../components/BottomNav';
import { useIsMobile } from '../app/viewport';
const field = 'mt-1.5 box-border h-11 w-full rounded-[10px] border border-field bg-white px-3 text-[14px] text-ink outline-none focus:border-brand';
const button = 'h-11 cursor-pointer rounded-[10px] border-0 bg-brand px-5 text-[14px] font-bold text-white disabled:opacity-50';
function Page({ title, children }: { title: string; children: ReactNode }) {
  const m = useIsMobile();
  const st = useAppState();
  return (
    <div className="min-h-dvh bg-canvas font-sans text-ink">
      <TopNav authed={st.authed} active="" backTitle={m ? title : undefined} />
      <main className="mx-auto box-border max-w-[760px] px-5 pt-9 pb-28">
        <h1 className="mt-0 text-[30px] font-extrabold tracking-[-.03em]">{title}</h1>
        {children}
      </main>
      {m && st.authed && <BottomNav active="profile" />}
    </div>
  );
}
function Input({
  label,
  name,
  initial = '',
  type = 'text',
  required = true,
  max = 300,
  min,
}: {
  label: string;
  name: string;
  initial?: string | number;
  type?: string;
  required?: boolean;
  max?: number;
  min?: number;
}) {
  return (
    <label className="block text-[13px] font-bold text-ink">
      {label}
      <input className={field} name={name} type={type} defaultValue={initial} required={required} maxLength={type === 'number' ? undefined : max} max={type === 'number' ? max : undefined} min={min} />
    </label>
  );
}
function Area({ label, name, initial = '' }: { label: string; name: string; initial?: string }) {
  return (
    <label className="block text-[13px] font-bold text-ink">
      {label}
      <textarea className={field + ' h-28 py-3'} name={name} defaultValue={initial} maxLength={2000} />
    </label>
  );
}
const val = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
/** Trimmed, non-empty, case-insensitively unique entries ("React, react" → "React"). */
const dedupe = (items: string[]) => {
  const seen = new Set<string>();
  return items.map((x) => x.trim()).filter((x) => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()));
};
export function ProfileEditor() {
  const st = useAppState();
  const store = useStore();
  const navigate = useNavigate();
  const p = PERSONS.me;
  const a = st.account!;
  const nav = useNav();
  const ledTeams = Object.keys(st.managed ?? {});
  const [deleteError, setDeleteError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const links: ProfileLink[] = p.links.filter((l) => !['LinkedIn', 'Portfolio', 'Instagram'].includes(l.label) && !l.example);
      for (const [name, label] of [
        ['linkedin', 'LinkedIn'],
        ['portfolio', 'Portfolio'],
        ['instagram', 'Instagram'],
      ]) {
        const raw = val(f, name);
        if (!raw) continue;
        // Accept Instagram handles like @name as well as full links.
        const value = label === 'Instagram' && /^@?[\w.]{1,30}$/.test(raw) && !raw.includes('.') ? `https://www.instagram.com/${raw.replace(/^@/, '')}/` : externalUrl(raw);
        if (!value) throw new Error(`${label} needs a full web address, e.g. ${{ Instagram: '@yourname or instagram.com/yourname', LinkedIn: 'linkedin.com/in/yourname', Portfolio: 'yourname.dev' }[label]}`);
        links.push({ label, value });
      }
      await store.request?.('/profile', 'PUT', {
        name: val(f, 'name'),
        campus: val(f, 'campus'),
        skills: dedupe(val(f, 'skills').split(',')).join(', '),
        availability: val(f, 'avail'),
        about: val(f, 'about'),
        contact: val(f, 'contact'),
        share_contact: f.has('share'),
        presentation: {
          links,
          program: val(f, 'program'),
          fac: val(f, 'fac'),
          roles: dedupe(val(f, 'roles').split(',')),
          interests: dedupe(val(f, 'interests').split(',')),
          level: val(f, 'level'),
        },
      });
      navigate('/u/me');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page title="Edit profile">
      <form onSubmit={submit} className="grid gap-5 rounded-[16px] border border-card bg-white p-6">
        <Input label="Name" name="name" initial={p.name} max={80} />
        <Input label="Campus" name="campus" initial={a.campus} max={120} />
        <Input label="Program" name="program" initial={p.program} />
        <label className="text-[13px] font-bold">
          Faculty
          <select name="fac" defaultValue={p.fac} className={field}>
            {Object.entries(FACULTIES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <Input label="Preferred roles (comma separated)" name="roles" initial={p.roles.join(', ')} required={false} />
        <Input label="Skills (comma separated)" name="skills" initial={p.skills.join(', ')} required={false} max={500} />
        <Input label="Interests (comma separated)" name="interests" initial={p.interests.join(', ')} required={false} />
        <label className="text-[13px] font-bold">
          Availability
          <select name="avail" defaultValue={p.avail} className={field}>
            {['Weekends', 'Weekday evenings', 'Flexible'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="text-[13px] font-bold">
          Experience
          <select name="level" defaultValue={p.level} className={field}>
            {['Beginner', 'Some experience', 'Experienced'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <Area label="About you" name="about" initial={p.about} />
        <fieldset className="grid gap-4 rounded-[12px] border border-field p-4">
          <legend className="text-[13px] font-bold">Public links</legend>
          <p className="m-0 text-[13px] text-slate-500">Optional. These links appear on your profile for signed-in students.</p>
          {[
            ['linkedin', 'LinkedIn'],
            ['portfolio', 'Portfolio'],
            ['instagram', 'Instagram'],
          ].map(([name, label]) => (
            <Input key={name} label={label + ' URL'} name={name} initial={p.links.find((l) => l.label === label && !l.example)?.value || ''} required={false} max={1000} />
          ))}
        </fieldset>
        <Input label="Private contact (email, phone or handle)" name="contact" initial={a.contact} required={false} />
        <label className="flex items-start gap-3 text-[13px] leading-6">
          <input name="share" type="checkbox" defaultChecked={a.share_contact} />
          Enable contact sharing for teams where I consented. Uncheck to revoke across all teams.
        </label>
        {error && (
          <p role="alert" className="text-[14px] text-danger">
            {error}
          </p>
        )}
        <button className={button} disabled={busy}>
          Save profile
        </button>
      </form>
      <section className="mt-7 rounded-[14px] border border-card bg-white p-6">
        <h2 className="mt-0 text-[18px] font-extrabold">Account data</h2>
        <a href="/api/v1/account/export" className="text-[14px] font-bold text-brand">
          Export my data
        </a>
        <details className="mt-4 text-[13px]">
          <summary className="cursor-pointer font-bold text-danger">Delete account</summary>
          <p>Removal is permanent and signs you out.</p>
          {ledTeams.length > 0 && (
            <div className="mb-3 rounded-[10px] bg-amber-50 px-4 py-3 text-amber-900">
              Delete or hand over the teams you lead first:{' '}
              {ledTeams.map((tid, i) => (
                <span key={tid}>
                  {i > 0 && ', '}
                  <AppLink to="manage" args={[tid]} className="font-bold text-amber-900">
                    {TEAM_BY_ID[tid]?.name ?? 'Team'}
                  </AppLink>
                </span>
              ))}
            </div>
          )}
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void store
                .request?.('/account', 'DELETE', { password: val(f, 'password') })
                .then(() => {
                  navigate('/');
                  nav('toast', 'Account deleted');
                })
                .catch((e) => setDeleteError(e.message));
            }}
          >
            <Input name="password" label="Confirm password" type="password" />
            {deleteError && (
              <p role="alert" className="m-0 text-[13px] font-semibold text-danger">
                {deleteError}
              </p>
            )}
            <button className={button + ' bg-danger'}>Delete account permanently</button>
          </form>
        </details>
      </section>
    </Page>
  );
}
export function TeamEditor() {
  const [params] = useSearchParams();
  const { id } = useParams();
  const editing = id ? TEAM_BY_ID[id] : undefined;
  const st = useAppState();
  const store = useStore();
  const navigate = useNavigate();
  const [roles, setRoles] = useState([0]);
  const [next, setNext] = useState(1);
  // One team per competition: hide listings where you're already on a team.
  const openComps = ALL_COMPETITIONS.filter((c) => isCompetitionRecruiting(c.id) && !TEAMS.some((t) => t.comp === c.id && t.members.includes('me')));
  const requested = params.get('competition') || '';
  const [compId, setCompId] = useState(openComps.some((c) => c.id === requested) ? requested : '');
  const chosen = openComps.find((c) => c.id === compId);
  const minCap = Math.max(2, chosen?.min ?? 2);
  const maxCap = Math.max(minCap, chosen?.max ?? 20);
  const [cap, setCap] = useState(minCap);
  const [qty, setQty] = useState<Record<number, number>>({ 0: minCap - 1 });
  const seats = roles.reduce((sum, k) => sum + (qty[k] || 0), 0);
  const pickComp = (cid: string) => {
    setCompId(cid);
    const c = openComps.find((x) => x.id === cid);
    const lo = Math.max(2, c?.min ?? 2),
      hi = Math.max(lo, c?.max ?? 20);
    const n = Math.min(hi, Math.max(lo, cap));
    setCap(n);
    if (roles.length === 1) setQty({ [roles[0]]: n - 1 });
  };
  const clampCap = (n: number) => Math.min(maxCap, Math.max(minCap, Math.round(n) || minCap));
  const changeCap = (n: number) => {
    setCap(n);
    if (roles.length === 1 && n >= minCap && n <= maxCap) setQty({ [roles[0]]: n - 1 });
  };
  const fixCap = () => {
    const n = clampCap(cap);
    if (n !== cap) changeCap(n);
  };
  const capOk = cap >= minCap && cap <= maxCap;
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const presentation = { avail: val(f, 'avail'), level: val(f, 'level'), comms: val(f, 'comms'), lang: val(f, 'lang') };
      const body = {
        name: val(f, 'name'),
        about: val(f, 'about'),
        capacity: Number(f.get('capacity')),
        presentation,
        ...(editing
          ? {}
          : {
              competition_id: val(f, 'competition'),
              share_contact: f.has('share'),
              roles: roles.map((k) => ({ name: val(f, 'role-' + k), skills: val(f, 'skills-' + k), capacity: Number(f.get('qty-' + k)) })),
            }),
      };
      const res = await store.request?.<{ id: string }>(editing ? '/teams/' + id : '/teams', editing ? 'PATCH' : 'POST', body);
      const tid = editing?.id || res!.id;
      navigate('/teams/' + tid + '/manage');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (editing && editing.leader !== 'me') return <Page title="Permission denied">Only team leader can edit this team.</Page>;
  return (
    <Page title={editing ? 'Edit ' + editing.name : 'Create team'}>
      <form onSubmit={submit} className="grid gap-5 rounded-[16px] border border-card bg-white p-6">
        {!editing && requested && !openComps.some((c) => c.id === requested) && (
          <p role="alert" className="m-0 rounded-[10px] bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
            {TEAMS.some((t) => t.comp === requested && t.members.includes('me'))
              ? `You're already on a team for ${COMPETITION_BY_ID[requested]?.title}. Choose another competition below.`
              : `${COMPETITION_BY_ID[requested]?.title || 'That competition'} is closed for new teams. Choose an open competition below.`}
          </p>
        )}
        {!editing && (
          <label className="text-[13px] font-bold">
            Competition
            <select className={field} name="competition" required value={compId} onChange={(e) => pickComp(e.target.value)}>
              <option value="">Choose competition</option>
              {openComps.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.min === c.max ? c.min : c.min + '–' + c.max} members)
                </option>
              ))}
            </select>
          </label>
        )}
        <Input label="Team name" name="name" initial={editing?.name} max={100} />
        <Area label="About your team" name="about" initial={editing?.about} />
        {editing ? (
          <Input
            label="Team capacity (including leader)"
            name="capacity"
            type="number"
            initial={editing.target}
            min={Math.max(2, COMPETITION_BY_ID[editing.comp].min, editing.members.length)}
            max={COMPETITION_BY_ID[editing.comp].max}
          />
        ) : (
          <label className="block text-[13px] font-bold text-ink">
            Team capacity (including leader)
            <input className={field} name="capacity" type="number" required value={cap || ''} min={minCap} max={maxCap} onChange={(e) => changeCap(Number(e.target.value))} onBlur={fixCap} />
            {chosen && (
              <span className="mt-1 block text-[12px] font-medium text-slate-600">
                {chosen.title} allows {minCap}–{maxCap} members.
              </span>
            )}
          </label>
        )}
        <label className="text-[13px] font-bold">
          Availability
          <select name="avail" defaultValue={editing?.avail || 'Weekends'} className={field}>
            {['Weekends', 'Weekday evenings', 'Flexible'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="text-[13px] font-bold">
          Team experience
          <select name="level" defaultValue={editing?.level} className={field}>
            <option>Beginner friendly</option>
            <option>Experienced preferred</option>
          </select>
        </label>
        <Input label="Communication platform" name="comms" initial={editing?.comms || 'WhatsApp'} />
        <Input label="Language" name="lang" initial={editing?.lang || 'English'} />
        {!editing &&
          roles.map((k, i) => (
            <fieldset key={k} className="grid gap-4 rounded-[12px] border border-field p-4">
              <legend className="text-[13px] font-bold">Role {i + 1}</legend>
              <Input label={`Role ${i + 1} name`} name={'role-' + k} max={80} />
              <Input label={`Role ${i + 1} skills`} name={'skills-' + k} required={false} max={500} />
              <label className="block text-[13px] font-bold text-ink">
                {`Role ${i + 1} seats`}
                <input className={field} name={'qty-' + k} type="number" required value={qty[k] || ''} min={1} max={19} onChange={(e) => setQty({ ...qty, [k]: Number(e.target.value) })} />
              </label>
              {roles.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setRoles(roles.filter((r) => r !== k));
                    const { [k]: _, ...rest } = qty;
                    void _;
                    setQty(rest);
                  }}
                  className="text-[13px] font-semibold text-danger"
                >
                  Remove role
                </button>
              )}
            </fieldset>
          ))}
        {!editing && (
          <>
            <button
              type="button"
              className="h-10 cursor-pointer rounded-[10px] border border-field bg-white text-[13px] font-bold"
              onClick={() => {
                setRoles([...roles, next]);
                // Give the new role any unassigned seats; with none left, grow capacity if the competition allows.
                const free = cap - 1 - seats;
                if (free <= 0 && cap < maxCap) setCap(cap + 1);
                setQty({ ...qty, [next]: Math.max(1, free) });
                setNext(next + 1);
              }}
              disabled={roles.length >= 19}
            >
              Add role
            </button>
            <p role="status" className={'m-0 text-[13px] font-semibold ' + (capOk && seats === cap - 1 ? 'text-success' : 'text-danger')}>
              {capOk ? `Role seats assigned: ${seats} of ${cap - 1} (team capacity minus your seat).` : `Team capacity must be ${minCap}–${maxCap}.`}
            </p>
            <label className="flex gap-3 text-[13px]">
              <input type="checkbox" name="share" />
              Share my contact with accepted members (profile sharing must also be enabled).
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="text-[14px] text-danger">
            {error}
          </p>
        )}
        <button className={button} disabled={busy || (!editing && (!capOk || seats !== cap - 1))}>
          {editing ? 'Save team' : 'Create team'}
        </button>
      </form>
      {editing && (
        <details className="mt-6 rounded-[14px] border border-card bg-white p-5">
          <summary className="cursor-pointer text-[14px] font-bold text-danger">Delete team</summary>
          <p className="text-[13px]">Permanently remove team, applications and memberships.</p>
          <label className="block text-[13px] font-bold">
            Type {editing.name} to confirm
            <input className={field} value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} />
          </label>
          <button
            disabled={deleteConfirmation !== editing.name}
            className={button + ' mt-4 bg-danger'}
            onClick={() => {
              void store
                .request?.('/teams/' + id, 'DELETE', {})
                .then(() => navigate('/for-you'))
                .catch((e) => setError(e.message));
            }}
          >
            Delete team permanently
          </button>
        </details>
      )}
      <p className="text-[12px] text-slate-500">Signed in as {st.account?.name}</p>
    </Page>
  );
}
interface CuratedCompetition {
  id: string;
  title: string;
  organizer: string;
  description: string;
  official_url: string;
  deadline: string;
  min_members: number;
  max_members: number;
  campus: string;
  published: boolean;
  presentation?: { cat?: string; group?: string; loc?: string; place?: string; fee?: number; open?: string; event?: string; poster?: string; skills?: string[] };
}
interface Report {
  id: string;
  team_id: string;
  team_name: string;
  reason: string;
  resolved: boolean;
  moderated: boolean;
  created_at: string;
}
const METRICS: [key: string, label: string, format: (v: number) => string][] = [
  ['signups', 'Accounts', String],
  ['teams', 'Teams', String],
  ['applications', 'Applications', String],
  ['accepted', 'Accepted', String],
  ['acceptance_rate', 'Acceptance rate', (v) => Math.round(v * 100) + '%'],
  ['median_response_hours', 'Median response time', (v) => (v < 1 ? Math.max(1, Math.round(v * 60)) + ' min' : v < 48 ? v.toFixed(1) + ' h' : (v / 24).toFixed(1) + ' days')],
  ['connected_teams', 'Teams that connected', String],
];
const panel = 'mt-6 rounded-[16px] border border-card bg-white p-6';
const localDate = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export function Privacy() {
  return (
    <Page title="Privacy and account data">
      <section className={panel + ' text-[14px] leading-7'}>
        <p>
          Team rosters show member names and roles publicly. Full profiles (introduction, campus, links) are visible only to signed-in students. Email, contact details and application messages
          are private: messages are visible to the applicant and team leader, and admins can review submitted team reports.
        </p>
        <p>
          Contacts are visible only to members of the same team when both profile sharing and team consent are enabled. Revoke profile sharing at any time. Other members may retain contacts already
          viewed.
        </p>
        <p>
          Export or delete your account from Edit profile. Delete teams you lead first. Anonymous action counts remain for metrics; reports retain moderation history without reporter identity after
          deletion.
        </p>
      </section>
    </Page>
  );
}
export function AdminCuration() {
  const store = useStore();
  const st = useAppState();
  const nav = useNav();
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<CuratedCompetition>();
  const [competitions, setCompetitions] = useState<CuratedCompetition[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [metrics, setMetrics] = useState<Record<string, unknown>>({});
  const load = async () => {
    const [c, r, m] = await Promise.all([store.request!<CuratedCompetition[]>('/competitions'), store.request!<Report[]>('/admin/reports'), store.request!<Record<string, unknown>>('/admin/metrics')]);
    setCompetitions(c);
    setReports(r);
    setMetrics(m);
  };
  useEffect(() => {
    if (!st.account?.admin) return;
    let active = true;
    void Promise.all([store.request!<CuratedCompetition[]>('/competitions'), store.request!<Report[]>('/admin/reports'), store.request!<Record<string, unknown>>('/admin/metrics')])
      .then(([c, r, m]) => {
        if (active) {
          setCompetitions(c);
          setReports(r);
          setMetrics(m);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [st.account?.admin, store]);
  // Form errors render next to the Save button; other actions report through toasts.
  const run = async (fn: () => Promise<unknown>, message: string, form = false) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      await load();
      if (form) {
        setNotice(message);
        if (!editing) setFormKey((k) => k + 1);
      } else nav('toast', message);
    } catch (e) {
      if (form) setError((e as Error).message);
      else nav('toastError', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!st.account?.admin) return <Page title="Permission denied">Admin access required.</Page>;
  return (
    <Page title="Curate competition">
      <form
        key={editing?.id || 'new-' + formKey}
        className="grid gap-5 rounded-[16px] border border-card bg-white p-6"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(
            () =>
              store.request!(editing ? '/competitions/' + editing.id : '/competitions', editing ? 'PUT' : 'POST', {
                title: val(f, 'title'),
                organizer: val(f, 'organizer'),
                description: val(f, 'description'),
                official_url: val(f, 'url'),
                deadline: new Date(val(f, 'deadline')).toISOString(),
                min_members: Number(f.get('min')),
                max_members: Number(f.get('max')),
                campus: val(f, 'campus'),
                published: f.has('published'),
                presentation: {
                  group: val(f, 'group'),
                  cat: val(f, 'cat') || val(f, 'group'),
                  loc: val(f, 'loc'),
                  place: val(f, 'place') || (val(f, 'loc') === 'Online' ? 'Online' : ''),
                  fee: Number(f.get('fee') || 0),
                  open: val(f, 'open'),
                  event: val(f, 'event'),
                  poster: val(f, 'poster'),
                  skills: val(f, 'skills')
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean),
                },
              }),
            editing ? 'Competition updated' : 'Competition created',
            true,
          );
        }}
      >
        <h2 className="m-0 text-[18px] font-extrabold">{editing ? 'Edit competition' : 'New competition'}</h2>
        <Input label="Title" name="title" initial={editing?.title} max={160} />
        <Input label="Organizer" name="organizer" initial={editing?.organizer} max={160} />
        <Area label="Description" name="description" initial={editing?.description} />
        <Input label="Official URL" name="url" type="url" initial={editing?.official_url} max={1000} />
        <Input label="Application deadline (your local time)" name="deadline" type="datetime-local" initial={editing ? localDate(editing.deadline) : ''} />
        <Input label="Minimum members" name="min" type="number" initial={editing?.min_members || 2} min={2} max={20} />
        <Input label="Maximum members" name="max" type="number" initial={editing?.max_members || 5} min={2} max={20} />
        <Input label="Campus restriction (blank = all)" name="campus" initial={editing?.campus} required={false} />
        <fieldset className="grid gap-4 rounded-[12px] border border-field p-4">
          <legend className="text-[13px] font-bold">Listing details</legend>
          <label className="text-[13px] font-bold">
            Category group
            <select name="group" defaultValue={editing?.presentation?.group || 'Technology'} className={field}>
              {GROUPS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <Input label="Category label (e.g. Hackathon, Business Case)" name="cat" initial={editing?.presentation?.cat} required={false} max={60} />
          <label className="text-[13px] font-bold">
            Format
            <select name="loc" defaultValue={editing?.presentation?.loc || 'Online'} className={field}>
              {['Online', 'Offline', 'Hybrid'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <Input label="Venue or city (blank for online)" name="place" initial={editing?.presentation?.place} required={false} max={120} />
          <Input label="Registration fee per team (Rp, 0 = free)" name="fee" type="number" initial={editing?.presentation?.fee ?? 0} min={0} max={100000000} />
          <Input label="Registration opens" name="open" type="date" initial={editing?.presentation?.open} required={false} />
          <Input label="Event date" name="event" type="date" initial={editing?.presentation?.event} required={false} />
          <Input label="Poster image URL (https)" name="poster" type="url" initial={editing?.presentation?.poster} required={false} max={1000} />
          <Input label="Key skills (comma separated)" name="skills" initial={editing?.presentation?.skills?.join(', ')} required={false} max={500} />
        </fieldset>
        <label className="flex gap-3 text-[13px]">
          <input type="checkbox" name="published" defaultChecked={editing?.published ?? true} />
          Published
        </label>
        {error && (
          <p role="alert" className="m-0 rounded-[10px] bg-red-50 px-4 py-3 text-[14px] font-semibold text-danger">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="m-0 text-[14px] font-semibold text-success">
            {notice}
          </p>
        )}
        <button className={button} disabled={busy}>
          {editing ? 'Save changes' : 'Create competition'}
        </button>
        {editing && (
          <button type="button" className={button + ' bg-ink'} onClick={() => setEditing(undefined)}>
            Cancel edit
          </button>
        )}
      </form>
      <section className={panel}>
        <h2 className="mt-0 text-[18px] font-extrabold">Curated competitions</h2>
        {competitions.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3 text-[13px]">
            <span>
              {c.title} · {c.published ? 'Published' : 'Unpublished'}
            </span>
            <button
              className="cursor-pointer border-0 bg-transparent font-bold text-brand"
              onClick={() => {
                setEditing(c);
                setError('');
                setNotice('');
                window.scrollTo({ top: 0 });
              }}
            >
              Edit {c.title}
            </button>
          </div>
        ))}
      </section>
      <section className={panel}>
        <h2 className="mt-0 text-[18px] font-extrabold">Moderation reports</h2>
        {!reports.length && <p className="text-[14px] text-slate-500">No reports.</p>}
        {reports.map((r) => (
          <div key={r.id} className="border-t border-line py-4 text-[14px]">
            <h3 className="m-0 text-[15px]">
              <AppLink to="team" args={[r.team_id]} className="text-ink">
                {r.team_name}
              </AppLink>
            </h3>
            <p className="my-1.5 text-slate-500">
              Reported {new Date(r.created_at).toLocaleString()} · {r.resolved ? 'Resolved' : 'Open'} · Team {r.moderated ? 'hidden' : 'visible'}
            </p>
            <p className="my-2 whitespace-pre-line">{r.reason}</p>
            <div className="flex flex-wrap gap-3">
              {(!r.resolved || !r.moderated) && (
                <button className={button} disabled={busy} onClick={() => void run(() => store.request!('/admin/reports/' + r.id + '/resolve', 'POST', { hide_team: true }), 'Team hidden; report resolved')}>
                  Hide team
                </button>
              )}
              {(!r.resolved || r.moderated) && (
                <button
                  className={button + ' bg-ink'}
                  disabled={busy}
                  onClick={() => void run(() => store.request!('/admin/reports/' + r.id + '/resolve', 'POST', { hide_team: false }), r.moderated ? 'Team restored' : 'Report dismissed')}
                >
                  {r.moderated ? 'Restore team' : 'Dismiss report'}
                </button>
              )}
            </div>
          </div>
        ))}
      </section>
      <section className={panel}>
        <h2 className="mt-0 text-[18px] font-extrabold">Formation metrics</h2>
        <dl className="grid grid-cols-2 gap-3 text-[14px]">
          {METRICS.map(([k, label, format]) => (
            <div key={k}>
              <dt className="text-slate-500">{label}</dt>
              <dd className="m-0 font-bold">{metrics[k] == null ? '—' : format(Number(metrics[k]))}</dd>
            </div>
          ))}
        </dl>
        <button className="cursor-pointer border-0 bg-transparent text-[14px] font-bold text-brand" onClick={() => void load().catch((e) => setError(e.message))}>
          Refresh admin data
        </button>
      </section>
    </Page>
  );
}
