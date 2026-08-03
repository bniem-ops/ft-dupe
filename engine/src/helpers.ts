import { PlayerState } from './types.js';

export function getPlayer(players: PlayerState[], id: string): PlayerState {
  const player = players.find((p) => p.id === id);
  if (!player) throw new Error(`Unknown player: ${id}`);
  return player;
}

export function replacePlayer(players: PlayerState[], updated: PlayerState): PlayerState[] {
  return players.map((p) => (p.id === updated.id ? updated : p));
}
