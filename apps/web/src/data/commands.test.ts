import { describe, expect, it } from 'vitest';
import { executeApply, executeDecision, executeInvite, executeAnswerInvite, handleStoreRequest } from './commands';
import { defaultState, type AppState } from './state';
import { team } from './model';

function testState(): AppState {
  const s = defaultState();
  return {
    ...s,
    authed: true,
    apps: {},
    managed: {
      vertex: {
        target: 5,
        closed: false,
        added: [],
        filled: [],
        apps: [
          {
            id: 'v1',
            pid: 'livia',
            role: 'designer',
            status: 'pending',
            when: '1 hour ago',
            msg: 'Experienced designer for hackathon flows',
            shareContact: true,
          },
          {
            id: 'v2',
            pid: 'fikri',
            role: 'presenter',
            status: 'pending',
            when: 'Yesterday',
            msg: 'Experienced presenter for final pitch',
            shareContact: false,
          },
        ],
      },
    },
    vx: {
      target: 5,
      closed: false,
      added: [],
      filled: [],
      apps: [
        {
          id: 'v1',
          pid: 'livia',
          role: 'designer',
          status: 'pending',
          when: '1 hour ago',
          msg: 'Experienced designer for hackathon flows',
          shareContact: true,
        },
        {
          id: 'v2',
          pid: 'fikri',
          role: 'presenter',
          status: 'pending',
          when: 'Yesterday',
          msg: 'Experienced presenter for final pitch',
          shareContact: false,
        },
      ],
    },
  };
}

