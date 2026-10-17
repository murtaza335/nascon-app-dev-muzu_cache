import type { CartLine, ScreenData } from '../../types/models';
export type Command =
  | { kind: 'score'; matchId: string; eventType: 'score' | 'match_start' | 'match_end' | 'compensation'; teamId?: string; scoringEvent?: string; targetId?: string; reason?: string }
  | { kind: 'roster'; playerId: string; action: 'transfer' | 'loan' | 'release'; leagueId: string; toSquadId?: string; effectiveDate: string; loanEndDate?: string; reason: string }
  | { kind: 'addPlayer'; name: string; position: string; squadId: string; role: string; leagueId: string; clubId: string }
  | { kind: 'editPlayer'; playerId: string; name: string; position: string }
  | { kind: 'pin'; matchId: string; productId?: string }
  | { kind: 'checkout'; lines: CartLine[]; discount: string; payment: string }
  | { kind: 'orderTransition'; orderId: string; to: string };
export type ActionResult = { ok: true; id?: string; queued?: boolean; message: string } | { ok: false; code: string; message: string };
export function queuePayload(command: Extract<Command, { kind: 'score' | 'roster' }>, data: ScreenData, requestId: string, userId: string) {
  if (command.kind === 'score') return { event_id: requestId, match_id: command.matchId, type: command.eventType,
    payload: command.eventType === 'score' ? { team_id: command.teamId, event_type: command.scoringEvent } : command.eventType === 'compensation' ? { compensates: command.targetId, reason: command.reason } : {} };
  const player = data.players.find(x => x.player_id === command.playerId);
  const registration = data.registrations?.find(x => x.player_id === command.playerId && x.league_id === command.leagueId);
  return { request_id: requestId, league_id: command.leagueId, player_id: command.playerId, type: command.action, from_squad_id: data.registrations ? registration?.squad_id : player?.squad_id,
    to_squad_id: command.action === 'release' ? null : command.toSquadId, effective_date: command.effectiveDate, loan_end_date: command.loanEndDate || null, reason: command.reason, requested_by: userId };
}
