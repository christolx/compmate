import { relativeTime } from '../lib/relativeTime';
import type { Store } from './store';
import { defaultState, type AppState, type VertexState } from '../data/state';
import { hydrateCatalog } from '../data/model';
import type { Competition, PersonSeed, Team, Notification } from '../data/types';
import { COMPETITION_BY_ID } from '../data/model';

export interface Account { id: string; name: string; email: string; campus: string; skills: string; availability: string; about: string; contact: string; share_contact: boolean; admin: boolean; presentation?: Partial<PersonSeed> }
interface ApiTeam { id: string; competition_id: string; leader_id: string; name: string; about: string; capacity: number; recruiting: boolean; moderated: boolean; eligible: boolean; presentation: Partial<Team>; roles: { id: string; name: string; skills: string; capacity: number; filled: number; presentation: Partial<Team['roles'][number]> }[]; members: {id: string}[] }
interface ApiApplication { id: string; team_id: string; user_id: string; role_id: string; status: 'pending'|'accepted'|'declined'|'withdrawn'; message: string; created_at: string }
interface ApiNotification {id:string;team_id:string;text:string;created_at:string;read_at:string|null}
interface Dashboard { teams: ApiTeam[]; applications: ApiApplication[]; inbox: ApiApplication[]; notifications: ApiNotification[] }
const split = (s: unknown) => typeof s === 'string' ? s.split(',').map(x => x.trim()).filter(Boolean) : Array.isArray(s) ? s.filter((x):x is string=>typeof x==='string') : [];
export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
 let response: Response;
 try { response=await fetch('/api/v1'+path,{method,credentials:'same-origin',headers:method==='GET'?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)}); } catch { throw new Error('Network unavailable. Check connection and retry.'); }
 let result;try{result=await response.json()}catch{throw new Error('API unavailable. Retry shortly.')}
 if(!response.ok)throw new Error(result.error??'Request failed');return result;
}
export function createApiStore(): Store {
 const initial=defaultState();
 let state:AppState={...initial,authed:false,saved:[],apps:{},conns:{},invites:{},read:[],vx:{target:5,closed:false,added:[],filled:[],apps:[]},loaded:false,managed:{},account:null};
 hydrateCatalog([],[],{me:{name:'You',program:'Student',fac:'SOCS',roles:[],skills:[],interests:[],avail:'Flexible',level:'Beginner',complete:0}},[]);
 const listeners=new Set<()=>void>();const emit=()=>listeners.forEach(l=>l());let refreshQueue:Promise<void>=Promise.resolve();
 function refresh() {
  const next=async()=>{
   try {
    const account=await request<Account>('/me').catch(e=>{if((e as Error).message.includes('Sign in required'))return null;throw e});
    const [catalog,competitionRows,teamRows,dashboard,prefs,invitations]=await Promise.all([
     request<{people:(PersonSeed&{id:string;skills:unknown;availability:string})[]}>('/catalog'),
     request<(Record<string,unknown>&{id:string;presentation:Partial<Competition>})[]>('/competitions'),request<ApiTeam[]>('/teams'),
     account?request<Dashboard>('/dashboard'):Promise.resolve({teams:[],applications:[],inbox:[],notifications:[]} as Dashboard),
     account?request<{saved:string[];connections:AppState['conns']}>('/preferences'):Promise.resolve({saved:[],connections:{}}),
 account?request<{incoming:{id:string;team_id:string;role_id:string}[];outgoing:{user_id:string;team_id:string;role_id:string}[]}>('/invitations'):Promise.resolve({incoming:[],outgoing:[]})
    ]);
    const alias=(id:string)=>account&&id===account.id?'me':id;
    const people:Record<string,PersonSeed>={};
    for(const p of [...catalog.people].sort((a,b)=>(a.color_index??9999)-(b.color_index??9999)||a.name.localeCompare(b.name))){people[alias(p.id)]={...p,name:p.name,program:p.program||'Student',fac:p.fac||'SOCS',roles:Array.isArray(p.roles)?p.roles:[],skills:split(p.skills),interests:Array.isArray(p.interests)?p.interests:[],avail:(p.availability||'Flexible') as PersonSeed['avail'],level:p.level||'Beginner',complete:p.complete??0.5,about:p.about||(p.color_index!==undefined?'Interested in '+p.interests.join(' and ').toLowerCase().replace('ui/ux','UI/UX')+' competitions.':'')};}
    if(!people.me)people.me={name:'You',program:'Student',fac:'SOCS',roles:[],skills:[],interests:[],avail:'Flexible',level:'Beginner',complete:0};
    const teams=[...new Map([...teamRows,...dashboard.teams].map(t=>[t.id,t])).values()];
    const displayTeams:Team[]=teams.map(t=>({...t.presentation,id:t.id,name:t.name,comp:t.competition_id,leader:alias(t.leader_id),members:t.members.map(m=>alias(m.id)),target:t.capacity,about:t.about,avail:t.presentation.avail||'Flexible',level:t.presentation.level||'Beginner friendly',comms:t.presentation.comms||'Contact after acceptance',lang:t.presentation.lang||'English',recruiting:t.recruiting&&!t.moderated,canApply:t.eligible,roles:[...t.roles].sort((a,b)=>{const order=(r:typeof a)=>{const original=t.presentation.roles?.findIndex(x=>x.id===r.presentation.id)??-1;return original>=0?original:(r.presentation as {order?:number}).order??9999};return order(a)-order(b)}).map(r=>({...r.presentation,id:r.id,name:r.name,qty:r.capacity,filled:r.filled,skills:split(r.skills),note:r.presentation.note||''}))}));
    const competitions:Competition[]=competitionRows.map(c=>({...c.presentation,id:c.id,title:String(c.title),org:String(c.organizer),overview:String(c.description),deadline:String(c.deadline).slice(0,10),open:c.presentation.open||new Date().toISOString().slice(0,10),event:c.presentation.event||String(c.deadline).slice(0,10),min:Number(c.min_members),max:Number(c.max_members),url:String(c.official_url||'')||undefined,cat:c.presentation.cat||'Competition',group:c.presentation.group||'Technology',interest:c.presentation.interest||'Hackathon',loc:c.presentation.loc||'Online',place:c.presentation.place||'Online',fee:c.presentation.fee||0,facs:c.presentation.facs||['SOCS','SOIS','BBS','SOD','SOE','SOH'],skills:c.presentation.skills||[],recommendationWeight:c.presentation.recommendationWeight??c.presentation.teamsCount,teamsCount:displayTeams.filter(t=>t.comp===c.id&&t.recruiting&&t.members.length<t.target).length,openRoles:displayTeams.filter(t=>t.comp===c.id).flatMap(t=>t.roles).reduce((sum,r)=>sum+Math.max(0,r.qty-(r.filled||0)),0),interested:c.presentation.interested||0}));
    const notifications:Notification[]=dashboard.notifications.map(n=>({id:n.id,text:n.text,time:relativeTime(n.created_at),go:{to:'team',id:n.team_id}}));
    hydrateCatalog(competitions,displayTeams,people,notifications);
    const managed:Record<string,VertexState>={};
    for(const t of teams.filter(t=>t.leader_id===account?.id))managed[t.id]={target:t.capacity,closed:!t.recruiting,added:[],filled:[],apps:dashboard.inbox.filter(a=>a.team_id===t.id).map(a=>({id:a.id,pid:alias(a.user_id),role:a.role_id,status:a.status,when:relativeTime(a.created_at),msg:a.message}))};
    const apps:AppState['apps']={};for(const a of dashboard.applications)apps[a.team_id]={id:a.id,role:a.role_id,status:a.status,when:relativeTime(a.created_at)};
    state={...state,loaded:true,error:undefined,authed:!!account,account,incomingInvites:invitations.incoming,invites:Object.fromEntries(invitations.outgoing.map(i=>[i.user_id,{tid:i.team_id,rid:i.role_id}])),actorId:account?.id,apps,managed,vx:managed.vertex||{target:5,closed:false,added:[],filled:[],apps:[]},saved:prefs.saved.filter(id=>COMPETITION_BY_ID[id]),conns:prefs.connections,read:dashboard.notifications.filter(n=>n.read_at).map(n=>n.id)};
   } catch(e){state={...state,loaded:true,error:(e as Error).message}}
   emit();
  };
  refreshQueue=refreshQueue.then(next,next);return refreshQueue;
 }
 return {live:true,get:()=>state,set(patch){state={...state,...(typeof patch==='function'?patch(state):patch)};emit()},reset(){void refresh()},subscribe(l){listeners.add(l);return()=>{listeners.delete(l)}},refresh,
 async request<T>(path:string,method='GET',body?:unknown){try{const res=await request<T>(path,method,body);if(method!=='GET')await refresh();return res}catch(e){if((e as Error).message.includes('Sign in required'))await refresh();throw e}}
 };
}