describe('P0-1 & P0-2 Domain Commands', () => {
  describe('executeApply', () => {
    it('submits application to recruiting team with message and contact preference', () => {
      const s = testState();
      const res = executeApply(s, {
        teamId: 'apex',
        roleId: 'presenter',
        message: 'I have experience in public speaking and pitching.',
        shareContact: true,
      });

      expect(res.applicationId).toBeDefined();
      const app = res.nextState.apps.apex;
      expect(app).toBeDefined();
      expect(app.role).toBe('presenter');
      expect(app.status).toBe('pending');
      expect(app.msg).toBe('I have experience in public speaking and pitching.');
      expect(app.shareContact).toBe(true);
    });

    it('rejects unauthenticated user', () => {
      const s = { ...testState(), authed: false };
      expect(() =>
        executeApply(s, {
          teamId: 'apex',
          roleId: 'presenter',
          message: 'I have experience in public speaking and pitching.',
        }),
      ).toThrow('Sign in required');
    });

    it('rejects application message shorter than 10 characters', () => {
      const s = testState();
      expect(() =>
        executeApply(s, {
          teamId: 'apex',
          roleId: 'presenter',
          message: 'Hi!',
        }),
      ).toThrow('Application message needs 10–2000 chars');
    });

    it('rejects applying to own team', () => {
      const s = testState();
      expect(() =>
        executeApply(s, {
          teamId: 'vertex',
          roleId: 'designer',
          message: 'I would like to apply to my own team please.',
        }),
      ).toThrow('This is your own team.');
    });

    it('rejects duplicate application', () => {
      const s = testState();
      const { nextState } = executeApply(s, {
        teamId: 'apex',
        roleId: 'presenter',
        message: 'First application message with enough characters.',
      });
      expect(() =>
        executeApply(nextState, {
          teamId: 'apex',
          roleId: 'presenter',
          message: 'Duplicate application message with enough characters.',
        }),
      ).toThrow('This application has already been submitted.');
    });

    it('rejects applying when user is already in another team for the same competition', () => {
      const s = testState();
      // User 'me' is leader of vertex, which competes in 'techno'.
      // lumen also competes in 'techno'.
      expect(() =>
        executeApply(s, {
          teamId: 'lumen',
          roleId: 'designer',
          message: 'I want to join lumen even though I am in vertex.',
        }),
      ).toThrow('already a member of another team for this competition');
    });
  });

  describe('executeDecision', () => {
    it('leader accepts applicant atomically: member added, role filled, status accepted', () => {
      const s = testState();
      const res = executeDecision(s, {
        applicationId: 'v1',
        action: 'accept',
        actorId: 'me',
      });

      const managedVertex = res.nextState.managed!.vertex;
      expect(managedVertex.added).toContain('livia');
      expect(managedVertex.filled).toContain('designer');
      const app = managedVertex.apps.find((a) => a.id === 'v1');
      expect(app?.status).toBe('accepted');

      const tv = team('vertex', res.nextState);
      expect(tv.members).toContain('livia');
    });

    it('avoids double accept: repeat accept is idempotent without duplicate members', () => {
      const s = testState();
      const once = executeDecision(s, {
        applicationId: 'v1',
        action: 'accept',
        actorId: 'me',
      });
      const twice = executeDecision(once.nextState, {
        applicationId: 'v1',
        action: 'accept',
        actorId: 'me',
      });

      const managed = twice.nextState.managed!.vertex;
      expect(managed.added.filter((m) => m === 'livia')).toHaveLength(1);
    });

    it('atomically withdraws competing pending requests for the same competition upon accept', () => {
      const s = testState();
      // livia applies to vertex (techno) and lumen (also techno)
      const lumenManaged = {
        target: 4,
        closed: false,
        added: [],
        filled: [],
        apps: [
          {
            id: 'l1',
            pid: 'livia',
            role: 'designer',
            status: 'pending' as const,
            when: 'Today',
            msg: 'Applying to lumen too',
          },
        ],
      };
      const stateWithCompeting: AppState = {
        ...s,
        managed: {
          ...s.managed,
          lumen: lumenManaged,
        },
      };

      // Vertex accepts livia
      const accepted = executeDecision(stateWithCompeting, {
        applicationId: 'v1',
        action: 'accept',
        actorId: 'me',
      });

      // Livia should now be in vertex
      expect(accepted.nextState.managed!.vertex.added).toContain('livia');
      // Livia's application to lumen in the same competition must be withdrawn!
      const lumenApp = accepted.nextState.managed!.lumen.apps.find((a) => a.id === 'l1');
      expect(lumenApp?.status).toBe('withdrawn');
    });

    it('leader declines applicant without adding member', () => {
      const s = testState();
      const res = executeDecision(s, {
        applicationId: 'v1',
        action: 'decline',
        actorId: 'me',
      });

      const app = res.nextState.managed!.vertex.apps.find((a) => a.id === 'v1');
      expect(app?.status).toBe('declined');
      expect(res.nextState.managed!.vertex.added).not.toContain('livia');
    });

    it('applicant can withdraw pending application', () => {
      const s = testState();
      const { nextState } = executeApply(s, {
        teamId: 'apex',
        roleId: 'presenter',
        message: 'Valid application message for apex team.',
      });

      const appId = nextState.apps.apex.id!;
      const withdrawn = executeDecision(nextState, {
        applicationId: appId,
        action: 'withdraw',
        actorId: 'me',
      });

      expect(withdrawn.nextState.apps.apex.status).toBe('withdrawn');
    });

    it('rejects withdrawing an accepted membership', () => {
      const s = testState();
      s.apps.apex = {
        id: 'accepted-app',
        role: 'presenter',
        status: 'accepted',
        when: 'Yesterday',
      };

      expect(() =>
        executeDecision(s, {
          applicationId: 'accepted-app',
          action: 'withdraw',
          actorId: 'me',
        }),
      ).toThrow('accepted members cannot withdraw');
    });

    it('rejects accept when team capacity is reached (full team)', () => {
      const s = testState();
      // Lower target so vertex is already full: 3 members (me, kevin, bima), target 3
      s.managed!.vertex.target = 3;
      s.vx.target = 3;

      expect(() =>
        executeDecision(s, {
          applicationId: 'v1',
          action: 'accept',
          actorId: 'me',
        }),
      ).toThrow('Team has reached member target');
    });
  });

  describe('executeInvite and executeAnswerInvite', () => {
    it('creates invitations with unique IDs that do not overwrite each other', () => {
      const s = testState();
      const inv1 = executeInvite(s, {
        teamId: 'vertex',
        userId: 'livia',
        roleId: 'designer',
        actorId: 'me',
      });
      const inv2 = executeInvite(inv1.nextState, {
        teamId: 'vertex',
        userId: 'fikri',
        roleId: 'presenter',
        actorId: 'me',
      });

      expect(inv1.invitationId).not.toEqual(inv2.invitationId);
      expect(inv2.nextState.invites[inv1.invitationId]).toBeDefined();
      expect(inv2.nextState.invites[inv2.invitationId]).toBeDefined();
    });

    it('recipient accepts invite: added to roster and competing pending applications withdrawn', () => {
      const s = testState();
      const incomingState: AppState = {
        ...s,
        incomingInvites: [
          { id: 'inv-apex', team_id: 'apex', role_id: 'presenter' },
        ],
        apps: {
          orion: {
            id: 'orion-app',
            role: 'researcher',
            status: 'pending',
            when: 'Yesterday',
          },
        },
      };

      const accepted = executeAnswerInvite(incomingState, {
        invitationId: 'inv-apex',
        action: 'accept',
        shareContact: true,
      });

      expect(accepted.nextState.apps.apex.status).toBe('accepted');
      expect(accepted.nextState.incomingInvites).toEqual([]);
      // Since apex and orion both compete in nbcc, orion application must be withdrawn!
      expect(accepted.nextState.apps.orion.status).toBe('withdrawn');
    });
  });

  describe('handleStoreRequest dispatch', () => {
    it('routes POST /teams/:id/applications', () => {
      const s = testState();
      const res = handleStoreRequest(s, '/teams/apex/applications', 'POST', {
        role_id: 'presenter',
        message: 'Applying via store request router with valid length.',
      });
      expect(res.nextState.apps.apex?.status).toBe('pending');
    });

    it('routes POST /applications/:id/accept', () => {
      const s = testState();
      const res = handleStoreRequest(s, '/applications/v1/accept', 'POST', {});
      expect(res.nextState.managed!.vertex.added).toContain('livia');
    });
  });

  describe('P1-3 Real identity, profile onboarding, and team creation', () => {
    it('creates clean account on signup without inheriting demo state', () => {
      const s = defaultState();
      const res = handleStoreRequest(s, '/signup', 'POST', {
        email: 'alice@example.com',
        name: 'Alice Wonder',
      });
      expect(res.nextState.authed).toBe(true);
      expect(res.nextState.account?.name).toBe('Alice Wonder');
      expect(res.nextState.account?.email).toBe('alice@example.com');
      expect(Object.keys(res.nextState.apps).length).toBe(0);
      expect(Object.keys(res.nextState.conns).length).toBe(0);
      expect(res.nextState.saved.length).toBe(0);
      expect(res.nextState.vx.apps.length).toBe(0);
    });

    it('creates demo session on demo login', () => {
      const s = defaultState();
      const res = handleStoreRequest(s, '/login', 'POST', {
        email: 'demo@compmate.id',
      });
      expect(res.nextState.authed).toBe(true);
      expect(res.nextState.account?.name).toBe('Maya Chen');
    });

    it('clears session on logout', () => {
      const s = { ...defaultState(), authed: true };
      const res = handleStoreRequest(s, '/logout', 'POST', {});
      expect(res.nextState.authed).toBe(false);
      expect(res.nextState.account).toBeNull();
    });

    it('updates user profile via PUT /profile', () => {
      const s = {
        ...defaultState(),
        authed: true,
        actorId: 'me',
        account: {
          id: 'me',
          name: 'Maya Chen',
          email: 'maya@example.com',
          campus: 'Anggrek',
          skills: 'Design',
          availability: 'Flexible',
          about: '',
          contact: '',
          share_contact: false,
          admin: false,
        },
      };
      const res = handleStoreRequest(s, '/profile', 'PUT', {
        name: 'Maya Updated',
        skills: 'Figma, React, TypeScript',
        contact: 'maya@chat.id',
        share_contact: true,
        presentation: {
          roles: ['Product Designer'],
          level: 'Experienced',
        },
      });
      expect(res.nextState.account?.name).toBe('Maya Updated');
      expect(res.nextState.account?.skills).toBe('Figma, React, TypeScript');
      expect(res.nextState.account?.share_contact).toBe(true);
    });

    it('creates and deletes teams with boundary validation via POST /teams and DELETE /teams/:id', () => {
      const s = {
        ...defaultState(),
        authed: true,
        actorId: 'new_leader',
        account: {
          id: 'new_leader',
          name: 'New Leader',
          email: 'leader@example.com',
          campus: 'Anggrek',
          skills: 'Engineering',
          availability: 'Weekends',
          about: '',
          contact: '',
          share_contact: false,
          admin: false,
        },
      };

      // Successfully create a team
      const createRes = handleStoreRequest(s, '/teams', 'POST', {
        name: 'Quantum Pioneers',
        competition_id: 'nbcc',
        capacity: 3,
        about: 'Pushing boundaries',
        presentation: { avail: 'Weekends', level: 'Beginner friendly' },
        roles: [{ name: 'Analyst', capacity: 2, skills: 'Excel, Python' }],
      });

      const newTid = (createRes.response as { id: string }).id;
      expect(newTid).toBeDefined();
      expect(createRes.nextState.managed?.[newTid]).toBeDefined();
      expect(createRes.nextState.managed?.[newTid].target).toBe(3);

      // Successfully delete the team
      const delRes = handleStoreRequest(createRes.nextState, `/teams/${newTid}`, 'DELETE', {});
      expect(delRes.nextState.managed?.[newTid]).toBeUndefined();
    });

    it('rejects team creation if capacity is outside competition bounds', () => {
      const s = { ...defaultState(), authed: true, actorId: 'me' };
      expect(() =>
        handleStoreRequest(s, '/teams', 'POST', {
          name: 'Too Big Team',
          competition_id: 'nbcc', // nbcc min: 2, max: 3
          capacity: 50,
        }),
      ).toThrow();
    });
  });
});
