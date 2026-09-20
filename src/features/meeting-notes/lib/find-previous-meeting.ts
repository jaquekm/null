export interface MeetingItemForLookup {
  id: string;
  title: string;
  createdAt: string;
  participantIds: string[];
}

/**
 * Reunião mais recente (3.7, "Última reunião com estes participantes") que
 * compartilha pelo menos um participante com a reunião sendo criada agora —
 * nunca ela mesma. Empate: a mais recente por `createdAt` vence.
 */
export function findPreviousMeeting(
  meetings: MeetingItemForLookup[],
  currentParticipantIds: string[],
  excludeItemId?: string,
): MeetingItemForLookup | null {
  if (currentParticipantIds.length === 0) return null;
  const participantSet = new Set(currentParticipantIds);

  const candidates = meetings.filter(
    (meeting) => meeting.id !== excludeItemId && meeting.participantIds.some((id) => participantSet.has(id)),
  );
  if (candidates.length === 0) return null;

  return candidates.reduce((latest, current) => (new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest));
}
