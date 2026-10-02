import { threadRoom } from './access.js';
import { Message } from './models/Message.js';

export const userRoom = (userId) => `user:${userId}`;

/**
 * Marks matching messages delivered (and optionally read) and tells each affected thread,
 * so the sender's ticks update live. Returns the number of messages changed.
 */
export async function markMessages(io, filter, { read = false } = {}) {
  const field = read ? 'readAt' : 'deliveredAt';
  const rows = await Message.find({ ...filter, [field]: null }, { childId: 1, parentId: 1 });
  if (rows.length === 0) return 0;
  const now = new Date();
  const ids = rows.map((r) => r._id);
  await Message.updateMany({ _id: { $in: ids }, deliveredAt: null }, { deliveredAt: now });
  if (read) await Message.updateMany({ _id: { $in: ids } }, { readAt: now });

  const byThread = new Map();
  for (const r of rows) {
    const key = threadRoom(r.childId, r.parentId);
    byThread.set(key, [...(byThread.get(key) ?? []), r._id.toString()]);
  }
  const at = now.toISOString();
  for (const [room, threadIds] of byThread) {
    io?.to(room).emit('receipts', { ids: threadIds, deliveredAt: at, ...(read ? { readAt: at } : {}) });
  }
  return rows.length;
}

/** True when the user has the app open (any connected socket). */
export async function isOnline(io, userId) {
  if (!io) return false;
  return (await io.in(userRoom(userId)).fetchSockets()).length > 0;
}
