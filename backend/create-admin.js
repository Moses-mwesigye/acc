const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const mongoUri =
  process.env.MONGODB_URI ||
  'mongodb+srv://mwesigyemoses256:waste256@cluster0.ofh4r1m.mongodb.net/bwws?appName=Cluster0';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['ADMIN', 'MANAGER', 'INVENTORY'], required: true },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

async function createAdmin() {
  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected');

    const username = process.argv[2] || 'admin';
    const password = process.argv[3] || 'Em2026.$$';
    const role = 'ADMIN';

    // Check if user already exists
    const existing = await User.findOne({ username });
    if (existing) {
      console.log(`User "${username}" already exists.`);
      
      // Option to reset password
      if (process.argv[4] === '--reset') {
        const hash = await bcrypt.hash(password, 10);
        await User.updateOne({ username }, { passwordHash: hash });
        console.log(`\n✅ Password reset for "${username}"!`);
        console.log(`New password: ${password}`);
      } else {
        console.log('To reset password, run:');
        console.log(`  node create-admin.js ${username} <new-password> --reset`);
      }
      process.exit(0);
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      passwordHash: hash,
      role,
    });

    console.log('\n✅ Admin user created successfully!');
    console.log(`Username: ${user.username}`);
    console.log(`Role: ${user.role}`);
    console.log(`Password: ${password}`);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

createAdmin();
