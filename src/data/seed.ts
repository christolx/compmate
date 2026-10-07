// Sample data for the round 3 prototype. Every person is fictional; the sample
// user ("me", Maya Putri) is shown as "You" almost everywhere.
import type { Competition, FacultyCode, Notification, PersonSeed, Team } from './types';

/** The demo is pinned to this date so deadlines and countdowns stay stable. */
export const TODAY = new Date(2026, 9, 6);

export const TAXONOMY: Record<string, string[]> = {
  Communication: ['Presentation', 'Public Speaking', 'Pitching', 'Pitch Deck', 'Debate', 'English', 'Copywriting'],
  Business: ['Business Strategy', 'Market Research', 'Marketing', 'Product Strategy', 'Business Model'],
  Finance: ['Financial Analysis', 'Valuation', 'Accounting', 'Excel'],
  Technology: ['Python', 'JavaScript', 'React', 'SQL', 'Machine Learning', 'Data Visualization'],
  Design: ['Figma', 'UI/UX', 'User Research', 'Graphic Design', 'Branding'],
  Research: ['Research', 'Statistics', 'Academic Writing'],
};

export const FACULTIES: Record<FacultyCode, string> = {
  SOCS: 'School of Computer Science',
  SOIS: 'School of Information Systems',
  BBS: 'BINUS Business School',
  SOD: 'School of Design',
  SOE: 'School of Engineering',
  SOH: 'School of Humanities',
};

/** [background, foreground] pairs for avatars and poster-less competitions. */
export const HUES: [string, string][] = [
  ['#E8F0FF', '#1D4ED8'],
  ['#EEEBFF', '#5B45C9'],
  ['#E3F5EE', '#0F766E'],
  ['#FFF1DE', '#B45309'],
  ['#FCE9F0', '#BE185D'],
  ['#ECEFF4', '#334155'],
];

/** Roles that count as related when they share a family (half credit). */
export const ROLE_FAMILIES: string[][] = [
  ['UI/UX Designer', 'Designer'],
  ['Business Strategist', 'Business Analyst', 'Marketing Lead'],
  ['Researcher', 'Data Analyst', 'Financial Analyst', 'Data Scientist'],
  ['Developer', 'Data Scientist'],
];

/** Interests that count as related to a competition interest. */
export const RELATED_INTERESTS: Record<string, string[]> = {
  'Business Case': ['Marketing', 'Entrepreneurship', 'Investment'],
  Hackathon: ['Programming', 'Product Innovation', 'Data Science', 'UI/UX', 'Entrepreneurship'],
  Entrepreneurship: ['Product Innovation'],
  'Data Science': ['Programming', 'Research'],
};

export const GROUPS = ['Business', 'Technology', 'Design', 'Finance', 'Engineering', 'Research', 'Entrepreneurship', 'Debate'];

export const POPULAR_SEARCHES = ['Business Case', 'Data Science', 'UI/UX', 'Investment', 'Hackathon'];

