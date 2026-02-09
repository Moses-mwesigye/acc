const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

// MongoDB connection
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

async function createManager() {
  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected');

    // Get credentials from command line or use defaults
    const username = process.argv[2] || 'manager';
    const password = process.argv[3] || 'Pe256.€€';
    const role = 'MANAGER';

    // Check if user already exists
    const existing = await User.findOne({ username });
    if (existing) {
      console.log(`User "${username}" already exists.`);
      console.log('To update password, delete the user first or use a different username.');
      process.exit(1);
    }

    // Create user
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      passwordHash: hash,
      role,
    });

    console.log('\n✅ Manager user created successfully!');
    console.log(`Username: ${user.username}`);
    console.log(`Role: ${user.role}`);
    console.log(`Password: ${password}`);
    console.log('\n⚠️  Please change the password after first login for security.\n');

    process.exit(0);
  } catch (err) {
    console.error('Error creating manager user:', err.message);
    process.exit(1);
  }
}

createManager();
