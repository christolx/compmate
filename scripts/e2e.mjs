// Exercise restored UI through its existing nav, cards and dialogs. Use test DB.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:5173';const stamp=String(Date.now());const password='e2e-disposable-password';
const modes=(process.env.E2E_MODES||'desktop,mobile').split(',');const out=resolve('e2e-results');mkdirSync(out,{recursive:true});const sessions=[];
function ab(s,...args){return execFileSync(process.env.AGENT_BROWSER_BIN||'agent-browser',['--session',s,...args],{encoding:'utf8',timeout:40000,maxBuffer:4*1024*1024});}
function snap(s){const tree=ab(s,'snapshot','-i');writeFileSync(`${out}/${s}-latest.txt`,tree);return tree;}
function open(s,path){ab(s,'open',path.startsWith('http')?path:base+path);ab(s,'wait','--load','networkidle');snap(s);}
function text(s,t){ab(s,'wait','--text',t);return snap(s);}
function ref(s,role,name){const line=snap(s).split('\n').find(l=>l.includes(`- ${role} "${name}"`));assert(line,`Missing ${role}: ${name}`);return '@'+line.match(/ref=(e\d+)/)[1];}
function click(s,role,name){const r=ref(s,role,name);ab(s,'scrollintoview',r);ab(s,'click',r);}
function button(s,name){const tree=snap(s);if(tree.includes(`- button "${name}"`))click(s,'button',name);else ab(s,'find','role','button','click','--name',name,'--exact');}
function fill(s,label,v){ab(s,'find','label',label,'fill',v);}
function checkbox(s,label,on=true){const r=ref(s,'checkbox',label);ab(s,'scrollintoview',r);ab(s,on?'check':'uncheck',r);}
function sessionCookie(s){const raw=JSON.parse(ab(s,'cookies','--json'));const cookies=raw.data?.cookies??raw.cookies??raw.data;assert(Array.isArray(cookies),'Cookie metadata missing');const c=cookies.find(c=>c.name==='compmate_session');assert(c?.httpOnly&&c.sameSite==='Lax','Session protections missing');if(new URL(base).protocol==='https:')assert(c.secure,'Secure cookie missing');}
function signup(s,name,email){open(s,'/');button(s,'Sign up');text(s,'Create your account');fill(s,'Name',name);fill(s,'Email',email);fill(s,'Password',password);button(s,'Create account');ab(s,'wait','--fn',"location.pathname === '/' && !!document.querySelector('[aria-label=\"Account options\"]')");text(s,'Find competitions.');open(s,'/for-you');text(s,'For you');sessionCookie(s);}
function login(s,email,pw=password){open(s,'/');button(s,'Log in');fill(s,'Email',email);fill(s,'Password',pw);button(s,'Continue');ab(s,'wait','--fn',"location.pathname === '/' && !!document.querySelector('[aria-label=\"Account options\"]')");text(s,'Find competitions.');open(s,'/for-you');text(s,'For you');}
function profile(s,contact){open(s,'/u/me');button(s,'Edit profile');text(s,'Edit profile');fill(s,'Campus','Pilot Campus');fill(s,'Preferred roles (comma separated)','Developer');fill(s,'Skills (comma separated)','Go, React');fill(s,'Interests (comma separated)','Hackathon');fill(s,'LinkedIn URL','https://www.linkedin.com/');fill(s,'Portfolio URL','https://example.com/?portfolio='+encodeURIComponent(contact));fill(s,'Private contact (email, phone or handle)',contact);checkbox(s,'Enable contact sharing for teams where I consented. Uncheck to revoke across all teams.');button(s,'Save profile');ab(s,'wait','--fn',"location.pathname === '/u/me'");text(s,'Go');assert.equal(ab(s,'get','attr',ref(s,'link','LinkedIn'),'href').trim(),'https://www.linkedin.com/');assert.equal(ab(s,'get','attr',ref(s,'link','LinkedIn'),'target').trim(),'_blank');ab(s,'reload');text(s,'Go');assert.equal(ab(s,'get','attr',ref(s,'link','Portfolio'),'href').trim(),'https://example.com/?portfolio='+encodeURIComponent(contact));}
function curate(s,title){open(s,'/admin');text(s,'Curate competition');fill(s,'Title',title);fill(s,'Organizer','E2E fixture organizer');fill(s,'Description','Disposable test competition. Not a real event.');fill(s,'Official URL','https://example.edu/challenge');ab(s,'eval',`const d=document.querySelector('input[name="deadline"]');d.value='2035-01-01T18:00';d.dispatchEvent(new Event('input',{bubbles:true}));`);fill(s,'Campus restriction (blank = all)','Pilot Campus');button(s,'Save competition');text(s,'Competition saved');}
function createTeam(s,title,name){open(s,'/competitions');click(s,'link',title);text(s,title);const tree=snap(s);button(s,tree.includes('- button "+ Create a team"')?'+ Create a team':'Create a team');text(s,'Create team');fill(s,'Team name',name);fill(s,'About your team','Build together through the restored UI.');fill(s,'Team capacity (including leader)','3');fill(s,'Role 1 name','Developer');fill(s,'Role 1 skills','Go, React');fill(s,'Role 1 seats','2');checkbox(s,'Share my contact with accepted members (profile sharing must also be enabled).');button(s,'Create team');ab(s,'wait','--fn',"location.pathname.endsWith('/manage')");text(s,name);return ab(s,'get','url').trim().replace(/\/manage$/,'');}
function screenshot(s,name){ab(s,'screenshot',`${out}/${name}.png`,'--full');}
writeFileSync(`${out}/summary.json`,JSON.stringify({result:'running',ui:'restored',base,stamp,modes,startedAt:new Date().toISOString()},null,2));
try{
 // Initial API outage must show retry screen, never switch to local demo.
 const outage=`restore-outage-${stamp}`;sessions.push(outage);open(outage,'/');
 ab(outage,'network','route',base+'/api/v1/me','--abort');ab(outage,'reload');
 text(outage,'Unable to load CompMate');text(outage,'Network unavailable');
 const failedBody=ab(outage,'get','text','body');
 assert(!failedBody.includes('Team not found')&&!failedBody.includes('Maya')&&!failedBody.includes('Vertex'),'API outage rendered demo or missing-entity cards');
 assert(ab(outage,'eval',"localStorage.getItem('compmate-v2') === null").includes('true'),'API outage wrote local prototype state');
 ab(outage,'network','unroute');button(outage,'Retry');text(outage,'National Business Case Competition');
 open(outage,'/competitions/ived');button(outage,'View sample poster');text(outage,'Organizer artwork pending');button(outage,'Close');assert(!snap(outage).includes('dialog \"Indonesian Varsity English Debate poster'),'Sample poster did not close');assert.equal(ab(outage,'get','attr',ref(outage,'link','Example registration ↗'),'href').trim(),'https://example.com/?competition=ived');
 const admin=`restore-admin-${stamp}`;sessions.push(admin);
 if(process.env.E2E_ADMIN_EMAIL)login(admin,process.env.E2E_ADMIN_EMAIL,process.env.E2E_ADMIN_PASSWORD);
 else{assert(process.env.DATABASE_URL,'Set DATABASE_URL for local operator bootstrap');assert(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Local admin bootstrap only');const email=`e2e-admin-${stamp}@example.test`;signup(admin,'Curator',email);execFileSync('go',['run','./cmd/api','-promote-admin',email],{cwd:resolve('apps/api'),env:process.env,stdio:'pipe'});}
 // Previous seed records now come from API; Maya keeps her own teams/apps.
 const seed=`restore-seed-${stamp}`;sessions.push(seed);login(seed,'maya@compmate.local','compmate-demo-password');text(seed,'Vertex has 2 new applicants');open(seed,'/teams/vertex/manage');text(seed,'Livia Santoso');text(seed,'Fikri Hidayat');screenshot(seed,'restored-manage-seeded');
 open(seed,'/u/me');text(seed,'Maya Putri');assert.equal(ab(seed,'get','attr',ref(seed,'link','LinkedIn (example)'),'href').trim(),'https://www.linkedin.com/');screenshot(seed,'restored-profile-seeded');
 for(const mode of modes){
  const title=`E2E ${mode} ${stamp}`;curate(admin,title);
  const leader=`restore-leader-${mode}-${stamp}`,applicant=`restore-applicant-${mode}-${stamp}`;sessions.push(leader,applicant);
  const ln=`Leader${mode}`,an=`Applicant${mode}`;const le=`leader-${mode}-${stamp}@example.test`,ae=`applicant-${mode}-${stamp}@example.test`;const lc=`leader-${mode}@private.test`,ac=`applicant-${mode}@private.test`;
  signup(leader,ln,le);signup(applicant,an,ae);assert(!ab(applicant,'get','text','body').includes('Vertex has'),'New account inherited seeded identity');
  if(mode==='mobile'){ab(leader,'set','viewport','390','844');ab(applicant,'set','viewport','390','844');}
  profile(leader,lc);profile(applicant,ac);const leaderId=JSON.parse(ab(leader,'eval',"(async()=> (await (await fetch('/api/v1/me')).json()).id)()"));const applicantId=JSON.parse(ab(applicant,'eval',"(async()=> (await (await fetch('/api/v1/me')).json()).id)()"));open(leader,'/u/'+applicantId);button(leader,'Connect');text(leader,'Request pending');open(applicant,'/u/'+leaderId);button(applicant,'Accept request');text(applicant,'Connected ✓');const teamURL=createTeam(leader,title,`${mode} Team ${stamp}`);
  open(applicant,teamURL);assert(!ab(applicant,'get','text','body').includes(lc));button(applicant,'Apply as Developer');text(applicant,'Message to the team');
  // Dialog starts focused, Tab cycles inside, Escape restores existing page.
  ab(applicant,'press','Shift+Tab');assert(ab(applicant,'eval',`!!document.activeElement.closest('[role="dialog"]')`).includes('true'),'Apply focus escaped dialog');ab(applicant,'press','Escape');assert(!snap(applicant).includes('dialog "Join '),'Escape failed');button(applicant,'Apply as Developer');
  fill(applicant,'Message to the team (10–300 characters)','I can build the backend and help our team.');click(applicant,'switch','Share my contact after acceptance Only accepted team members can see your shared contact. Profile sharing must also be enabled.');button(applicant,'Send application');text(applicant,'Application sent');button(applicant,'Done');
  open(applicant,'/for-you');text(applicant,'Pending');open(leader,teamURL+'/manage');text(leader,an);button(leader,'Accept');text(leader,`Accept ${an} as Developer?`);
  ab(leader,'press','Tab');ab(leader,'press','Shift+Tab');assert(ab(leader,'eval',`!!document.activeElement.closest('[role="alertdialog"]')`).includes('true'),'Confirmation focus escaped');button(leader,`Accept ${an}`);text(leader,'Applicant joined');
  open(applicant,'/for-you');text(applicant,'Accepted');open(applicant,teamURL);button(applicant,'Show / refresh contacts');text(applicant,lc);button(applicant,'We connected');text(applicant,'Connection confirmed');
  open(leader,teamURL);button(leader,'Show / refresh contacts');text(leader,ac);button(leader,'We connected');text(leader,'Connection confirmed');screenshot(leader,`${mode}-team`);
  open(applicant,'/u/me/edit');checkbox(applicant,'Enable contact sharing for teams where I consented. Uncheck to revoke across all teams.',false);button(applicant,'Save profile');ab(applicant,'wait','--fn',"location.pathname === '/u/me'");
  open(leader,teamURL);button(leader,'Show / refresh contacts');text(leader,'Contact not shared');assert(!ab(leader,'get','text','body').includes(ac));
  open(applicant,'/u/me/edit');ab(applicant,'set','offline','on');fill(applicant,'About you','Failed writes must leave profile unchanged.');button(applicant,'Save profile');text(applicant,'Network unavailable');ab(applicant,'set','offline','off');button(applicant,'Save profile');ab(applicant,'wait','--fn',"location.pathname === '/u/me'");
  button(applicant,'Account options');button(applicant,'Log out');text(applicant,'Logged out');login(applicant,ae);
  open(applicant,'/u/me/edit');ab(applicant,'cookies','clear');button(applicant,'Save profile');text(applicant,'Log in to edit your profile');fill(applicant,'Email',ae);fill(applicant,'Password',password);button(applicant,'Continue');ab(applicant,'wait','--fn',"location.pathname === '/u/me/edit'");open(applicant,teamURL);
  if(mode==='desktop'){
   const invitee=`restore-invitee-${stamp}`;sessions.push(invitee);signup(invitee,'Invitee',`invitee-${stamp}@example.test`);profile(invitee,'invitee@private.test');const inviteeId=JSON.parse(ab(invitee,'eval',"(async()=> (await (await fetch('/api/v1/me')).json()).id)()"));
   open(leader,'/u/'+inviteeId);button(leader,`Invite to ${mode} Team ${stamp}`);text(leader,`Invited to ${mode} Team ${stamp} ✓`);open(invitee,teamURL);button(invitee,'Accept invitation');text(invitee,'Invitation accepted');text(invitee,"You're on this team");
   ab(applicant,'scrollintoview','details summary');ab(applicant,'find','text','Report this team','click','--exact');ab(applicant,'scrollintoview','textarea[name=reason]');fill(applicant,'Report reason','Disposable report to verify moderation UI.');button(applicant,'Submit report');text(applicant,'Report submitted for moderation');open(admin,'/admin');text(admin,'Disposable report to verify moderation UI.');button(admin,'Hide team');text(admin,'Team hidden; report resolved');button(admin,'Dismiss / restore team');text(admin,'Team visible; report resolved');
  }
  assert(ab(applicant,'eval','document.documentElement.scrollWidth > window.innerWidth').includes('false'),'Horizontal overflow');screenshot(applicant,`${mode}-applicant`);assert(!ab(applicant,'errors').includes('Error:'),'Uncaught browser error');console.log(`PASS ${mode}: restored UI two-user create/apply/accept/contact, dialogs, privacy, offline errors, session recovery`);
 }
 writeFileSync(`${out}/summary.json`,JSON.stringify({result:'passed',ui:'restored',base,stamp,scenarios:['API outage and retry','seeded identity',...modes,'connections',...(modes.includes('desktop')?['invitations','moderation']:[])],completedAt:new Date().toISOString()},null,2));
}catch(e){writeFileSync(`${out}/summary.json`,JSON.stringify({result:'failed',ui:'restored',base,stamp,error:e.message,completedAt:new Date().toISOString()},null,2));for(const s of sessions){try{snap(s);screenshot(s,`${s}-failure`)}catch{}}throw e}
finally{
 for(const s of sessions){try{ab(s,'close')}catch{}}
 // Remove only this run's disposable local fixtures; never touch seed records.
 if(process.env.DATABASE_URL&&['127.0.0.1','localhost'].includes(new URL(base).hostname)){
  execFileSync('psql',[process.env.DATABASE_URL,'-X','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe'],input:`BEGIN;
   CREATE TEMP TABLE fixture_users AS SELECT id FROM users WHERE NOT seeded AND email IN ('e2e-admin-${stamp}@example.test','leader-desktop-${stamp}@example.test','applicant-desktop-${stamp}@example.test','leader-mobile-${stamp}@example.test','applicant-mobile-${stamp}@example.test','invitee-${stamp}@example.test');
   CREATE TEMP TABLE fixture_comps AS SELECT id FROM competitions WHERE title IN ('E2E desktop ${stamp}','E2E mobile ${stamp}') AND description='Disposable test competition. Not a real event.';
   DELETE FROM events WHERE user_id IN(SELECT id FROM fixture_users);
   DELETE FROM teams WHERE competition_id IN(SELECT id FROM fixture_comps) OR leader_id IN(SELECT id FROM fixture_users);
   DELETE FROM competitions WHERE id IN(SELECT id FROM fixture_comps);
   DELETE FROM users WHERE id IN(SELECT id FROM fixture_users);COMMIT;`});
 }
}