export const PEOPLE: Record<string, PersonSeed> = {
  me: {
    name: 'Maya Putri', program: 'Management', fac: 'BBS', roles: ['Presenter', 'Business Strategist'],
    skills: ['Presentation', 'Public Speaking', 'English', 'Market Research', 'Business Strategy', 'Pitching'],
    interests: ['Business Case', 'Hackathon', 'Marketing'], avail: 'Weekends', level: 'Some experience', complete: 0.9, connections: 41,
    about: 'Management student who likes turning research into a clear story. Looking for case competitions and hackathons where I can own the pitch.',
    exp: [
      { title: 'National Marketing Case Competition', result: 'Semifinalist', year: '2026', org: 'MarkComm Forum' },
      { title: 'Startup Pitch Competition', result: 'Participant', year: '2025', org: 'Venture Society' },
    ],
    links: [{ label: 'LinkedIn', value: 'linkedin.com/in/mayaputri' }, { label: 'Portfolio', value: 'mayaputri.notion.site' }],
  },
  raka: {
    name: 'Raka Pratama', program: 'Information Systems', fac: 'SOIS', roles: ['Presenter', 'Business Strategist'],
    skills: ['Presentation', 'Public Speaking', 'English', 'Pitch Deck', 'Market Research', 'SQL', 'Product Strategy'],
    interests: ['Business Case', 'Hackathon', 'Product Innovation'], avail: 'Weekends', level: 'Experienced', complete: 1, mutual: 3, connections: 87,
    about: 'Interested in business case competitions, product strategy, and technology. I usually take the pitch and the market sizing.',
    exp: [
      { title: 'National Business Case Challenge', result: 'Finalist', year: '2026', org: 'Future Business Society' },
      { title: 'Innovation Hackathon', result: 'Participant', year: '2026', org: 'Innovate Indonesia' },
      { title: 'Campus Product Sprint', result: '2nd place', year: '2025', org: 'BINUS Student Association' },
    ],
    links: [
      { label: 'LinkedIn', value: 'linkedin.com/in/rakapratama' },
      { label: 'Portfolio', value: 'rakapratama.com' },
      { label: 'Instagram', value: '@rakapratama' },
    ],
    pastTeams: [{ name: 'Helix', comp: 'National Business Case Challenge 2026', role: 'Presenter', result: 'Finalist' }],
  },
  kevin: { name: 'Kevin Wijaya', program: 'Computer Science', fac: 'SOCS', roles: ['Developer'], skills: ['Python', 'JavaScript', 'React', 'SQL'], interests: ['Hackathon', 'Programming'], avail: 'Weekends', level: 'Experienced', complete: 0.85, mutual: 6 },
  bima: { name: 'Bima Saputra', program: 'Computer Science', fac: 'SOCS', roles: ['Developer'], skills: ['JavaScript', 'React', 'Machine Learning'], interests: ['Hackathon'], avail: 'Weekends', level: 'Some experience', complete: 0.7, mutual: 4 },
  nadia: {
    name: 'Nadia Chen', program: 'Visual Communication Design', fac: 'SOD', roles: ['UI/UX Designer', 'Designer'], skills: ['Figma', 'UI/UX', 'User Research', 'Graphic Design'],
    interests: ['UI/UX', 'Hackathon'], avail: 'Weekends', level: 'Experienced', complete: 0.95, mutual: 2,
    about: 'Product designer in training. I like messy problems and quick usability tests.',
    exp: [{ title: 'Nusantara UI/UX Competition', result: '2nd place', year: '2025', org: 'Nusantara Design Collective' }],
  },
  jessica: { name: 'Jessica Tanoto', program: 'Visual Communication Design', fac: 'SOD', roles: ['Designer'], skills: ['Figma', 'Graphic Design', 'Branding'], interests: ['UI/UX', 'Marketing'], avail: 'Weekday evenings', level: 'Beginner', complete: 0.75, mutual: 1 },
  livia: { name: 'Livia Santoso', program: 'Information Systems', fac: 'SOIS', roles: ['UI/UX Designer'], skills: ['Figma', 'User Research', 'SQL'], interests: ['Hackathon', 'UI/UX'], avail: 'Flexible', level: 'Some experience', complete: 0.8, mutual: 1 },
  clara: { name: 'Clara Wibisono', program: 'English Literature', fac: 'SOH', roles: ['Presenter'], skills: ['Public Speaking', 'Debate', 'English', 'Presentation'], interests: ['Debate', 'Business Case'], avail: 'Flexible', level: 'Experienced', complete: 0.9, mutual: 1 },
  fikri: { name: 'Fikri Hidayat', program: 'Marketing', fac: 'BBS', roles: ['Presenter', 'Marketing Lead'], skills: ['Presentation', 'Marketing', 'Pitching'], interests: ['Marketing', 'Hackathon'], avail: 'Weekends', level: 'Beginner', complete: 0.7, mutual: 0 },
  gilang: { name: 'Gilang Mahardika', program: 'Communication', fac: 'SOH', roles: ['Presenter'], skills: ['Public Speaking', 'Copywriting'], interests: ['Marketing'], avail: 'Weekday evenings', level: 'Beginner', complete: 0.6, mutual: 0 },
  dimas: { name: 'Dimas Hartono', program: 'Accounting', fac: 'BBS', roles: ['Financial Analyst', 'Researcher'], skills: ['Financial Analysis', 'Excel', 'Valuation', 'Accounting'], interests: ['Business Case', 'Investment'], avail: 'Weekends', level: 'Some experience', complete: 0.9, mutual: 1 },
  sarah: { name: 'Sarah Lim', program: 'Information Systems', fac: 'SOIS', roles: ['Data Analyst', 'Researcher'], skills: ['SQL', 'Data Visualization', 'Excel', 'Market Research'], interests: ['Business Case', 'Data Science'], avail: 'Weekends', level: 'Some experience', complete: 0.85, mutual: 2 },
  aditya: { name: 'Aditya Nugroho', program: 'Finance', fac: 'BBS', roles: ['Financial Analyst'], skills: ['Valuation', 'Excel', 'Financial Analysis'], interests: ['Business Case', 'Investment'], avail: 'Weekday evenings', level: 'Experienced', complete: 0.8 },
  rizky: { name: 'Rizky Ramadhan', program: 'Management', fac: 'BBS', roles: ['Business Strategist'], skills: ['Business Strategy', 'Market Research', 'Excel'], interests: ['Business Case', 'Entrepreneurship'], avail: 'Weekends', level: 'Some experience', complete: 0.8, mutual: 5 },
  alya: { name: 'Alya Rahma', program: 'Psychology', fac: 'SOH', roles: ['Researcher'], skills: ['Research', 'User Research', 'Statistics'], interests: ['Research', 'Marketing'], avail: 'Weekends', level: 'Beginner', complete: 0.75 },
  clarissa: { name: 'Clarissa Halim', program: 'Marketing', fac: 'BBS', roles: ['Marketing Lead', 'Researcher'], skills: ['Marketing', 'Market Research', 'Copywriting'], interests: ['Marketing', 'Business Case'], avail: 'Weekends', level: 'Some experience', complete: 0.85, mutual: 2 },
  steven: { name: 'Steven Halim', program: 'Information Systems', fac: 'SOIS', roles: ['Developer', 'Business Analyst'], skills: ['SQL', 'JavaScript', 'Business Model'], interests: ['Entrepreneurship', 'Hackathon'], avail: 'Weekday evenings', level: 'Experienced', complete: 0.8 },
  farhan: { name: 'Farhan Akbar', program: 'Data Science', fac: 'SOCS', roles: ['Data Scientist', 'Developer'], skills: ['Python', 'Machine Learning', 'Statistics'], interests: ['Data Science', 'Hackathon'], avail: 'Weekday evenings', level: 'Experienced', complete: 0.9, mutual: 1 },
  yoga: { name: 'Yoga Pradana', program: 'International Business', fac: 'BBS', roles: ['Presenter', 'Researcher'], skills: ['Presentation', 'English', 'Market Research'], interests: ['Business Case'], avail: 'Weekends', level: 'Beginner', complete: 0.65 },
};

