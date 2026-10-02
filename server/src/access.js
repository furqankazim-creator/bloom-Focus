import mongoose from 'mongoose';
import { HttpError } from './auth.js';
import { Child } from './models/Child.js';

export const threadRoom = (childId, parentId) => `thread:${childId}:${parentId}`;

const isLinkedParent = (child, userId) => child.parentIds.some((id) => id.equals(userId));

/**
 * Loads a child and checks the user may use the one-to-one thread with `parentId`.
 * - A parent may only use their own thread, and only while linked to the child.
 * - The child's therapist may read any of the child's threads and write to linked parents.
 */
export async function authorizeThread(user, childId, parentId, { write = false } = {}) {
  if (typeof childId !== 'string' || !mongoose.isValidObjectId(parentId)) {
    throw new HttpError(400, 'Invalid conversation');
  }
  const child = await Child.findById(childId);
  if (!child) throw new HttpError(404, 'Conversation not found');

  const parentLinked = child.parentIds.some((id) => id.equals(parentId));
  if (user.role === 'parent') {
    if (!user._id.equals(parentId) || !isLinkedParent(child, user._id)) {
      throw new HttpError(404, 'Conversation not found');
    }
  } else if (!child.therapistId.equals(user._id)) {
    throw new HttpError(404, 'Conversation not found');
  } else if (write && !parentLinked) {
    throw new HttpError(403, 'This parent is no longer linked to the child');
  }
  return child;
}

/** Loads a child visible to the user (its therapist or a linked parent). */
export async function authorizeChild(user, childId) {
  const child = await Child.findById(childId);
  if (!child || !(child.therapistId.equals(user._id) || isLinkedParent(child, user._id))) {
    throw new HttpError(404, 'Child not found');
  }
  return child;
}
