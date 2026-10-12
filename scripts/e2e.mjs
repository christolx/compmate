// Browser UI only for user flows. Admin promotion uses supported operator CLI.
// Run against a disposable local DB. Requires running API/web + agent-browser 0.27.0.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
const stamp = `${Date.now()}`;
const password = 'e2e-disposable-password';
const out = resolve('e2e-results');
mkdirSync(out, { recursive: true });
const sessions = [];
function ab(session, ...args) {
    return execFileSync(process.env.AGENT_BROWSER_BIN || 'agent-browser', ['--session', session, ...args], { encoding: 'utf8', timeout: 40000, maxBuffer: 4 * 1024 * 1024 });
}
function snapshot(s) { const tree = ab(s, 'snapshot', '-i'); writeFileSync(`${out}/${s}-latest.txt`, tree); return tree; }
function open(s, path) { ab(s, 'open', path.startsWith('http') ? path : `${base}${path}`); ab(s, 'wait', '--load', 'networkidle'); snapshot(s); }
function fill(s, label, text) { ab(s, 'find', 'label', label, 'fill', text); }
function ref(s, role, name) {
    const line = snapshot(s).split('\n').find(l => l.includes(`- ${role} "${name}"`));
    assert(line, `Missing ${role}: ${name}`);
    const match = line.match(/ref=(e\d+)/);
    assert(match, line);
    return `@${match[1]}`;
}
function button(s, name) { const r = ref(s, 'button', name); ab(s, 'scrollintoview', r); ab(s, 'click', r); }
function link(s, name) { const r = ref(s, 'link', name); ab(s, 'scrollintoview', r); ab(s, 'click', r); ab(s, 'wait', '--load', 'networkidle'); snapshot(s); }
function text(s, expected) { ab(s, 'wait', '--text', expected); return snapshot(s); }
function check(s, label) { const r = ref(s, 'checkbox', label); ab(s, 'scrollintoview', r); ab(s, 'check', r); }
function verifySessionCookie(s) {
    const payload = JSON.parse(ab(s, 'cookies', '--json'));
    const cookies = payload.data?.cookies ?? payload.cookies ?? payload.data;
    assert(Array.isArray(cookies), 'Cookie metadata unavailable');
    const cookie = cookies.find(c => c.name === 'compmate_session');
    assert(cookie, 'Session cookie missing');
    assert(cookie.httpOnly, 'Session cookie must be HttpOnly');
    assert(cookie.sameSite === 'Lax', 'Session cookie must use SameSite=Lax');
    if (new URL(base).protocol === 'https:') assert(cookie.secure, 'HTTPS session cookie must be Secure');
}
function signup(s, name, email) {
    open(s, '/signup');
    fill(s, 'Name', name);
    fill(s, 'Email', email);
    fill(s, 'Password', password);
    button(s, 'Create account');
    text(s, `Hi, ${name}.`);
    verifySessionCookie(s);
}
function profile(s, name, contact) {
    open(s, '/u/me');
    fill(s, 'Campus', 'Pilot Campus');
    fill(s, 'Skills (comma separated)', 'Go, Design');
    fill(s, 'Private contact (email, phone or handle)', contact);
    check(s, 'Enable contact sharing for teams where I also consented. Uncheck to revoke access across all teams.');
    button(s, 'Save profile');
    text(s, 'Profile saved');
    assert(snapshot(s).includes(name));
}
function createCompetition(s, title) {
    open(s, '/admin');
    text(s, 'Pilot admin');
    fill(s, 'Title', title);
    fill(s, 'Organizer', 'E2E fixture organizer');
    fill(s, 'Description', 'Disposable test competition. Not a real event.');
    fill(s, 'Official URL', 'https://example.edu/challenge');
    // CLI fill does not support Chromium's segmented datetime-local input.
    ab(s, 'eval', `const input = document.querySelector('input[name="deadline"]'); input.value = '2035-01-01T18:00'; input.dispatchEvent(new Event('input', {bubbles:true})); input.dispatchEvent(new Event('change', {bubbles:true}));`);
    fill(s, 'Maximum members', '5');
    fill(s, 'Campus restriction (blank = all)', 'Pilot Campus');
    button(s, 'Save competition');
    text(s, 'Competition saved');
}
function createTeam(s, title, teamName) {
    open(s, '/competitions');
    link(s, title);
    link(s, 'Create team');
    fill(s, 'Team name', teamName);
    fill(s, 'About your team', 'Build a project with real teammates.');
    fill(s, 'Team capacity (including leader)', '3');
    fill(s, 'Role 1 name', 'Developer');
    fill(s, 'Role 1 skills (comma separated)', 'Go');
    fill(s, 'Role 1 seats', '2');
    check(s, 'Share my contact with members of this team. Profile sharing must also be enabled.');
    button(s, 'Create team');
    text(s, 'Team created');
    return ab(s, 'get', 'url').trim();
}
function screenshot(s, name) { ab(s, 'screenshot', `${out}/${name}.png`, '--full'); }
try {
    const curator = `cm-admin-${stamp}`;
    sessions.push(curator);
    if (process.env.E2E_ADMIN_EMAIL) {
        open(curator, '/login');
        fill(curator, 'Email', process.env.E2E_ADMIN_EMAIL);
        fill(curator, 'Password', process.env.E2E_ADMIN_PASSWORD);
        button(curator, 'Sign in');
        text(curator, 'Signed in');
    }
    else {
        assert(process.env.DATABASE_URL, 'Set DATABASE_URL for disposable DB admin bootstrap, or E2E_ADMIN_EMAIL/PASSWORD for staging');
        assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Automatic admin bootstrap only supports local app');
        const email = `e2e-admin-${stamp}@example.test`;
        signup(curator, 'Curator', email);
        execFileSync('go', ['run', './cmd/api', '-promote-admin', email], { cwd: resolve('apps/api'), env: process.env, stdio: 'pipe' });
    }
    for (const mode of ['desktop', 'mobile']) {
        const title = `E2E ${mode} ${stamp}`;
        createCompetition(curator, title);
        const leader = `cm-leader-${mode}-${stamp}`;
        const applicant = `cm-applicant-${mode}-${stamp}`;
        sessions.push(leader, applicant);
        const leaderName = `Leader${mode}`;
        const applicantName = `Applicant${mode}`;
        const leaderEmail = `leader-${mode}-${stamp}@example.test`;
        const applicantEmail = `applicant-${mode}-${stamp}@example.test`;
        const leaderContact = `leader-${mode}@private.test`;
        const applicantContact = `applicant-${mode}@private.test`;
        signup(leader, leaderName, leaderEmail);
        signup(applicant, applicantName, applicantEmail);
        if (mode === 'mobile') {
            ab(leader, 'set', 'viewport', '390', '844');
            ab(applicant, 'set', 'viewport', '390', '844');
        }
        profile(leader, leaderName, leaderContact);
        profile(applicant, applicantName, applicantContact);
        const teamURL = createTeam(leader, title, `${mode} Team ${stamp}`);
        open(applicant, teamURL);
        assert(!snapshot(applicant).includes(leaderContact));
        fill(applicant, 'Application message', 'I can build the Go backend and help our team.');
        check(applicant, 'Share my contact with team members after acceptance. Enable profile sharing too.');
        button(applicant, 'Submit application');
        text(applicant, 'Application submitted');
        open(applicant, '/for-you');
        text(applicant, 'pending');
        open(leader, '/for-you');
        text(leader, applicantName);
        button(leader, `Accept ${applicantName}`);
        text(leader, 'Application accepted');
        open(applicant, '/for-you');
        text(applicant, 'accepted');
        open(applicant, teamURL);
        text(applicant, '2/3 MEMBERS');
        button(applicant, 'Show / refresh contacts');
        text(applicant, leaderContact);
        button(applicant, 'We connected');
        text(applicant, 'Connection confirmed');
        open(leader, teamURL);
        button(leader, 'Show / refresh contacts');
        text(leader, applicantContact);
        button(leader, 'We connected');
        text(leader, 'Connection confirmed');
        screenshot(leader, `${mode}-team`);
        // Consent revocation takes effect on next contact read.
        open(applicant, '/u/me');
        const revoke = ref(applicant, 'checkbox', 'Enable contact sharing for teams where I also consented. Uncheck to revoke access across all teams.');
        ab(applicant, 'scrollintoview', revoke);
        ab(applicant, 'uncheck', revoke);
        button(applicant, 'Save profile');
        text(applicant, 'Profile saved');
        open(leader, teamURL);
        button(leader, 'Show / refresh contacts');
        text(leader, 'Contact not shared');
        assert(!ab(leader, 'get', 'text', 'body').includes(applicantContact));
        // Real network failure must show error without claiming committed success.
        open(applicant, '/u/me');
        ab(applicant, 'set', 'offline', 'on');
        fill(applicant, 'Availability', 'Weekends');
        button(applicant, 'Save profile');
        text(applicant, 'Network unavailable');
        assert(!ab(applicant, 'get', 'text', 'body').includes('Profile saved'));
        ab(applicant, 'set', 'offline', 'off');
        button(applicant, 'Save profile');
        text(applicant, 'Profile saved');
        // Reload-safe identity + logout/login.
        button(applicant, 'Log out');
        text(applicant, 'Signed out');
        open(applicant, '/login');
        fill(applicant, 'Email', applicantEmail);
        fill(applicant, 'Password', password);
        button(applicant, 'Sign in');
        text(applicant, `Hi, ${applicantName}.`);
        open(applicant, teamURL);
        text(applicant, 'Member contacts');
        // Missing/expired session must reject write and render sign-in recovery.
        open(applicant, '/u/me');
        ab(applicant, 'cookies', 'clear');
        button(applicant, 'Save profile');
        text(applicant, 'Sign in required');
        open(applicant, '/login');
        fill(applicant, 'Email', applicantEmail);
        fill(applicant, 'Password', password);
        button(applicant, 'Sign in');
        text(applicant, `Hi, ${applicantName}.`);
        open(applicant, teamURL);
        ab(applicant, 'press', 'Tab');
        const focus = ab(applicant, 'eval', 'document.activeElement.tagName').trim();
        assert(!focus.includes('BODY'), 'Keyboard focus missing');
        const overflow = ab(applicant, 'eval', 'document.documentElement.scrollWidth > window.innerWidth').trim();
        assert(overflow.includes('false'), `${mode} horizontal overflow`);
        screenshot(applicant, `${mode}-applicant`);
        const errors = ab(applicant, 'errors');
        assert(!errors.includes('Error:'), errors);
        console.log(`PASS ${mode}: two-user signup/create/apply/accept/contact, refresh, consent, network failure, logout/login, session loss, keyboard, layout`);
    }
    writeFileSync(`${out}/summary.json`, JSON.stringify({ result: 'passed', base, stamp, scenarios: ['desktop', 'mobile'], completedAt: new Date().toISOString() }, null, 2));
}
catch (e) {
    for (const s of sessions) {
        try {
            snapshot(s);
            screenshot(s, `${s}-failure`);
        }
        catch { }
    }
    throw e;
}
finally {
    for (const s of sessions) {
        try {
            ab(s, 'close');
        }
        catch { /* preserve original failure */ }
    }
}
