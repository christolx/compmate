import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiStore } from './apiStore';
import { PERSONS, TEAM_BY_ID, ALL_COMPETITIONS } from '../data/model';

const account={id:'student',name:'Student',email:'private@test.local',campus:'Campus',skills:'Go, React',availability:'Weekends',about:'Bio',contact:'private',share_contact:true,admin:false};
const competition={id:'challenge',title:'Challenge',organizer:'Campus',description:'Build',deadline:'2035-01-01T00:00:00Z',min_members:2,max_members:5,presentation:{}};
const team={id:'real-team',competition_id:'challenge',leader_id:'student',name:'Real team',about:'Build',capacity:3,recruiting:true,moderated:false,eligible:true,presentation:{},members:[{id:'student'}],roles:[{id:'dev',name:'Developer',skills:'Go',capacity:2,filled:0,presentation:{}}]};
const application={id:'committed-app',team_id:'real-team',user_id:'other',role_id:'dev',status:'pending',message:'I can help',created_at:'2026-10-13T00:00:00Z'};
function mockAPI(signedIn=true){
 return vi.fn(async(input:string,init?:RequestInit)=>{
  const path=input.replace('/api/v1','');
  if(init?.method==='POST')return new Response(JSON.stringify({error:'Role full'}),{status:409});
  const rows:Record<string,unknown>={
   '/me':signedIn?account:{error:'Sign in required'},
   '/catalog':{people:[{...account,roles:['Developer'],interests:['Hackathon'],program:'Student',fac:'SOCS'}]},
   '/competitions':[competition],'/teams':[team],
   '/dashboard':{teams:[team],applications:[],inbox:[application],notifications:[]},
   '/preferences':{saved:['challenge'],connections:{}},'/invitations':{incoming:[],outgoing:[]},
  };
  return new Response(JSON.stringify(rows[path]),{status:path==='/me'&&!signedIn?401:200});
 });
}
afterEach(()=>vi.unstubAllGlobals());
describe('restored frontend API state',()=>{
 it('shows no demo identity or catalog when API fails',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
  const store=createApiStore();await store.refresh!();
  expect(store.get().authed).toBe(false);expect(store.get().error).toContain('Network unavailable');
  expect(ALL_COMPETITIONS).toHaveLength(0);expect(Object.keys(TEAM_BY_ID)).toHaveLength(0);expect(PERSONS.me.name).toBe('You');
 });
 it('preserves signed-in data through outage and recovers using same API store',async()=>{
  vi.stubGlobal('fetch',mockAPI());const store=createApiStore();await store.refresh!();
  const before=store.get();
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));await store.refresh!();
  expect(store.get().error).toContain('Network unavailable');
  expect(store.get().account).toEqual(before.account);expect(store.get().managed).toEqual(before.managed);
  expect(Object.keys(TEAM_BY_ID)).toEqual(['real-team']);expect(PERSONS.me.name).toBe('Student');
  await expect(store.request!('/signup','POST',{})).rejects.toThrow('Network unavailable');
  vi.stubGlobal('fetch',mockAPI());await store.refresh!();
  expect(store.get().error).toBeUndefined();expect(store.get().account?.id).toBe('student');
 });
 it('loads anonymous catalog only from server without private dashboard',async()=>{
  const fetch=mockAPI(false);vi.stubGlobal('fetch',fetch);const store=createApiStore();await store.refresh!();
  expect(ALL_COMPETITIONS.map(c=>c.id)).toEqual(['challenge']);expect(store.get().saved).toEqual([]);
  expect(fetch.mock.calls.map(([url])=>url)).not.toContain('/api/v1/dashboard');expect(TEAM_BY_ID['real-team'].leader).toBe('student');
 });
 it('aliases signed-in account to existing UI identity, preserves other users',async()=>{
  vi.stubGlobal('fetch',mockAPI());const store=createApiStore();await store.refresh!();
  expect(store.get().actorId).toBe('student');expect(PERSONS.me.name).toBe('Student');
  expect(TEAM_BY_ID['real-team'].leader).toBe('me');expect(TEAM_BY_ID['real-team'].members).toEqual(['me']);expect(store.get().managed!['real-team'].apps[0]).toMatchObject({id:'committed-app',pid:'other',status:'pending'});
  expect(store.get().saved).toEqual(['challenge']);expect(store.get().apps).toEqual({});expect(TEAM_BY_ID.vertex).toBeUndefined();
 });
 it('keeps committed state unchanged after rejected mutation',async()=>{
  vi.stubGlobal('fetch',mockAPI());const store=createApiStore();await store.refresh!();const before=store.get();
  await expect(store.request!('/teams/real-team/applications','POST',{role_id:'dev'})).rejects.toThrow('Role full');expect(store.get()).toBe(before);
 });
 it('clears previous account state after session expires',async()=>{
  vi.stubGlobal('fetch',mockAPI());const store=createApiStore();await store.refresh!();
  vi.stubGlobal('fetch',mockAPI(false));await store.refresh!();
  expect(store.get().authed).toBe(false);expect(store.get().account).toBeNull();expect(store.get().managed).toEqual({});expect(store.get().apps).toEqual({});expect(PERSONS.me.name).toBe('You');
 });
});
