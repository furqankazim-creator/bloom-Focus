import { useStore } from '../store/useStore';
import type { Role } from '../types';
import { getCloudProfile, isCloudConfigured, listCloudConversations, sendCloudNote, type OutgoingNote } from './api';

/**
 * Posts into the child's conversation from anywhere in the app (game results, weekly progress…).
 * A signed-in parent posts to their own private thread; a signed-in therapist posts into each
 * linked parent's private thread separately. Otherwise it is saved to the on-device demo conversation.
 */
export async function postToConversation(childId: string, role: Role, message: OutgoingNote): Promise<void> {
  if (isCloudConfigured) {
    const profile = await getCloudProfile();
    if (profile?.role === 'parent') {
      await sendCloudNote(childId, profile.id, message);
      return;
    }
    if (profile?.role === 'therapist') {
      const threads = await listCloudConversations(childId);
      if (threads.length === 0) throw new Error('No parent has joined this child’s conversation yet.');
      await Promise.all(threads.map((t) => sendCloudNote(childId, t.parentId, message)));
      return;
    }
  }
  useStore.getState().addNote(childId, role, message.text, { details: message.details, card: message.card });
}
