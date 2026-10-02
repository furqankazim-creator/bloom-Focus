import crypto from 'node:crypto';
import { Router } from 'express';
import { HttpError, requireAuth, requireRole } from '../auth.js';
import { Child } from '../models/Child.js';
import { Invite } from '../models/Invite.js';

export const invitesRouter = Router();

/** Parent redeems an invitation token and becomes linked to the child. */
invitesRouter.post('/claim', requireAuth, requireRole('parent'), async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  if (!/^[0-9a-f]{64}$/.test(token)) throw new HttpError(400, 'Invitation code is invalid or expired');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  // Atomic single-use redemption: only one request can flip redeemedAt from null.
  const invite = await Invite.findOneAndUpdate(
    { tokenHash, redeemedAt: null, expiresAt: { $gt: new Date() } },
    { redeemedAt: new Date(), redeemedBy: req.user._id },
    { returnDocument: 'after' },
  );
  if (!invite) throw new HttpError(400, 'Invitation code is invalid, expired, or already used');
  const child = await Child.findByIdAndUpdate(
    invite.childId,
    { $addToSet: { parentIds: req.user._id } },
    { returnDocument: 'after' },
  );
  if (!child) throw new HttpError(404, 'Child not found');
  res.json({ child: child.toPublic() });
});
