import mongoose from 'mongoose';
import { signedFileUrl } from '../attachments.js';

const attachmentSchema = new mongoose.Schema(
  {
    fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ['image', 'audio', 'file'], required: true },
    mimeType: { type: String, required: true },
    name: { type: String, required: true },
    size: { type: Number, required: true },
    durationMs: { type: Number },
  },
  { _id: false },
);

export const SLEEP_VALUES = ['good', 'okay', 'poor'];
export const TAG_VALUES = ['win', 'question', 'challenge', 'home-practice', 'school', 'routine'];

/** Keeps only known check-in fields; returns undefined when nothing valid is left. */
export function cleanDetails(raw) {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out = {};
  if ([1, 2, 3, 4, 5].includes(raw.mood)) out.mood = raw.mood;
  if (SLEEP_VALUES.includes(raw.sleep)) out.sleep = raw.sleep;
  if (Array.isArray(raw.tags)) {
    const tags = [...new Set(raw.tags.filter((t) => TAG_VALUES.includes(t)))];
    if (tags.length) out.tags = tags;
  }
  return Object.keys(out).length ? out : undefined;
}

// Cards link a message to an activity, a game result, a weekly progress snapshot or a daily routine.
// Each field is typed; anything unknown is dropped and a card missing a required field is rejected.
const CARD_FIELDS = {
  activity: {
    taskId: 'id',
    level: 'num',
    minutes: 'num',
    frequency: 'str?',
    supportLevel: 'support?',
    rewardTip: 'str?',
    therapistNote: 'text?',
    customId: 'id?',
    title: 'str?',
    heroEmoji: 'emoji?',
  },
  result: {
    taskId: 'id',
    sessionId: 'id',
    accuracy: 'ratio|null',
    stars: 'num',
    levelBefore: 'num',
    levelAfter: 'num',
    activeSec: 'num',
    title: 'str?',
    heroEmoji: 'emoji?',
  },
  progress: {
    weekOf: 'str',
    sessions: 'num',
    goal: 'num',
    minutes: 'num',
    stars: 'num',
    prevSessions: 'num',
    avgAccuracy: 'ratio|null',
    prevAvgAccuracy: 'ratio|null',
    levelUps: 'num',
    strongest: 'skill?',
    practiceMore: 'skill?',
  },
  routine: {
    title: 'str',
    steps: 'steps',
    timeOfDay: 'str?',
    supportLevel: 'support?',
    therapistNote: 'text?',
  },
};

const isId = (v) => typeof v === 'string' && /^[\w-]{1,64}$/.test(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e6;
const isRatio = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const SUPPORT_LEVELS = new Set(['independent', 'prompt', 'hands-on']);
const MAX_STEPS = 8;
const cleanStep = (v) => typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : undefined;

function cleanField(kind, v) {
  switch (kind.replace('?', '')) {
    case 'id':
      return isId(v) ? v : undefined;
    case 'num':
      return isNum(v) ? v : undefined;
    case 'ratio|null':
      return v === null ? null : isRatio(v) ? v : undefined;
    case 'str':
      return typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : undefined;
    case 'emoji':
      // A single emoji or short symbol (no letters/markup), at most 16 UTF-16 units.
      return typeof v === 'string' && v.length > 0 && v.length <= 16 && !/[<>\w]/.test(v) ? v : undefined;
    case 'text':
      return typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : undefined;
    case 'support':
      return typeof v === 'string' && SUPPORT_LEVELS.has(v) ? v : undefined;
    case 'steps':
      if (!Array.isArray(v)) return undefined;
      const cleaned = v.map(cleanStep).filter((x) => x !== undefined);
      return cleaned.length >= 1 && cleaned.length <= MAX_STEPS ? cleaned : undefined;
    case 'skill':
      return v && isId(v.taskId) && isRatio(v.accuracy) ? { taskId: v.taskId, accuracy: v.accuracy } : undefined;
    default:
      return undefined;
  }
}

export function cleanCard(raw) {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  const fields = raw && typeof raw === 'object' ? CARD_FIELDS[raw.type] : undefined;
  if (!fields) return undefined;
  const out = { type: raw.type };
  for (const [key, kind] of Object.entries(fields)) {
    const value = cleanField(kind, raw[key]);
    if (value === undefined) {
      if (!kind.endsWith('?')) return undefined;
    } else {
      out[key] = value;
    }
  }
  return out;
}

const detailsSchema = new mongoose.Schema(
  {
    mood: { type: Number, min: 1, max: 5 },
    sleep: { type: String, enum: SLEEP_VALUES },
    tags: { type: [{ type: String, enum: TAG_VALUES }], default: undefined },
  },
  { _id: false },
);

// A thread is (childId, parentId): the private conversation between one parent and the child's therapist.
const messageSchema = new mongoose.Schema(
  {
    childId: { type: String, ref: 'Child', required: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorRole: { type: String, enum: ['parent', 'therapist'], required: true },
    // Text is optional when the message carries photos, voice notes or files.
    body: { type: String, trim: true, default: '', maxlength: 4000 },
    attachments: { type: [attachmentSchema], default: [] },
    card: { type: mongoose.Schema.Types.Mixed, default: undefined },
    // The other person in the thread; used for delivery receipts.
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    // Optional structured check-in: mood, sleep and topic tags.
    details: { type: detailsSchema, default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

messageSchema.index({ childId: 1, parentId: 1, createdAt: 1 });
messageSchema.index({ recipientId: 1, deliveredAt: 1 });

messageSchema.pre('validate', function requireContent() {
  if (!this.body && this.attachments.length === 0 && !this.details && !this.card) {
    this.invalidate('body', 'A message needs text, an attachment, a card or check-in details');
  }
});

messageSchema.methods.toNote = function toNote() {
  return {
    id: this._id.toString(),
    childId: this.childId,
    parentId: this.parentId.toString(),
    from: this.authorRole,
    text: this.body,
    createdAt: this.createdAt.toISOString(),
    ...(this.details ? { details: cleanDetails(this.details.toObject()) } : {}),
    ...(this.card ? { card: this.card } : {}),
    deliveredAt: this.deliveredAt?.toISOString() ?? null,
    readAt: this.readAt?.toISOString() ?? null,
    attachments: this.attachments.map((a) => ({
      id: a.fileId.toString(),
      kind: a.kind,
      mimeType: a.mimeType,
      name: a.name,
      size: a.size,
      durationMs: a.durationMs,
      url: signedFileUrl(a.fileId),
    })),
  };
};

export const Message = mongoose.model('Message', messageSchema);
