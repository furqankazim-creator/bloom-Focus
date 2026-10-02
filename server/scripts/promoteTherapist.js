// Usage: npm run promote -- therapist@example.com
// Run only for a verified professional account that has already signed up in the app.
import mongoose from 'mongoose';
import { config } from '../src/config.js';
import { User } from '../src/models/User.js';

const email = process.argv[2]?.toLowerCase().trim();
if (!email) {
  console.error('Usage: npm run promote -- <email>');
  process.exit(1);
}
await mongoose.connect(config.mongoUri);
const user = await User.findOneAndUpdate({ email }, { role: 'therapist' }, { returnDocument: 'after' });
console.log(user ? `${email} is now a therapist.` : `No account found for ${email}.`);
await mongoose.disconnect();
process.exit(user ? 0 : 1);
