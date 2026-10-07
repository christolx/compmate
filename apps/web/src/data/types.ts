export type FacultyCode = 'SOCS' | 'SOIS' | 'BBS' | 'SOD' | 'SOE' | 'SOH';
export type Availability = 'Weekends' | 'Weekday evenings' | 'Flexible';
export type Level = 'Beginner' | 'Some experience' | 'Experienced';
export type EventFormat = 'Online' | 'Offline' | 'Hybrid';
export type TeamLevel = 'Beginner friendly' | 'Experienced preferred';
export type MatchKind = 'strong' | 'good' | 'potential';
export type ConnState = 'none' | 'sent' | 'incoming' | 'connected';
export type ApplicationStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn';

export interface Experience { title: string; result: string; year: string; org: string }
export interface ProfileLink { label: string; value: string }
export interface PastTeam { name: string; comp: string; role: string; result: string }

export interface PersonSeed {
  name: string;
  program: string;
  fac: FacultyCode;
  roles: string[];
  skills: string[];
  interests: string[];
  avail: Availability;
  level: Level;
  /** Profile completeness, 0–1. */
  complete: number;
  mutual?: number;
  connections?: number;
  about?: string;
  exp?: Experience[];
  links?: ProfileLink[];
  pastTeams?: PastTeam[];
}

export interface Person extends Omit<PersonSeed, 'mutual' | 'connections' | 'about' | 'exp' | 'links'> {
  id: string;
  mutual: number;
  connections: number;
  about: string;
  exp: Experience[];
  links: ProfileLink[];
  bg: string;
  fg: string;
  initials: string;
  first: string;
  facName: string;
  /** Skill categories this person covers (see TAXONOMY). */
  cats: string[];
  rolesLine: string;
}

export interface Prize { label: string; value: string }
export interface Milestone { label: string; date: string }

export interface Competition {
  id: string;
  title: string;
  org: string;
  cat: string;
  group: string;
  interest: string;
  /** ISO dates (yyyy-mm-dd). */
  open: string;
  deadline: string;
  event: string;
  loc: EventFormat;
  place: string;
  fee: number;
  feeNote?: string;
  /** 'either' = solo or team entries allowed. */
  part?: 'either';
  min: number;
  max: number;
  facs: FacultyCode[];
  skills: string[];
  teamsCount: number;
  openRoles: number;
  interested: number;
  featured?: boolean;
  poster?: string;
  url?: string;
  tagline?: string;
  overview: string;
  eligibility?: string[];
  prizes?: Prize[];
  timeline?: Milestone[];
}

export interface Role {
  id: string;
  name: string;
  qty: number;
  skills: string[];
  note: string;
}

export interface Team {
  id: string;
  name: string;
  comp: string;
  leader: string;
  members: string[];
  target: number;
  avail: Availability;
  level: TeamLevel;
  comms: string;
  lang: string;
  about: string;
  roles: Role[];
}

export interface Notification {
  id: string;
  text: string;
  time: string;
  go: { to: 'manage' | 'profile' | 'comp'; id: string };
}

export interface Avatar { id: string; name: string; initials: string; bg: string; fg: string }

export interface Slot { text: string; bg: string; fg: string; border: string; filled: boolean }
