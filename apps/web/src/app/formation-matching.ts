interface RecruitingTeam {
    eligible: boolean;
    roles: {
        skills: string;
        capacity: number;
        filled: number;
    }[];
}
const tokens = (skills: string) => [...new Set(skills.toLowerCase().split(',').map(s => s.trim()).filter(Boolean))];
/** Eligibility comes from server; never score an ineligible team or a filled role. */
export function rankEligibleTeams<T extends RecruitingTeam>(teams: T[], profileSkills: string) {
    const skills = tokens(profileSkills);
    return teams.filter(team => team.eligible).map(team => ({
        team,
        skills: skills.filter(skill => team.roles.some(role => role.filled < role.capacity && tokens(role.skills).includes(skill))),
    })).sort((a, b) => b.skills.length - a.skills.length);
}
