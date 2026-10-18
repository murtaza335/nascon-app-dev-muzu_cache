'use strict';
// Pure co-stream rules (BR-CS, spec §5.5). Check order is binding; each function is one step.
const LAYOUTS = ['solo', 'grid_2', 'grid_4', 'spotlight'];
const MAX_PARTICIPANTS = 4;
const CAPACITY = { solo: 1, grid_2: 2, grid_4: 4, spotlight: 4 };

// Step 5: host drop handoff → active state.
function handoff(host, participants, simulateDrop) {
  if (!simulateDrop) return { active_host: host, handoff_occurred: false, active_participants: [...participants], status: 'active' };
  const remaining = participants.filter((p) => p !== host);
  if (participants.length >= 2) return { active_host: remaining[0], handoff_occurred: true, active_participants: remaining, status: 'active' };
  return { active_host: null, handoff_occurred: false, active_participants: [], status: 'terminated' };
}

const isFull = (participants) => participants.length > MAX_PARTICIPANTS;

// Step 4: layout capacity against the effective (post-drop) participant count.
const layoutFits = (layout, effectiveCount) => effectiveCount <= (CAPACITY[layout] ?? MAX_PARTICIPANTS);

const sigPayload = (r) => ({
  active_host: r.active_host, handoff_occurred: r.handoff_occurred, layout: r.layout,
  participant_count: r.participant_count, session_id: r.session_id, status: r.status,
});

// Host leaving a live session (API-D2-44 / real host drop): next participant in array order, none → terminated.
function removeParticipant(participants, activeParticipants, activeHost, leaving) {
  const nextActive = activeParticipants.filter((p) => p !== leaving);
  const hostLeft = leaving === activeHost;
  const active_host = hostLeft ? (nextActive[0] ?? null) : activeHost;
  return {
    active_participants: nextActive, active_host, handoff_occurred: hostLeft && nextActive.length > 0,
    status: nextActive.length ? 'active' : 'terminated', participants,
  };
}

module.exports = { LAYOUTS, MAX_PARTICIPANTS, handoff, isFull, layoutFits, sigPayload, removeParticipant };
