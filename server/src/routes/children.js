import crypto from 'node:crypto';
import { Router } from 'express';
import { authorizeChild, authorizeThread, threadRoom } from '../access.js';
import { MAX_FILES, deleteAttachment, storeAttachment, upload } from '../attachments.js';
import { HttpError, requireAuth, requireRole } from '../auth.js';
import { Child } from '../models/Child.js';
import { Invite } from '../models/Invite.js';
import { Message, cleanCard, cleanDetails } from '../models/Message.js';
import { isOnline, markMessages, userRoom } from '../receipts.js';
import { User } from '../models/User.js';

export const childrenRouter = Router();
childrenRouter.use(requireAuth);

const INVITE_DAYS = 7;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

/** Therapist creates or updates the cloud copy of a child they own. */
childrenRouter.put('/:id', requireRole('therapist'), async (req, res) => {
  const { name, age, focus, plan } = req.body ?? {};
  const existing = await Child.findById(req.params.id);
  if (existing && !existing.therapistId.equals(req.user._id)) throw new HttpError(403, 'Child belongs to another therapist');
  const child = existing ?? new Child({ _id: req.params.id, therapistId: req.user._id });
  Object.assign(child, { name, age, focus, plan: plan ?? {} });
  await child.save();
  res.json({ child: child.toPublic() });
});

childrenRouter.get('/:id', async (req, res) => {
  const child = await authorizeChild(req.user, req.params.id);
  res.json({ child: child.toPublic() });
});

/** Therapist issues a one-use, 7-day invitation for a parent. The raw token is returned only here. */
childrenRouter.post('/:id/invites', requireRole('therapist'), async (req, res) => {
  const child = await Child.findById(req.params.id);
  if (!child || !child.therapistId.equals(req.user._id)) throw new HttpError(404, 'Child not found');
  const token = crypto.randomBytes(32).toString('hex');
  await Invite.create({
    childId: child._id,
    therapistId: req.user._id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
  });
  res.status(201).json({ token });
});

/** Therapist lists the private parent threads for a child. */
childrenRouter.get('/:id/conversations', requireRole('therapist'), async (req, res) => {
  const child = await Child.findById(req.params.id);
  if (!child || !child.therapistId.equals(req.user._id)) throw new HttpError(404, 'Child not found');
  const [parents, latest] = await Promise.all([
    User.find({ _id: { $in: child.parentIds } }, { displayName: 1 }),
    Message.aggregate([
      { $match: { childId: child._id, parentId: { $in: child.parentIds } } },
      { $group: { _id: '$parentId', lastMessageAt: { $max: '$createdAt' } } },
    ]),
  ]);
  const lastBy = new Map(latest.map((row) => [row._id.toString(), row.lastMessageAt]));
  const conversations = child.parentIds.map((id) => {
    const parent = parents.find((p) => p._id.equals(id));
    return {
      parentId: id.toString(),
      displayName: parent?.displayName || 'Parent',
      lastMessageAt: lastBy.get(id.toString())?.toISOString() ?? null,
    };
  });
  res.json({ conversations });
});

childrenRouter.get('/:id/conversations/:parentId/messages', async (req, res) => {
  const { id, parentId } = req.params;
  await authorizeThread(req.user, id, parentId);
  // Fetching the thread means the other person's messages have reached this device.
  await markMessages(req.app.get('io'), { childId: id, parentId, senderId: { $ne: req.user._id } });
  const messages = await Message.find({ childId: id, parentId }).sort({ createdAt: 1 }).limit(500);
  res.json({ messages: messages.map((m) => m.toNote()) });
});

/** The reader has the conversation open: mark the other person's messages as read. */
childrenRouter.post('/:id/conversations/:parentId/read', async (req, res) => {
  const { id, parentId } = req.params;
  await authorizeThread(req.user, id, parentId);
  const read = await markMessages(req.app.get('io'), { childId: id, parentId, senderId: { $ne: req.user._id } }, { read: true });
  res.json({ read });
});

/**
 * Accepts JSON `{ text, details, card }` or multipart form data: `text`, `details` and `card` (JSON), up to 5 `files`,
 * and `meta` (JSON array, e.g. voice note durations).
 */
childrenRouter.post(
  '/:id/conversations/:parentId/messages',
  // Check access before buffering any upload.
  async (req, _res, next) => {
    req.child = await authorizeThread(req.user, req.params.id, req.params.parentId, { write: true });
    next();
  },
  upload.array('files', MAX_FILES),
  async (req, res) => {
    const { id, parentId } = req.params;
    const body = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const files = req.files ?? [];
    const details = cleanDetails(req.body?.details);
    const card = cleanCard(req.body?.card);
    if (req.body?.card && !card) throw new HttpError(400, 'Invalid card');
    if (!body && files.length === 0 && !details && !card) {
      throw new HttpError(400, 'Write a message, add an attachment or add check-in details');
    }
    if (body.length > 4000) throw new HttpError(400, 'Message must be 4000 characters or fewer');
    let meta = [];
    try {
      meta = typeof req.body?.meta === 'string' ? JSON.parse(req.body.meta) : [];
    } catch {}
    if (!Array.isArray(meta)) meta = [];

    const owner = { childId: id, parentId, uploaderId: req.user._id.toString() };
    const io = req.app.get('io');
    const recipientId = req.user.role === 'parent' ? req.child.therapistId : parentId;
    const delivered = await isOnline(io, recipientId);
    const attachments = [];
    let message;
    try {
      for (const [i, file] of files.entries()) attachments.push(await storeAttachment(file, meta[i], owner));
      // Sender identity and role come from the session, never from the request body.
      message = await Message.create({
        childId: id,
        parentId,
        senderId: req.user._id,
        authorRole: req.user.role,
        body,
        attachments,
        details,
        card,
        recipientId,
        deliveredAt: delivered ? new Date() : null,
      });
    } catch (err) {
      await Promise.all(attachments.map((a) => deleteAttachment(a.fileId)));
      throw err;
    }
    const note = message.toNote();
    io?.to(threadRoom(id, parentId)).to(userRoom(recipientId)).emit('message', note);
    res.status(201).json({ message: note });
  },
);
