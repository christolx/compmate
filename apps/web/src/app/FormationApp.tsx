import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router';
import './formation.css';
import { rankEligibleTeams } from './formation-matching';
interface Profile {
    id: string;
    email: string;
    name: string;
    campus: string;
    skills: string;
    availability: string;
    about: string;
    contact: string;
    share_contact: boolean;
    admin: boolean;
}
interface Competition {
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
}
interface Role {
    id: string;
    name: string;
    skills: string;
    capacity: number;
    filled: number;
}
interface Team {
    id: string;
    name: string;
    about: string;
    competition_id: string;
    competition_title: string;
    leader_id: string;
    leader_name: string;
    deadline: string;
    campus: string;
    capacity: number;
    recruiting: boolean;
    moderated: boolean;
    eligible: boolean;
    member_count: number;
    roles: Role[];
    members: {
        id: string;
        name: string;
        role: string;
    }[];
}
interface Application {
    id: string;
    team_id: string;
    team_name: string;
    name: string;
    skills: string;
    role_name: string;
    message: string;
    status: string;
    created_at: string;
}
interface Notification {
    id: string;
    team_id: string;
    text: string;
    read_at: string | null;
}
interface Dashboard {
    teams: Team[];
    applications: Application[];
    inbox: Application[];
    notifications: Notification[];
}
interface Data {
    me: Profile | null;
    competitions: Competition[];
    teams: Team[];
    dashboard: Dashboard;
}
const emptyDashboard: Dashboard = { teams: [], applications: [], inbox: [], notifications: [] };
class APIError extends Error {
    status: number;
    constructor(message: string, status: number) { super(message); this.status = status; }
}
async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    let response: Response;
    try {
        response = await fetch(`/api/v1${path}`, { method, credentials: 'same-origin', headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) });
    }
    catch {
        throw new APIError('Network unavailable. Check connection, then retry.', 0);
    }
    let value: T & {
        error?: string;
    };
    try {
        value = await response.json();
    }
    catch {
        throw new APIError('API unavailable. Retry shortly.', response.status);
    }
    if (!response.ok)
        throw new APIError(value.error ?? 'Request failed', response.status);
    return value;
}
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Request failed';
const date = (s: string) => new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
function fields(e: FormEvent<HTMLFormElement>) { e.preventDefault(); return new FormData(e.currentTarget); }
function value(f: FormData, key: string) { return String(f.get(key) ?? '').trim(); }
function Field({ label, name, type = 'text', initial = '', required = true, max = 300, min }: {
    label: string;
    name: string;
    type?: string;
    initial?: string | number;
    required?: boolean;
    max?: number;
    min?: number;
}) { return <label>{label}<input name={name} type={type} defaultValue={initial} required={required} maxLength={type === 'number' ? undefined : max} minLength={type === 'password' ? 10 : undefined} min={min} max={type === 'number' ? max : undefined} autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'email' : undefined}/></label>; }
function Textarea({ label, name, initial = '', required = false, min = 0 }: {
    label: string;
    name: string;
    initial?: string;
    required?: boolean;
    min?: number;
}) { return <label>{label}<textarea name={name} defaultValue={initial} required={required} minLength={min} maxLength={2000} rows={4}/></label>; }
function Check({ name, children, checked = false }: {
    name: string;
    children: ReactNode;
    checked?: boolean;
}) { return <label className="check"><input type="checkbox" name={name} defaultChecked={checked}/>{children}</label>; }
function Panel({ title, children }: {
    title: string;
    children: ReactNode;
}) { return <section className="panel"><h2>{title}</h2>{children}</section>; }
interface Actions {
    busy: boolean;
    run: (path: string, method: string, body: unknown, success: string, next?: string) => Promise<boolean>;
}
export function FormationApp() {
    const [data, setData] = useState<Data>({ me: null, competitions: [], teams: [], dashboard: emptyDashboard });
    const [loaded, setLoaded] = useState(false);
    const [version, setVersion] = useState(0);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    useEffect(() => {
        let active = true;
        async function load() {
            try {
                const me = await api<Profile>('/me').catch(e => { if (e instanceof APIError && e.status === 401)
                    return null; throw e; });
                const [competitions, teams, dashboard] = await Promise.all([api<Competition[]>('/competitions'), api<Team[]>('/teams'), me ? api<Dashboard>('/dashboard') : Promise.resolve(emptyDashboard)]);
                if (active) {
                    setData({ me, competitions, teams, dashboard });
                    setLoaded(true);
                }
            }
            catch (e) {
                if (active) {
                    setError(errorText(e));
                    setLoaded(true);
                }
            }
        }
        void load();
        const timer = window.setInterval(() => { void load(); }, 30000);
        return () => { active = false; clearInterval(timer); };
    }, [version]);
    const refresh = () => { setError(''); setVersion(x => x + 1); };
    async function run(path: string, method: string, body: unknown, success: string, next?: string) {
        if (busy)
            return false;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const res = await api<{
                id?: string;
            }>(path, method, body);
            setNotice(success);
            setVersion(x => x + 1);
            if (next)
                navigate(next === '/teams/new-result' ? `/teams/${res.id}` : next);
            return true;
        }
        catch (e) {
            setError(errorText(e));
            if (e instanceof APIError && e.status === 401)
                setVersion(x => x + 1);
            return false;
        }
        finally {
            setBusy(false);
        }
    }
    const actions = { run, busy };
    const auth = (children: ReactNode) => data.me ? children : <Panel title="Sign in to continue"><Link className="button" to="/login">Sign in</Link> <Link to="/signup">Create account</Link></Panel>;
    return <div className="formation">
    <a className="skip" href="#main">Skip to content</a>
    <header><Link className="logo" to="/">Comp<span>Mate</span></Link><nav aria-label="Main navigation"><Link to="/competitions">Competitions</Link>{data.me && <><Link to="/for-you">Dashboard{data.dashboard.notifications.some(n => !n.read_at) ? ' •' : ''}</Link><Link to="/u/me">Profile</Link>{data.me.admin && <Link to="/admin">Admin</Link>}</>}</nav><div className="account">{data.me ? <><span>{data.me.name}</span><button disabled={busy} onClick={() => { void run('/logout', 'POST', {}, 'Signed out', '/'); }}>Log out</button></> : <><Link to="/login">Sign in</Link><Link className="button" to="/signup">Sign up</Link></>}</div></header>
    <main id="main"><div className="feedback">{error && <div className="error" role="alert">{error} <button onClick={refresh}>Retry / refresh</button></div>}{notice && <p className="notice" role="status">{notice}</p>}</div>
      {!loaded ? <p role="status">Loading CompMate…</p> : <Routes>
        <Route path="/" element={<Explore data={data}/>}/>
        <Route path="/competitions" element={<Explore data={data}/>}/>
        <Route path="/competitions/:id" element={<CompetitionPage data={data}/>}/>
        <Route path="/login" element={<Auth mode="login" {...actions}/>}/>
        <Route path="/signup" element={<Auth mode="signup" {...actions}/>}/>
        <Route path="/for-you" element={auth(<DashboardPage data={data} refresh={refresh} {...actions}/>)}/>
        <Route path="/teams/new" element={auth(<CreateTeam data={data} {...actions}/>)}/>
        <Route path="/teams/:id" element={<TeamPage key={window.location.pathname} data={data} {...actions}/>}/>
        <Route path="/teams/:id/manage" element={auth(<TeamPage key={window.location.pathname} data={data} {...actions}/>)}/>
        <Route path="/u/me" element={auth(data.me && <ProfilePage key={data.me.id} me={data.me} {...actions}/>)}/>
        <Route path="/privacy" element={<Panel title="Privacy and account data"><p>Profiles and team rosters show names publicly. Email, contact details and application messages are private. Messages are visible to applicant and team leader; admins can review submitted team reports.</p><p>Contacts are visible only to members of the same team when both profile sharing and team consent are enabled. Revoke profile sharing at any time. Other members may retain contacts they already viewed.</p><p>Export or delete your account from Profile. Delete teams you lead first. Anonymous action counts remain for pilot metrics; reports retain moderation history without reporter identity after deletion.</p></Panel>}/>
        <Route path="/admin" element={data.me?.admin ? <Admin key={version} competitions={data.competitions} {...actions}/> : <Panel title="Permission denied">Admin access required.</Panel>}/>
        <Route path="*" element={<Panel title="Page not found"><Link to="/competitions">Explore competitions</Link></Panel>}/>
      </Routes>}
    </main><footer>CompMate · Find competitions. Build your team. <Link to="/privacy">Privacy</Link></footer>
  </div>;
}
function Auth({ mode, busy, run }: Actions & {
    mode: 'login' | 'signup';
}) {
    const signup = mode === 'signup';
    return <div className="narrow"><p className="eyebrow">YOUR NEXT TEAM STARTS HERE</p><h1>{signup ? 'Create your account' : 'Welcome back'}</h1><form key={mode} onSubmit={e => { const f = fields(e); void run(`/${mode}`, 'POST', { email: value(f, 'email'), password: String(f.get('password')), ...(signup ? { name: value(f, 'name') } : {}) }, signup ? 'Account created' : 'Signed in', '/for-you'); }}>
    {signup && <Field label="Name" name="name" max={80}/>}<Field label="Email" name="email" type="email" max={254}/><Field label="Password" name="password" type="password" max={72}/><p>Passwords need 10–72 characters. Contacts stay private until you consent and join a team.</p><button className="primary" disabled={busy}>{busy ? 'Saving…' : signup ? 'Create account' : 'Sign in'}</button></form><p>{signup ? 'Already registered?' : 'New to CompMate?'} <Link to={signup ? '/login' : '/signup'}>{signup ? 'Sign in' : 'Create account'}</Link></p></div>;
}
function Explore({ data }: {
    data: Data;
}) {
    const [query, setQuery] = useState('');
    const visible = data.competitions.filter(c => c.published && `${c.title} ${c.organizer}`.toLowerCase().includes(query.toLowerCase()));
    return <><div className="intro"><p className="eyebrow">COMPETITIONS & PEOPLE, CONNECTED</p><h1>Find your next challenge.<br /><span>Build your team.</span></h1><p>Explore curated competitions, find open roles, and connect after your application is accepted.</p></div><div className="section-head"><h2>Explore competitions</h2><label className="search">Search<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Competition or organizer"/></label></div><div className="competition-grid">{visible.map(c => <article className="competition-card" key={c.id}><div className="card-top"><span>{c.organizer}</span><span className="badge">{new Date(c.deadline) > new Date() ? 'Open' : 'Deadline passed'}</span></div><h2><Link to={`/competitions/${c.id}`}>{c.title}</Link></h2><p>{c.description}</p><dl><dt>Apply by</dt><dd>{date(c.deadline)}</dd><dt>Team size</dt><dd>{c.min_members}–{c.max_members} students</dd><dt>Eligibility</dt><dd>{c.campus || 'All campuses'}</dd></dl><Link className="button" to={`/competitions/${c.id}`}>Find your team →</Link></article>)}</div>{visible.length === 0 && <Panel title="No competitions yet">Admins add verified official competitions before recruitment starts.</Panel>}</>;
}
function CompetitionPage({ data }: {
    data: Data;
}) {
    const { id } = useParams();
    const c = data.competitions.find(c => c.id === id);
    if (!c)
        return <Panel title="Competition unavailable"><Link to="/competitions">Explore competitions</Link></Panel>;
    const teams = data.teams.filter(t => t.competition_id === id);
    const ranked = rankEligibleTeams(teams, data.me?.skills ?? '');
    const unavailable = teams.filter(t => !t.eligible);
    return <><Link to="/competitions">← Competitions</Link><div className="intro"><p className="eyebrow">{c.organizer}</p><h1>{c.title}</h1><p>{c.description}</p><p>Deadline: {date(c.deadline)} · {c.min_members}–{c.max_members} members · {c.campus || 'All campuses'}</p><a className="button secondary" href={c.official_url} target="_blank" rel="noreferrer">Official competition ↗</a></div><div className="section-head"><h2>Find your team</h2>{new Date(c.deadline) > new Date() && <Link className="button" to={`/teams/new?competition=${c.id}`}>Create team</Link>}</div><div className="team-grid">{ranked.map(({ team, skills }) => <TeamCard key={team.id} team={team} match={skills}/>)}{unavailable.map(t => <TeamCard key={t.id} team={t}/>)}</div>{teams.length === 0 && <p>No teams yet. Start one and recruit your teammates.</p>}</>;
}
function TeamCard({ team: t, match = [] }: {
    team: Team;
    match?: string[];
}) { return <article className="panel"><div className="card-top"><span>{t.competition_title}</span><span className="badge">{t.member_count}/{t.capacity} members</span></div><h2><Link to={`/teams/${t.id}`}>{t.name}</Link></h2><p>{t.about}</p><p>Led by {t.leader_name}</p><p>{t.roles.map(r => `${r.name} (${r.capacity - r.filled} open)`).join(' · ')}</p>{match.length > 0 && <p className="match">Matches your skills: {match.join(', ')}</p>}<Link to={`/teams/${t.id}`}>View team →</Link></article>; }
function CreateTeam({ data, busy, run }: Actions & {
    data: Data;
}) {
    const [roles, setRoles] = useState([0]);
    const [nextKey, setNextKey] = useState(1);
    const selected = new URLSearchParams(window.location.search).get('competition') ?? '';
    return <div className="narrow"><h1>Create your team</h1><p>You take one seat as leader. Open role seats must total capacity minus one.</p><form onSubmit={e => { const f = fields(e); void run('/teams', 'POST', { competition_id: value(f, 'competition'), name: value(f, 'name'), about: value(f, 'about'), capacity: Number(f.get('capacity')), share_contact: f.has('share'), roles: roles.map(k => ({ name: value(f, `role-${k}`), skills: value(f, `skills-${k}`), capacity: Number(f.get(`seats-${k}`)) })) }, 'Team created', '/teams/new-result'); }}>
    <label>Competition<select name="competition" defaultValue={selected} required><option value="">Choose competition</option>{data.competitions.filter(c => c.published && new Date(c.deadline) > new Date() && (!c.campus || c.campus === data.me?.campus)).map(c => <option key={c.id} value={c.id}>{c.title} ({c.min_members}–{c.max_members} members)</option>)}</select></label>
    <Field label="Team name" name="name" max={100}/><Textarea label="About your team" name="about"/><Field label="Team capacity (including leader)" name="capacity" type="number" initial={2} min={2} max={20}/>
    {roles.map((k, i) => <fieldset key={k}><legend>Open role {i + 1}</legend><Field label={`Role ${i + 1} name`} name={`role-${k}`} max={80}/><Field label={`Role ${i + 1} skills (comma separated)`} name={`skills-${k}`} max={500} required={false}/><Field label={`Role ${i + 1} seats`} name={`seats-${k}`} type="number" initial={1} min={1} max={19}/>{roles.length > 1 && <button type="button" onClick={() => setRoles(roles.filter(x => x !== k))}>Remove role {i + 1}</button>}</fieldset>)}
    <button type="button" disabled={roles.length >= 19} onClick={() => { setRoles([...roles, nextKey]); setNextKey(nextKey + 1); }}>Add role</button>
    <Check name="share">Share my contact with members of this team. Profile sharing must also be enabled.</Check><button className="primary" disabled={busy}>Create team</button>
  </form></div>;
}
function DashboardPage({ data, refresh, busy, run }: Actions & {
    data: Data;
    refresh: () => void;
}) {
    return <><div className="section-head"><div><p className="eyebrow">YOUR TEAM FORMATION</p><h1>Hi, {data.me?.name.split(' ')[0]}.</h1></div><button onClick={refresh}>Refresh</button></div><Link className="button" to="/teams/new">Create team</Link><p><Link to="/u/me">Complete your profile</Link> with campus, skills and private contact details.</p>
    <Panel title="Application alerts">{data.dashboard.notifications.length ? <><ul className="rows">{data.dashboard.notifications.map(n => <li key={n.id}><Link to={`/teams/${n.team_id}`}>{n.text}</Link>{!n.read_at && <span className="badge">New</span>}</li>)}</ul><button disabled={busy} onClick={() => { void run('/notifications/read', 'POST', {}, 'Alerts marked read'); }}>Mark alerts read</button></> : <p>No alerts yet.</p>}</Panel>
    <h2>Your teams</h2><div className="team-grid">{data.dashboard.teams.map(t => <TeamCard key={t.id} team={t}/>)}</div>{!data.dashboard.teams.length && <p>No team yet. Explore competitions to get started.</p>}
    <Panel title="Your applications">{!data.dashboard.applications.length && <p>No applications yet.</p>}{data.dashboard.applications.map(a => <div className="application" key={a.id}><h3><Link to={`/teams/${a.team_id}`}>{a.team_name}</Link> · {a.role_name}</h3><span className="badge">{a.status}</span><p>{a.message}</p>{a.status === 'pending' && <button disabled={busy} onClick={() => { void run(`/applications/${a.id}/withdraw`, 'POST', {}, 'Application withdrawn'); }}>Withdraw</button>}</div>)}<p>Only pending applications can be withdrawn. One application per team; withdrawal is final. Accepted membership ends through account deletion or team deletion.</p></Panel>
    <Panel title="Leader inbox">{!data.dashboard.inbox.length && <p>No applications received yet.</p>}{data.dashboard.inbox.map(a => <div className="application" key={a.id}><h3>{a.name} → <Link to={`/teams/${a.team_id}`}>{a.team_name}</Link></h3><p>{a.role_name} · {a.skills || 'No skills listed'} · {a.status}</p><p>{a.message}</p>{a.status === 'pending' && <div className="actions"><button className="primary" disabled={busy} onClick={() => { void run(`/applications/${a.id}/accept`, 'POST', {}, 'Application accepted'); }}>Accept {a.name}</button><button disabled={busy} onClick={() => { void run(`/applications/${a.id}/decline`, 'POST', {}, 'Application declined'); }}>Decline {a.name}</button></div>}</div>)}</Panel>
  </>;
}
function TeamPage({ data, busy, run }: Actions & {
    data: Data;
}) {
    const { id } = useParams();
    const t = data.dashboard.teams.find(t => t.id === id) ?? data.teams.find(t => t.id === id);
    const [contacts, setContacts] = useState<{
        id: string;
        name: string;
        contact: string | null;
    }[] | null>(null);
    const [contactError, setContactError] = useState('');
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    if (!t)
        return <Panel title="Team unavailable"><Link to="/competitions">Explore competitions</Link></Panel>;
    const member = t.members.some(m => m.id === data.me?.id);
    const leader = t.leader_id === data.me?.id;
    const application = data.dashboard.applications.find(a => a.team_id === t.id);
    return <><Link to={`/competitions/${t.competition_id}`}>← {t.competition_title}</Link><div className="intro"><p className="eyebrow">{t.member_count}/{t.capacity} MEMBERS · {t.recruiting ? 'RECRUITING' : 'RECRUITMENT CLOSED'}{t.moderated ? ' · HIDDEN BY MODERATOR' : ''}</p><h1>{t.name}</h1><p>{t.about}</p><p>Deadline: {date(t.deadline)} · {t.campus || 'All campuses'}</p></div><div className="two-col"><div><Panel title="Open roles">{t.roles.map(r => <div className="application" key={r.id}><h3>{r.name}</h3><p>{r.skills || 'All skills welcome'} · {r.capacity - r.filled} of {r.capacity} seats open</p></div>)}</Panel><Panel title="Team roster"><ul className="rows">{t.members.map(m => <li key={m.id}>{m.name}<span>{m.role}</span></li>)}</ul></Panel></div><div>
    {leader && <Panel title="Manage recruitment"><button disabled={busy} onClick={() => { void run(`/teams/${t.id}`, 'PATCH', { recruiting: !t.recruiting }, t.recruiting ? 'Recruitment closed' : 'Recruitment opened'); }}>{t.recruiting ? 'Close recruitment' : 'Open recruitment'}</button><p><Link to="/for-you">Review applications in leader inbox</Link></p><details><summary>Delete team</summary><p>This permanently removes team, applications and memberships.</p><form onSubmit={e => { const f = fields(e); if (value(f, 'confirm') === t.name)
        void run(`/teams/${t.id}`, 'DELETE', {}, 'Team deleted', '/for-you'); }}><label>Type {t.name} to confirm<input name="confirm" value={deleteConfirmation} onChange={e => setDeleteConfirmation(e.target.value)} required/></label><button disabled={busy || deleteConfirmation !== t.name} className="danger">Delete team permanently</button></form></details></Panel>}
    {member ? <Panel title="Member contacts"><p>Contacts appear only when both profile sharing and team consent are enabled. Refresh contacts for latest consent.</p><button onClick={() => { setContactError(''); void api<{
        id: string;
        name: string;
        contact: string | null;
    }[]>(`/teams/${t.id}/contacts`).then(setContacts).catch(e => setContactError(errorText(e))); }}>Show / refresh contacts</button>{contactError && <p role="alert">{contactError}</p>}{contacts && <ul className="rows">{contacts.map(c => <li key={c.id}>{c.name}<span>{c.contact || 'Contact not shared'}</span></li>)}</ul>}<button disabled={busy || t.member_count < 2} onClick={() => { void run(`/teams/${t.id}/connected`, 'POST', {}, 'Connection confirmed. Thank you!'); }}>We connected</button></Panel> : application ? <Panel title={`Application ${application.status}`}><p>{application.message}</p><Link to="/for-you">View application</Link></Panel> : data.me && t.eligible ? <Panel title="Apply to join"><form onSubmit={e => { const f = fields(e); void run(`/teams/${t.id}/applications`, 'POST', { role_id: value(f, 'role'), message: value(f, 'message'), share_contact: f.has('share') }, 'Application submitted'); }}><label>Role<select required name="role">{t.roles.filter(r => r.filled < r.capacity).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><Textarea label="Application message" name="message" min={10} required/><Check name="share">Share my contact with team members after acceptance. Enable profile sharing too.</Check><button className="primary" disabled={busy}>Submit application</button></form></Panel> : <Panel title="Applications unavailable"><p>{data.me ? 'Team closed, full, expired, or campus eligibility does not match your profile.' : 'Sign in to check eligibility and apply.'}</p>{!data.me && <Link className="button" to="/login">Sign in</Link>}</Panel>}
    {data.me && <details className="panel"><summary>Report this team</summary><form onSubmit={e => { const f = fields(e); void run('/reports', 'POST', { team_id: t.id, reason: value(f, 'reason') }, 'Report submitted for moderation'); }}><Textarea label="Report reason" name="reason" min={10} required/><button disabled={busy}>Submit report</button></form></details>}
  </div></div></>;
}
function ProfilePage({ me, busy, run }: Actions & {
    me: Profile;
}) {
    return <div className="narrow"><h1>Your profile</h1><p>{me.email}</p><form onSubmit={e => { const f = fields(e); void run('/profile', 'PUT', { name: value(f, 'name'), campus: value(f, 'campus'), skills: value(f, 'skills'), availability: value(f, 'availability'), about: value(f, 'about'), contact: value(f, 'contact'), share_contact: f.has('share') }, 'Profile saved'); }}><Field label="Name" name="name" initial={me.name} max={80}/><Field label="Campus" name="campus" initial={me.campus} max={120} required={false}/><Field label="Skills (comma separated)" name="skills" initial={me.skills} max={500} required={false}/><Field label="Availability" name="availability" initial={me.availability} max={200} required={false}/><Textarea label="About you" name="about" initial={me.about}/><Field label="Private contact (email, phone or handle)" name="contact" initial={me.contact} required={false}/><Check name="share" checked={me.share_contact}>Enable contact sharing for teams where I also consented. Uncheck to revoke access across all teams.</Check><button className="primary" disabled={busy}>Save profile</button></form><Panel title="Account data"><a className="button secondary" href="/api/v1/account/export">Export my data</a><details><summary>Delete account permanently</summary><p>Delete teams you lead first. Your profile, sessions, applications, memberships and alerts will be removed. Anonymous aggregate events remain.</p><form onSubmit={e => { const f = fields(e); void run('/account', 'DELETE', { password: String(f.get('password')) }, 'Account deleted', '/'); }}><Field label="Confirm password" name="password" type="password" max={72}/><button className="danger" disabled={busy}>Delete my account</button></form></details></Panel></div>;
}
interface Report {
    id: string;
    team_name: string;
    reason: string;
    resolved: boolean;
    moderated: boolean;
}
function Admin({ competitions, busy, run }: Actions & {
    competitions: Competition[];
}) {
    const [reports, setReports] = useState<Report[]>([]);
    const [metrics, setMetrics] = useState<unknown>();
    const [error, setError] = useState('');
    const [editing, setEditing] = useState<Competition | undefined>();
    useEffect(() => { let active = true; void Promise.all([api<Report[]>('/admin/reports'), api('/admin/metrics')]).then(([r, m]) => { if (active) {
        setReports(r);
        setMetrics(m);
    } }).catch(e => { if (active)
        setError(errorText(e)); }); return () => { active = false; }; }, []);
    return <><h1>Pilot admin</h1>{error && <p role="alert">{error}</p>}<div className="two-col"><div><Panel title={editing ? 'Edit competition' : 'Curate competition'}><p>Verify organizer rules and dates before publishing. Use official HTTPS links.</p><form key={editing?.id ?? 'new'} onSubmit={e => { const f = fields(e); void run(editing ? `/competitions/${editing.id}` : '/competitions', editing ? 'PUT' : 'POST', { title: value(f, 'title'), organizer: value(f, 'organizer'), description: value(f, 'description'), official_url: value(f, 'url'), deadline: new Date(value(f, 'deadline')).toISOString(), min_members: Number(f.get('min')), max_members: Number(f.get('max')), campus: value(f, 'campus'), published: f.has('published') }, 'Competition saved'); }}><Field label="Title" name="title" initial={editing?.title} max={160}/><Field label="Organizer" name="organizer" initial={editing?.organizer} max={160}/><Textarea label="Description" name="description" initial={editing?.description}/><Field label="Official URL" name="url" type="url" initial={editing?.official_url} max={1000}/><Field label="Application deadline (your local time)" name="deadline" type="datetime-local" initial={editing ? localDate(editing.deadline) : ''}/><Field label="Minimum members" name="min" type="number" initial={editing?.min_members ?? 2} min={2} max={20}/><Field label="Maximum members" name="max" type="number" initial={editing?.max_members ?? 5} min={2} max={20}/><Field label="Campus restriction (blank = all)" name="campus" initial={editing?.campus} required={false} max={120}/><Check name="published" checked={editing?.published ?? true}>Published</Check><button className="primary" disabled={busy}>Save competition</button>{editing && <button type="button" onClick={() => setEditing(undefined)}>Cancel edit</button>}</form></Panel><Panel title="Curated competitions">{competitions.map(c => <p key={c.id}>{c.title} · {c.published ? 'Published' : 'Unpublished'} <button onClick={() => setEditing(c)}>Edit {c.title}</button></p>)}</Panel></div><div><Panel title="Moderation reports">{!reports.length && <p>No reports.</p>}{reports.map(r => <div className="application" key={r.id}><h3>{r.team_name}</h3><p>{r.reason}</p><p>{r.resolved ? 'Resolved' : 'Open'} · {r.moderated ? 'Hidden' : 'Visible'}</p><button disabled={busy} onClick={() => { void run(`/admin/reports/${r.id}/resolve`, 'POST', { hide_team: true }, 'Team hidden; report resolved'); }}>Hide team</button> <button disabled={busy} onClick={() => { void run(`/admin/reports/${r.id}/resolve`, 'POST', { hide_team: false }, 'Team visible; report resolved'); }}>Dismiss / restore team</button></div>)}</Panel><Panel title="Pilot metrics"><pre>{JSON.stringify(metrics, null, 2)}</pre><p>Connected teams require confirmation by at least two members. Funnel records committed actions.</p></Panel></div></div></>;
}
function localDate(s: string) { const d = new Date(s); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
