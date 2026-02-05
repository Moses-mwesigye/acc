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

async function checkUsers() {
  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected\n');

    const users = await User.find({}).select('username role createdAt');
    
    if (users.length === 0) {
      console.log('No users found in database.');
      console.log('\nTo create an admin user, run:');
      console.log('  node create-admin.js <username> <password>');
      console.log('\nTo create a manager user, run:');
      console.log('  node create-manager.js <username> <password>');
    } else {
      console.log('Existing users:');
      console.log('---------------');
      users.forEach(user => {
        console.log(`  Username: ${user.username}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Created: ${user.createdAt}`);
        console.log('');
      });
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkUsers();
