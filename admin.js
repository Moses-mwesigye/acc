const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret-change-me';

module.exports = function registerAdminRoutes(app, User) {
  // Attach user from token
  app.use(async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      req.user = null;
      return next();
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(payload.id).select('-passwordHash');
      req.user = user ? { id: user.id, username: user.username, role: user.role } : null;
    } catch (err) {
      req.user = null;
    }
    next();
  });

  // Login route (no registration via UI)
  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }
    try {
      const user = await User.findOne({ username });
      if (!user) return res.status(401).json({ message: 'Invalid credentials' });

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

      const token = jwt.sign(
        { id: user.id, role: user.role, username: user.username },
        JWT_SECRET,
        { expiresIn: '12h' }
      );

      res.json({
        token,
        user: { id: user.id, username: user.username, role: user.role },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Login error' });
    }
  });

  // Helper: seed admin/manager via terminal (run once with node)
  app.post('/api/_seed-user', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'Disabled in production' });
    }
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ message: 'username, password, role required' });
    }
    if (!['ADMIN', 'MANAGER', 'INVENTORY'].includes(role)) {
      return res.status(400).json({ message: 'role must be ADMIN, MANAGER or INVENTORY' });
    }
    try {
      const hash = await bcrypt.hash(password, 10);
      const user = await User.create({
        username,
        passwordHash: hash,
        role,
      });
      res.status(201).json({ id: user.id, username: user.username, role: user.role });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error creating user' });
    }
  });
};

