import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Everyone signs up as a parent. Therapists are promoted by an administrator (npm run promote).
    role: { type: String, enum: ['parent', 'therapist'], default: 'parent' },
    displayName: { type: String, default: '', maxlength: 100 },
  },
  { timestamps: true },
);

userSchema.methods.toProfile = function toProfile() {
  return { id: this._id.toString(), role: this.role, displayName: this.displayName };
};

export const User = mongoose.model('User', userSchema);