export const COMPETITIONS: Competition[] = [
  {
    id: 'nbcc', title: 'National Business Case Competition', org: 'Talent Growth × DANA', cat: 'Business Case', group: 'Business', interest: 'Business Case',
    open: '2026-09-21', deadline: '2026-10-17', event: '2026-11-15', loc: 'Online', place: 'Online, all rounds', fee: 100000, min: 2, max: 3,
    facs: ['BBS', 'SOIS', 'SOCS'], skills: ['Business Strategy', 'Market Research', 'Financial Analysis', 'Presentation'],
    teamsCount: 12, openRoles: 15, interested: 64, featured: true, poster: '/posters/nbcc.jpg', url: 'bit.ly/NBCCTG',
    tagline: 'A challenge for the best and brightest business minds',
    overview: 'Teams of two or three analyse a real business case contributed by DANA, then present a strategy to judges from industry. The semifinal and final rounds are held online, so you can compete from any campus.',
    eligibility: [
      'Active Diploma, S1 or S2 students, or fresh graduates up to 6 months after graduation',
      'Teams of 2–3 people',
      'Members may come from different faculties, majors and universities',
    ],
    prizes: [
      { label: '1st place', value: 'Rp3.000.000' },
      { label: '2nd place', value: 'Rp2.000.000' },
      { label: '3rd place', value: 'Rp1.500.000' },
      { label: 'Finalists', value: 'Internship at partner companies, DANA office tour, career mentoring' },
    ],
    timeline: [
      { label: 'Registration closes', date: '2026-10-17' },
      { label: 'Semifinal submission', date: '2026-10-24' },
      { label: 'Finalists announced', date: '2026-11-04' },
      { label: 'Final submission', date: '2026-11-09' },
      { label: 'Final & awarding', date: '2026-11-15' },
    ],
  },
  {
    id: 'techno', title: 'TechnoScape Hackathon 9.0', org: 'BNCC × AD-INS', cat: 'Hackathon', group: 'Technology', interest: 'Hackathon',
    open: '2026-09-22', deadline: '2026-10-09', event: '2026-10-30', loc: 'Hybrid', place: 'Online preliminary · Final in Jakarta', fee: 135000,
    feeNote: 'Binusian early bird · Rp160k regular', min: 3, max: 5, facs: ['SOCS', 'SOIS', 'SOD'], skills: ['JavaScript', 'UI/UX', 'Business Model', 'Pitching'],
    teamsCount: 15, openRoles: 22, interested: 118, featured: true, poster: '/posters/techno.jpg', url: 'bncc.in/TechnoScapeHackathon26',
    tagline: 'Innovating core systems for inclusive financial solutions',
    overview: 'Build a working prototype on the theme of inclusive financial solutions, then pitch it to judges from AD-INS and BNCC. The preliminary round is online; finalists build and present on site.',
    eligibility: ['Active university students in Indonesia', 'Teams of 3–5 people', 'Binusian and non-Binusian teams welcome, with separate fees'],
    prizes: [{ label: 'Prize pool', value: 'Rp15.000.000' }, { label: 'All finalists', value: 'Certificate and merchandise' }],
    timeline: [
      { label: 'Registration closes', date: '2026-10-09' },
      { label: 'Preliminary round', date: '2026-10-19' },
      { label: 'Finalists announced', date: '2026-10-23' },
      { label: 'Technical meeting', date: '2026-10-26' },
      { label: 'Final stage', date: '2026-10-30' },
    ],
  },
  {
    id: 'dsc', title: 'Data Science Competition', org: 'Statistics Explore', cat: 'Data Science', group: 'Technology', interest: 'Data Science',
    open: '2026-09-15', deadline: '2026-10-20', event: '2026-11-18', loc: 'Online', place: 'Online', fee: 75000, feeNote: 'Early bird · Rp80k regular',
    min: 2, max: 2, facs: ['SOCS', 'SOIS'], skills: ['Python', 'Statistics', 'Data Visualization', 'SQL'], teamsCount: 6, openRoles: 6, interested: 41,
    poster: '/posters/dsc.jpg', tagline: 'Resilient economy: driving smart decisions for a sustainable future',
    overview: 'Pairs work through a public economic dataset, submit a notebook and a short report, and the top teams present their findings.',
  },
  {
    id: 'nuiux', title: 'Nusantara UI/UX Competition', org: 'Nusantara Design Collective', cat: 'UI/UX', group: 'Design', interest: 'UI/UX',
    open: '2026-09-01', deadline: '2026-10-12', event: '2026-10-24', loc: 'Online', place: 'Online', fee: 75000, min: 2, max: 3,
    facs: ['SOD', 'SOCS', 'SOIS'], skills: ['Figma', 'UI/UX', 'User Research'], teamsCount: 5, openRoles: 6, interested: 38,
    overview: 'Design a mobile experience for a public service and test it with real users.',
  },
  {
    id: 'yivc', title: 'Young Investor Valuation Challenge', org: 'Investor Club Indonesia', cat: 'Investment', group: 'Finance', interest: 'Investment',
    open: '2026-09-10', deadline: '2026-10-23', event: '2026-11-07', loc: 'Hybrid', place: 'Online · Final in Jakarta', fee: 100000, part: 'either', min: 1, max: 3,
    facs: ['BBS'], skills: ['Valuation', 'Financial Analysis', 'Excel'], teamsCount: 4, openRoles: 5, interested: 29,
    overview: 'Value a listed company and defend your recommendation in front of investors.',
  },
  {
    id: 'nmcc', title: 'National Marketing Case Competition', org: 'MarkComm Forum', cat: 'Marketing', group: 'Business', interest: 'Marketing',
    open: '2026-09-28', deadline: '2026-10-30', event: '2026-11-28', loc: 'Online', place: 'Online', fee: 120000, min: 3, max: 4,
    facs: ['BBS', 'SOD', 'SOH'], skills: ['Marketing', 'Market Research', 'Presentation'], teamsCount: 6, openRoles: 8, interested: 33,
    overview: 'Build a go-to-market plan for a local FMCG brand.',
  },
  {
    id: 'spc', title: 'Startup Pitch Competition 2026', org: 'Venture Society', cat: 'Entrepreneurship', group: 'Entrepreneurship', interest: 'Entrepreneurship',
    open: '2026-09-05', deadline: '2026-11-05', event: '2026-11-21', loc: 'Offline', place: 'Jakarta', fee: 0, min: 2, max: 4,
    facs: ['BBS', 'SOCS', 'SOD'], skills: ['Pitching', 'Business Model', 'Business Strategy'], teamsCount: 9, openRoles: 10, interested: 52,
    overview: 'Pitch an early-stage startup idea to angel investors.',
  },
  {
    id: 'ived', title: 'Indonesian Varsity English Debate', org: 'Debate Society Indonesia', cat: 'Debate', group: 'Debate', interest: 'Debate',
    open: '2026-09-18', deadline: '2026-10-21', event: '2026-11-13', loc: 'Offline', place: 'Yogyakarta', fee: 250000, min: 3, max: 3,
    facs: ['SOH', 'BBS'], skills: ['Public Speaking', 'English', 'Debate'], teamsCount: 3, openRoles: 4, interested: 19,
    overview: 'British Parliamentary format, three speakers per team.',
  },
  {
    id: 'nspc', title: 'National Scientific Paper Competition', org: 'Research Circle Indonesia', cat: 'Research', group: 'Research', interest: 'Research',
    open: '2026-09-12', deadline: '2026-10-28', event: '2026-11-20', loc: 'Online', place: 'Online', fee: 50000, min: 2, max: 3,
    facs: ['SOE', 'SOCS', 'SOH'], skills: ['Research', 'Academic Writing', 'Statistics'], teamsCount: 2, openRoles: 3, interested: 14,
    overview: 'Submit a paper on sustainable cities.',
  },
  {
    id: 'eic', title: 'Engineering Innovation Challenge', org: 'Indonesian Engineering Students Forum', cat: 'Engineering', group: 'Engineering', interest: 'Engineering',
    open: '2026-10-12', deadline: '2026-11-12', event: '2026-12-05', loc: 'Offline', place: 'Surabaya', fee: 200000, min: 2, max: 4,
    facs: ['SOE', 'SOCS'], skills: ['Research', 'Python'], teamsCount: 0, openRoles: 0, interested: 11,
    overview: 'Prototype a low-cost solution for rural energy access.',
  },
];

