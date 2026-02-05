const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const mongoUri =
  process.env.MONGODB_URI ||
  'mongodb+srv://mwesigyemoses256:waste256@cluster0.ofh4r1m.mongodb.net/bwws?appName=Cluster0';

async function dropNinIndex() {
  try {
    // Connects to bwws DB to fix cos users - invcaa uses MONGODB_DB=invcaa for its own users
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected');

    const db = mongoose.connection.db;
    const users = db.collection('users');

    const indexes = await users.indexes();
    const ninIndex = indexes.find((i) => i.name === 'nin_1');
    if (!ninIndex) {
      console.log('Index nin_1 not found. Nothing to drop.');
      process.exit(0);
      return;
    }

    await users.dropIndex('nin_1');
    console.log('Dropped index nin_1 from users collection.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

dropNinIndex();
