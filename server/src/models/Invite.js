import mongoose from 'mongoose';

const inviteSchema = new mongoose.Schema(
  {
    childId: { type: String, ref: 'Child', required: true },
    therapistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Only the SHA-256 of the token is stored; the token itself is shown once to the therapist.
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    redeemedAt: { type: Date, default: null },
    redeemedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export const Invite = mongoose.model('Invite', inviteSchema);