export const TEAMS: Team[] = [
  {
    id: 'apex', name: 'Apex', comp: 'nbcc', leader: 'dimas', members: ['dimas', 'sarah'], target: 3, avail: 'Weekends', level: 'Beginner friendly', comms: 'WhatsApp', lang: 'Bahasa Indonesia / English',
    about: 'We are a beginner-friendly team interested in business strategy and case competitions. We have the numbers covered and need someone who enjoys being on stage.',
    roles: [{ id: 'presenter', name: 'Presenter', qty: 1, skills: ['Presentation', 'Public Speaking', 'English', 'Pitch Deck'], note: 'Leads the final pitch and handles Q&A with the judges.' }],
  },
  {
    id: 'orion', name: 'Orion', comp: 'nbcc', leader: 'aditya', members: ['aditya'], target: 3, avail: 'Weekday evenings', level: 'Experienced preferred', comms: 'WhatsApp', lang: 'English',
    about: 'Aiming for the final this year. Looking for two people who like structure and deadlines.',
    roles: [
      { id: 'researcher', name: 'Researcher', qty: 1, skills: ['Market Research', 'Research', 'Excel'], note: 'Market sizing and the facts behind the recommendation.' },
      { id: 'designer', name: 'Designer', qty: 1, skills: ['Pitch Deck', 'Graphic Design'], note: 'Turns the analysis into a clear deck.' },
    ],
  },
  {
    id: 'kinara', name: 'Kinara', comp: 'nbcc', leader: 'rizky', members: ['rizky', 'alya'], target: 3, avail: 'Weekends', level: 'Beginner friendly', comms: 'LINE', lang: 'Bahasa Indonesia',
    about: 'Strategy plus research, missing the finance brain.',
    roles: [{ id: 'analyst', name: 'Financial Analyst', qty: 1, skills: ['Financial Analysis', 'Excel', 'Valuation'], note: 'Builds the projections.' }],
  },
  {
    id: 'meridian', name: 'Meridian', comp: 'nbcc', leader: 'clara', members: ['clara'], target: 3, avail: 'Flexible', level: 'Beginner friendly', comms: 'WhatsApp', lang: 'English',
    about: 'Debater looking for analytical teammates.',
    roles: [
      { id: 'analyst', name: 'Financial Analyst', qty: 1, skills: ['Financial Analysis', 'Excel'], note: 'Numbers and projections.' },
      { id: 'strategist', name: 'Business Strategist', qty: 1, skills: ['Business Strategy', 'Market Research'], note: 'Frames the recommendation.' },
    ],
  },
  {
    id: 'vega', name: 'Vega', comp: 'nbcc', leader: 'yoga', members: ['yoga', 'gilang'], target: 3, avail: 'Weekends', level: 'Beginner friendly', comms: 'WhatsApp', lang: 'Bahasa Indonesia',
    about: 'Two talkers, need someone who loves spreadsheets.',
    roles: [{ id: 'researcher', name: 'Researcher', qty: 1, skills: ['Market Research', 'Excel'], note: 'Data and sources.' }],
  },
  {
    id: 'atlas', name: 'Atlas', comp: 'nbcc', leader: 'jessica', members: ['jessica'], target: 2, avail: 'Weekday evenings', level: 'Beginner friendly', comms: 'Instagram DM', lang: 'Bahasa Indonesia',
    about: 'Designer looking for a business partner for a first case competition.',
    roles: [{ id: 'strategist', name: 'Business Strategist', qty: 1, skills: ['Business Strategy', 'Presentation'], note: 'Owns the case logic and pitch.' }],
  },
  {
    id: 'vertex', name: 'Vertex', comp: 'techno', leader: 'me', members: ['me', 'kevin', 'bima'], target: 5, avail: 'Weekends', level: 'Experienced preferred', comms: 'Discord', lang: 'English',
    about: 'Two developers and a business strategist building a lending tool for informal workers. We have the tech side covered; we need design and a strong pitch.',
    roles: [
      { id: 'designer', name: 'UI/UX Designer', qty: 1, skills: ['Figma', 'UI/UX', 'User Research'], note: 'Owns the prototype flows and the demo screens.' },
      { id: 'presenter', name: 'Presenter', qty: 1, skills: ['Presentation', 'Public Speaking', 'Pitching'], note: 'Delivers the demo and the 5-minute pitch.' },
    ],
  },
  {
    id: 'lumen', name: 'Lumen', comp: 'techno', leader: 'farhan', members: ['farhan', 'steven'], target: 4, avail: 'Weekday evenings', level: 'Experienced preferred', comms: 'Discord', lang: 'English',
    about: 'ML-heavy team, missing design and business.',
    roles: [
      { id: 'designer', name: 'UI/UX Designer', qty: 1, skills: ['Figma', 'UI/UX'], note: 'Prototype design.' },
      { id: 'strategist', name: 'Business Strategist', qty: 1, skills: ['Business Strategy', 'Pitching'], note: 'Business model and pitch.' },
    ],
  },
  {
    id: 'northstar', name: 'Northstar', comp: 'nmcc', leader: 'clarissa', members: ['clarissa', 'jessica'], target: 4, avail: 'Weekends', level: 'Beginner friendly', comms: 'WhatsApp', lang: 'Bahasa Indonesia / English',
    about: 'Marketing and design covered. Looking for a voice and a researcher.',
    roles: [
      { id: 'presenter', name: 'Presenter', qty: 1, skills: ['Presentation', 'Public Speaking', 'Marketing'], note: 'Presents the campaign.' },
      { id: 'researcher', name: 'Researcher', qty: 1, skills: ['Market Research', 'Research'], note: 'Consumer research.' },
    ],
  },
  {
    id: 'nexus', name: 'Nexus', comp: 'spc', leader: 'steven', members: ['steven', 'farhan'], target: 4, avail: 'Weekday evenings', level: 'Beginner friendly', comms: 'Telegram', lang: 'English',
    about: 'We have an MVP. We need someone to shape the business side.',
    roles: [
      { id: 'strategist', name: 'Business Strategist', qty: 1, skills: ['Business Strategy', 'Business Model', 'Pitching'], note: 'Business model and investor pitch.' },
      { id: 'designer', name: 'Designer', qty: 1, skills: ['Figma', 'Branding'], note: 'Brand and deck.' },
    ],
  },
  {
    id: 'quanta', name: 'Quanta', comp: 'dsc', leader: 'farhan', members: ['farhan'], target: 2, avail: 'Weekday evenings', level: 'Experienced preferred', comms: 'Discord', lang: 'English',
    about: 'Looking for a partner who likes clean analysis.',
    roles: [{ id: 'analyst', name: 'Data Analyst', qty: 1, skills: ['Python', 'Statistics', 'SQL'], note: 'Analysis and visualisation.' }],
  },
];

export const NOTIFICATIONS: Notification[] = [
  { id: 'n1', text: 'Livia Santoso applied to join Vertex as UI/UX Designer.', time: '1 hour ago', go: { to: 'manage', id: 'vertex' } },
  { id: 'n2', text: 'Nadia Chen wants to connect.', time: '3 hours ago', go: { to: 'profile', id: 'nadia' } },
  { id: 'n3', text: 'TechnoScape Hackathon 9.0 closes registration in 3 days.', time: 'Yesterday', go: { to: 'comp', id: 'techno' } },
  { id: 'n4', text: 'Fikri Hidayat applied to join Vertex as Presenter.', time: 'Yesterday', go: { to: 'manage', id: 'vertex' } },
  { id: 'n5', text: 'Your team Vertex is now Competition Eligible.', time: '2 days ago', go: { to: 'manage', id: 'vertex' } },
];
