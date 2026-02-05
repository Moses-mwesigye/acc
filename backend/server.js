const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const dotenv = require('dotenv');
const PDFDocument = require('pdfkit');

dotenv.config();

const app = express();

// Middleware
// CORS configuration - allow requests from frontend (use ALLOWED_ORIGINS from .env)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : ['https://acc.iges.ug', 'http://acc.iges.ug', 'https://inv.iges.ug', 'http://inv.iges.ug', 'https://invent.iges.ug', 'http://invent.iges.ug', 'http://localhost:5173', 'http://localhost:3000'];
app.use(cors({
  origin: (origin, cb) => {
    const allowed = !origin || allowedOrigins.includes(origin);
    if (!allowed) console.warn('CORS rejected origin:', origin, 'allowed:', allowedOrigins);
    return cb(null, allowed);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// MongoDB connection
// Prefer MONGODB_URI from .env; if missing, fall back directly to your Atlas cluster
const mongoUri =
  process.env.MONGODB_URI ||
  'mongodb+srv://mwesigyemoses256:waste256@cluster0.ofh4r1m.mongodb.net/bwws?appName=Cluster0';

// Use separate DB for invcaa users to avoid nin index conflicts with cos/bwws users
const dbName = process.env.MONGODB_DB || null;

mongoose
  .connect(mongoUri, dbName ? { dbName } : {})
  .then(async () => {
    console.log('MongoDB connected');
    await seedInitialUsers();
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// Models
const cashbookSchema = new mongoose.Schema(
  {
    month: { type: String, required: true }, // e.g. "2026-01"
    date: { type: Date, required: true },
    incomeTypes: {
      type: [String],
      enum: ['MM-AIRTEL', 'MM-MTN', 'CASH', 'BANK', 'BUSINESSPROFIT'],
      default: [],
    },
    // Keep single incomeType for backward compatibility and simple entries
    incomeType: {
      type: String,
      enum: ['MM-AIRTEL', 'MM-MTN', 'CASH', 'BANK', 'BUSINESSPROFIT'],
    },
    amount: { type: Number, default: 0 },
    // Amount per income type when multiple selected
    amountsByType: {
      type: Map,
      of: Number,
      default: {},
    },
    ref: { type: String },
    operationalCosts: { type: String },
    internalTransfer: {
      type: String, // description like "withdraw from bank to petty cash"
    },
    transactionCharges: { type: Number, default: 0 },
    recyclables: { type: String },
    op: { type: String },
    sector: {
      type: String,
      enum: ['BUYING', 'CLEANING', 'TRANSPORT'],
    },
    expenses: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    methodOfPayment: {
      type: String,
      enum: ['CASH', 'MM-AIRTEL', 'MM-MTN', 'BANK'],
    },
    wagesCategory: {
      type: String,
      enum: ['CASUAL', 'STAFF', 'NONE'],
      default: 'NONE',
    },
    name: { type: String },
    paymentTier: {
      type: String,
      enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'NONE'],
      default: 'NONE',
    },
    salaryAmount: { type: Number, default: 0 },
    advance: { type: Number, default: 0 },
    salaryBalance: { type: Number, default: 0 },
    allowance: { type: Number, default: 0 },
    expenseIncomeType: {
      type: String,
      enum: ['MM-AIRTEL', 'MM-MTN', 'CASH', 'BANK', 'BUSINESSPROFIT', 'NONE'],
      default: 'NONE',
    },
    wildExpenditure: { type: Boolean, default: false },
    roleLocked: { type: Boolean, default: false }, // for manager restrictions
  },
  { timestamps: true }
);

const CashbookEntry = mongoose.model('CashbookEntry', cashbookSchema);

const inventoryPurchaseSchema = new mongoose.Schema(
  {
    month: { type: String, required: true },
    dateOfPurchase: { type: Date, required: true },
    supplierName: { type: String, required: true },
    supplierPhone: { type: String },
    supplierLocation: { type: String },
    itemType: {
      type: String,
      enum: ['SOFT', 'BOTTLES', 'HD', 'STEEL', 'SACKS', 'JCNS', 'PLASTICS', 'BOX', 'CUPS'],
      required: true,
    },
    qtyKg: { type: Number, required: true },
    unitCost: { type: Number, default: 0 },
    purchasePriceTotal: { type: Number, required: true },
    methodOfPayment: {
      type: String,
      enum: ['CASH', 'MM-AIRTEL', 'MM-MTN', 'BANK'],
    },
    approvalStatus: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const InventoryPurchase = mongoose.model('InventoryPurchase', inventoryPurchaseSchema);

const inventorySaleSchema = new mongoose.Schema(
  {
    month: { type: String, required: true },
    dateOfSale: { type: Date, required: true },
    companyName: { type: String, required: true },
    itemType: {
      type: String,
      enum: ['SOFT', 'BOTTLES', 'HD', 'STEEL', 'SACKS', 'JCNS', 'PLASTICS', 'BOX', 'CUPS'],
      required: true,
    },
    qtyKg: { type: Number, required: true },
    unitCost: { type: Number, required: true }, // UGX per Kg
    totalAmount: { type: Number, required: true }, // unitCost * qtyKg
    methodOfPayment: {
      type: String,
      enum: ['MM-AIRTEL', 'MM-MTN', 'CASH', 'BANK'],
      required: true,
    },
  },
  { timestamps: true }
);

const InventorySale = mongoose.model('InventorySale', inventorySaleSchema);

// Simple user model for manager/admin/inventory-only
const userSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['ADMIN', 'MANAGER', 'INVENTORY'], required: true },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

// Auto-seed admin/manager on first deploy (no terminal needed)
async function seedInitialUsers() {
  const count = await User.countDocuments();
  if (count > 0) return;

  const adminUser = process.env.INITIAL_ADMIN_USERNAME || 'admin';
  const adminPass = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';
  const managerUser = process.env.INITIAL_MANAGER_USERNAME || 'manager';
  const managerPass = process.env.INITIAL_MANAGER_PASSWORD || 'manager123';

  try {
    const adminHash = await bcrypt.hash(adminPass, 10);
    await User.create({ username: adminUser, passwordHash: adminHash, role: 'ADMIN' });
    console.log('Auto-seeded admin:', adminUser);

    const managerHash = await bcrypt.hash(managerPass, 10);
    await User.create({ username: managerUser, passwordHash: managerHash, role: 'MANAGER' });
    console.log('Auto-seeded manager:', managerUser);
  } catch (err) {
    console.error('Auto-seed error:', err.message);
  }
}

// Health check (test in browser: https://acc.iges.ug/v1/health)
app.get('/v1/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

// Auth routes & middleware
require('./admin')(app, User);

// Utility: compute month string
function monthFromDate(date) {
  const d = new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

function prevMonthString(monthStr) {
  // monthStr format: YYYY-MM
  const [y, m] = monthStr.split('-').map((x) => parseInt(x, 10));
  const date = new Date(y, m - 1, 1);
  date.setMonth(date.getMonth() - 1);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

async function computeIncomeAvailabilityForType(month, incomeType, newExpense) {
  if (!incomeType || !month) return { availableAfter: 0, carryFromPrev: 0 };

  const prevMonth = prevMonthString(month);

  // Previous month totals
  const prevAgg = await CashbookEntry.aggregate([
    { $match: { month: prevMonth, incomeType } },
    {
      $group: {
        _id: null,
        totalIncome: { $sum: '$amount' },
      },
    },
  ]);

  const prevExpAgg = await CashbookEntry.aggregate([
    { $match: { month: prevMonth, expenseIncomeType: incomeType } },
    {
      $group: {
        _id: null,
        totalExpenses: { $sum: '$expenses' },
      },
    },
  ]);

  const prevIncome = prevAgg[0]?.totalIncome || 0;
  const prevExpenses = prevExpAgg[0]?.totalExpenses || 0;
  let carryFromPrev = prevIncome - prevExpenses;
  if (carryFromPrev < 1) carryFromPrev = 0; // only carry if >= 1 UGX

  // Current month existing totals (before this new expense)
  const curAgg = await CashbookEntry.aggregate([
    { $match: { month, incomeType } },
    {
      $group: {
        _id: null,
        totalIncome: { $sum: '$amount' },
      },
    },
  ]);

  const curExpAgg = await CashbookEntry.aggregate([
    { $match: { month, expenseIncomeType: incomeType } },
    {
      $group: {
        _id: null,
        totalExpenses: { $sum: '$expenses' },
      },
    },
  ]);

  const curIncome = curAgg[0]?.totalIncome || 0;
  const curExpenses = curExpAgg[0]?.totalExpenses || 0;

  const availableBefore = carryFromPrev + curIncome - curExpenses;
  const availableAfter = availableBefore - (newExpense || 0);

  return { availableAfter, carryFromPrev };
}

// Auth guard helpers
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Admin only' });
  }
  next();
}

// CASHBOOK ROUTES
app.post('/v1/cashbook', requireAuth, async (req, res) => {
  try {
    const body = req.body;
    const date = new Date(body.date);
    const month = body.month || monthFromDate(date);

    let salaryBalance = 0;
    if (body.salaryAmount || body.advance) {
      salaryBalance = (body.salaryAmount || 0) - (body.advance || 0);
    }

    // Handle multiple income types
    const incomeTypes = body.incomeTypes || (body.incomeType ? [body.incomeType] : []);
    const totalAmount = body.amount || 0;
    let amountsByType = new Map();
    
    // If amountsByType is provided as object, convert to Map
    if (body.amountsByType && typeof body.amountsByType === 'object') {
      Object.entries(body.amountsByType).forEach(([type, amount]) => {
        amountsByType.set(type, Number(amount || 0));
      });
    } else if (incomeTypes.length > 0 && totalAmount > 0) {
      // Distribute amount evenly across selected income types if not specified
      const amountPerType = totalAmount / incomeTypes.length;
      incomeTypes.forEach((type) => {
        amountsByType.set(type, amountPerType);
      });
    }

    // Wild expenditure flag based on income type and carry-over
    let wildExpenditure = false;
    if (body.expenses && body.expenseIncomeType && body.expenses > 0) {
      const { availableAfter } = await computeIncomeAvailabilityForType(
        month,
        body.expenseIncomeType,
        body.expenses
      );
      if (availableAfter < 0) {
        wildExpenditure = true;
      }
    }

    const entry = await CashbookEntry.create(
      {
        ...body,
        date,
        month,
        incomeTypes,
        amountsByType: amountsByType.size > 0 ? amountsByType : undefined,
        salaryBalance,
        wildExpenditure,
      }
    );
    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating cashbook entry' });
  }
});

app.get('/v1/cashbook', requireAuth, async (req, res) => {
  try {
    const { month } = req.query;
    const filter = {};
    if (month) filter.month = month;
    const items = await CashbookEntry.find(filter).sort({ date: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching cashbook entries' });
  }
});

app.put('/v1/cashbook/:id', requireAdmin, async (req, res) => {
  try {
    const updated = await CashbookEntry.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Error updating cashbook entry' });
  }
});

app.delete('/v1/cashbook/:id', requireAdmin, async (req, res) => {
  try {
    await CashbookEntry.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting cashbook entry' });
  }
});

// Internal transfer endpoint - creates debit and credit entries
app.post('/v1/cashbook/internal-transfer', requireAuth, async (req, res) => {
  try {
    const { fromIncomeType, toIncomeType, amount, date, month, ref } = req.body;
    
    if (!fromIncomeType || !toIncomeType || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid transfer data' });
    }
    
    if (fromIncomeType === toIncomeType) {
      return res.status(400).json({ message: 'Cannot transfer to the same income type' });
    }

    const transferDate = date ? new Date(date) : new Date();
    const transferMonth = month || monthFromDate(transferDate);
    const transferRef = ref || `TRANSFER-${Date.now()}`;

    // Check if source has enough balance
    const { availableAfter } = await computeIncomeAvailabilityForType(
      transferMonth,
      fromIncomeType,
      amount
    );
    
    if (availableAfter < 0) {
      return res.status(400).json({ 
        message: `Insufficient balance in ${fromIncomeType}. Available: ${availableAfter + amount} UGX` 
      });
    }

    // Create debit entry (expense from source)
    const debitEntry = await CashbookEntry.create({
      month: transferMonth,
      date: transferDate,
      incomeType: null,
      incomeTypes: [],
      amount: 0,
      expenses: amount,
      expenseIncomeType: fromIncomeType,
      ref: transferRef,
      operationalCosts: `Internal transfer: From ${fromIncomeType} to ${toIncomeType}`,
      internalTransfer: `FROM ${fromIncomeType}`,
      wildExpenditure: false,
    });

    // Create credit entry (income to destination)
    const creditEntry = await CashbookEntry.create({
      month: transferMonth,
      date: transferDate,
      incomeType: toIncomeType,
      incomeTypes: [toIncomeType],
      amount: amount,
      amountsByType: new Map([[toIncomeType, amount]]),
      expenses: 0,
      ref: transferRef,
      operationalCosts: `Internal transfer: From ${fromIncomeType} to ${toIncomeType}`,
      internalTransfer: `TO ${toIncomeType}`,
    });

    res.status(201).json({
      success: true,
      debitEntry,
      creditEntry,
      message: `Transfer completed: ${amount} UGX from ${fromIncomeType} to ${toIncomeType}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error processing internal transfer' });
  }
});

// Real-time balance by income type endpoint
app.get('/v1/cashbook/balances', requireAuth, async (req, res) => {
  try {
    const { month } = req.query;
    const currentMonth = month || monthFromDate(new Date());
    
    const incomeTypes = ['MM-AIRTEL', 'MM-MTN', 'CASH', 'BANK', 'BUSINESSPROFIT'];
    const balances = {};

    for (const type of incomeTypes) {
      const prevMonth = prevMonthString(currentMonth);
      
      // Previous month carry-over
      const prevIncomeAgg = await CashbookEntry.aggregate([
        { $match: { month: prevMonth, incomeType: type } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      const prevExpAgg = await CashbookEntry.aggregate([
        { $match: { month: prevMonth, expenseIncomeType: type } },
        { $group: { _id: null, total: { $sum: '$expenses' } } },
      ]);
      
      const prevIncome = prevIncomeAgg[0]?.total || 0;
      const prevExpenses = prevExpAgg[0]?.total || 0;
      let carryOver = prevIncome - prevExpenses;
      if (carryOver < 1) carryOver = 0;

      // Current month income (including multiple income types)
      const curIncomeAgg = await CashbookEntry.aggregate([
        { $match: { month: currentMonth } },
        {
          $project: {
            incomeTypes: { $ifNull: ['$incomeTypes', []] },
            incomeType: 1,
            amount: 1,
            amountsByType: 1,
          },
        },
        {
          $unwind: {
            path: '$incomeTypes',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: {
            $or: [
              { incomeTypes: type },
              { incomeType: type, incomeTypes: { $exists: false } },
            ],
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $cond: [
                  { $ne: ['$amountsByType', null] },
                  { $ifNull: [{ $getField: { field: type, input: '$amountsByType' } }, 0] },
                  { $ifNull: ['$amount', 0] },
                ],
              },
            },
          },
        },
      ]);

      // Current month expenses
      const curExpAgg = await CashbookEntry.aggregate([
        { $match: { month: currentMonth, expenseIncomeType: type } },
        { $group: { _id: null, total: { $sum: '$expenses' } } },
      ]);

      const curExpenses = curExpAgg[0]?.total || 0;
      const curIncome = curIncomeAgg[0]?.total || 0;
      const availableBalance = carryOver + curIncome - curExpenses;

      balances[type] = {
        carryOver,
        currentIncome: curIncome,
        currentExpenses: curExpenses,
        availableBalance,
      };
    }

    res.json({ balances, month: currentMonth });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching balances' });
  }
});

// Daily totals endpoint
app.get('/v1/cashbook/daily-totals', requireAuth, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'date is required' });

    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    // Get all entries for this day
    const entries = await CashbookEntry.find({
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    // Compute totals by income type
    const totalsByType = {};
    const incomeTypes = ['MM-AIRTEL', 'MM-MTN', 'CASH', 'BANK', 'BUSINESSPROFIT'];

    incomeTypes.forEach((type) => {
      totalsByType[type] = {
        income: 0,
        expenses: 0,
        net: 0,
      };
    });

    entries.forEach((entry) => {
      // Handle multiple income types
      const types = entry.incomeTypes && entry.incomeTypes.length > 0 
        ? entry.incomeTypes 
        : (entry.incomeType ? [entry.incomeType] : []);

      types.forEach((type) => {
        const amount = entry.amountsByType?.get(type) || 
                      (types.length === 1 ? entry.amount : entry.amount / types.length);
        if (totalsByType[type]) {
          totalsByType[type].income += amount || 0;
        }
      });

      // Handle expenses
      if (entry.expenses > 0 && entry.expenseIncomeType) {
        if (totalsByType[entry.expenseIncomeType]) {
          totalsByType[entry.expenseIncomeType].expenses += entry.expenses || 0;
        }
      }
    });

    // Calculate net for each type
    Object.keys(totalsByType).forEach((type) => {
      totalsByType[type].net = totalsByType[type].income - totalsByType[type].expenses;
    });

    // Overall daily total
    const overallTotal = Object.values(totalsByType).reduce(
      (sum, t) => sum + t.income - t.expenses,
      0
    );

    res.json({
      date: date,
      totalsByType,
      overallTotal,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching daily totals' });
  }
});

// Aggregates & carry over
app.get('/v1/cashbook/summary', requireAuth, async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ message: 'month is required' });

    const match = { month };
    const summary = await CashbookEntry.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalExpenses: { $sum: '$expenses' },
          totalTransactionCharges: { $sum: '$transactionCharges' },
          totalSalaryAmount: { $sum: '$salaryAmount' },
          totalAllowance: { $sum: '$allowance' },
        },
      },
    ]);

    const byIncomeTypeAgg = await CashbookEntry.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$incomeType',
          totalAmount: { $sum: '$amount' },
          totalExpenses: { $sum: '$expenses' },
        },
      },
    ]);

    // Enhance income-type summary with carry-over and next-month carry
    const byIncomeType = [];
    for (const row of byIncomeTypeAgg) {
      const incomeType = row._id;
      if (!incomeType) continue;

      const prev = await computeIncomeAvailabilityForType(month, incomeType, 0);
      const netThisMonth = (row.totalAmount || 0) - (row.totalExpenses || 0);
      const netWithCarry = prev.carryFromPrev + netThisMonth;
      const carryToNext = netWithCarry >= 1 ? netWithCarry : 0;

      byIncomeType.push({
        incomeType,
        totalAmount: row.totalAmount,
        totalExpenses: row.totalExpenses,
        carryFromPrev: prev.carryFromPrev,
        carryToNext,
      });
    }

    res.json({
      summary: summary[0] || {},
      byIncomeType,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching cashbook summary' });
  }
});

// INVENTORY PURCHASE ROUTES
app.post('/v1/inventory/purchases', requireAuth, async (req, res) => {
  try {
    const body = req.body;
    const date = new Date(body.dateOfPurchase);
    const month = body.month || monthFromDate(date);

    // Set approval status: ADMIN can auto-approve, others need approval
    const approvalStatus = req.user.role === 'ADMIN' ? 'APPROVED' : 'PENDING';
    const approvedBy = req.user.role === 'ADMIN' ? req.user.id : null;

    const purchase = await InventoryPurchase.create({
      ...body,
      dateOfPurchase: date,
      month,
      approvalStatus,
      approvedBy,
    });

    // Auto-deduct from cashbook only if approved and methodOfPayment is provided
    if (approvalStatus === 'APPROVED' && body.methodOfPayment && body.purchasePriceTotal > 0) {
      const incomeTypeMap = {
        'CASH': 'CASH',
        'MM-AIRTEL': 'MM-AIRTEL',
        'MM-MTN': 'MM-MTN',
        'BANK': 'BANK',
      };
      const incomeType = incomeTypeMap[body.methodOfPayment];
      if (incomeType) {
        await CashbookEntry.create({
          month,
          date,
          incomeType: null,
          incomeTypes: [],
          amount: 0,
          expenses: body.purchasePriceTotal,
          expenseIncomeType: incomeType,
          ref: `INV-PURCHASE-${purchase._id}`,
          operationalCosts: `Inventory purchase: ${body.itemType} from ${body.supplierName}`,
          wildExpenditure: false, // Will be computed
        });
      }
    }

    res.status(201).json(purchase);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating inventory purchase' });
  }
});

app.get('/v1/inventory/purchases', requireAuth, async (req, res) => {
  try {
    const { month, supplierName } = req.query;
    const filter = {};
    if (month) filter.month = month;
    if (supplierName) filter.supplierName = supplierName;

    const items = await InventoryPurchase.find(filter).sort({ dateOfPurchase: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching purchases' });
  }
});

// Admin approval/rejection route
app.put('/v1/inventory/purchases/:id/approve', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body; // 'APPROVED' or 'REJECTED'
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'Status must be APPROVED or REJECTED' });
    }

    const purchase = await InventoryPurchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    // Update purchase status
    purchase.approvalStatus = status;
    purchase.approvedBy = req.user.id;
    await purchase.save();

    // If approving, create cashbook entry if it doesn't exist
    if (status === 'APPROVED' && purchase.methodOfPayment && purchase.purchasePriceTotal > 0) {
      // Check if cashbook entry already exists
      const existingEntry = await CashbookEntry.findOne({
        ref: `INV-PURCHASE-${purchase._id}`,
      });

      if (!existingEntry) {
        const incomeTypeMap = {
          'CASH': 'CASH',
          'MM-AIRTEL': 'MM-AIRTEL',
          'MM-MTN': 'MM-MTN',
          'BANK': 'BANK',
        };
        const incomeType = incomeTypeMap[purchase.methodOfPayment];
        if (incomeType) {
          await CashbookEntry.create({
            month: purchase.month,
            date: purchase.dateOfPurchase,
            incomeType: null,
            incomeTypes: [],
            amount: 0,
            expenses: purchase.purchasePriceTotal,
            expenseIncomeType: incomeType,
            ref: `INV-PURCHASE-${purchase._id}`,
            operationalCosts: `Inventory purchase: ${purchase.itemType} from ${purchase.supplierName}`,
            wildExpenditure: false,
          });
        }
      }
    }

    res.json(purchase);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating purchase approval status' });
  }
});

// Monthly tonnage and totals
app.get('/v1/inventory/purchases/summary', requireAuth, async (req, res) => {
  try {
    const { month } = req.query;
    
    // Build match filter - month is optional now
    const match = { approvalStatus: 'APPROVED' };
    if (month) match.month = month;

    const byItem = await InventoryPurchase.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$itemType',
          totalKg: { $sum: '$qtyKg' },
          totalPurchase: { $sum: '$purchasePriceTotal' },
        },
      },
    ]);

    const overall = await InventoryPurchase.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalKg: { $sum: '$qtyKg' },
          totalPurchase: { $sum: '$purchasePriceTotal' },
        },
      },
    ]);

    // tons helper
    const withTons = byItem.map((x) => ({
      itemType: x._id,
      totalKg: x.totalKg,
      totalTons: x.totalKg / 1000,
      totalPurchase: x.totalPurchase,
    }));

    res.json({
      byItem: withTons,
      overall: overall[0] || {},
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching purchase summary' });
  }
});

// Auto-compute monthly totals across all months
app.get('/v1/inventory/purchases/monthly-totals', requireAuth, async (req, res) => {
  try {
    // Only count approved purchases in summaries
    const match = { approvalStatus: 'APPROVED' };
    
    // Group by month to get totals for each month
    const monthlyTotals = await InventoryPurchase.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$month',
          totalKg: { $sum: '$qtyKg' },
          totalPurchase: { $sum: '$purchasePriceTotal' },
          purchaseCount: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } }, // Sort by month descending (most recent first)
    ]);

    // Calculate overall totals across all months
    const overall = await InventoryPurchase.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalKg: { $sum: '$qtyKg' },
          totalPurchase: { $sum: '$purchasePriceTotal' },
          purchaseCount: { $sum: 1 },
        },
      },
    ]);

    // Format response with tons
    const formatted = monthlyTotals.map((x) => ({
      month: x._id,
      totalKg: x.totalKg,
      totalTons: x.totalKg / 1000,
      totalPurchase: x.totalPurchase,
      purchaseCount: x.purchaseCount,
    }));

    res.json({
      monthlyTotals: formatted,
      overall: overall[0] ? {
        totalKg: overall[0].totalKg,
        totalTons: overall[0].totalKg / 1000,
        totalPurchase: overall[0].totalPurchase,
        purchaseCount: overall[0].purchaseCount,
      } : {},
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching monthly totals' });
  }
});

// INVENTORY SALE ROUTES
app.post('/v1/inventory/sales', requireAuth, async (req, res) => {
  try {
    const body = req.body;
    const date = new Date(body.dateOfSale);
    const month = body.month || monthFromDate(date);

    const qtyKg = Number(body.qtyKg || 0);
    const unitCost = Number(body.unitCost || 0);
    const totalAmount = unitCost * qtyKg;

    const sale = await InventorySale.create({
      ...body,
      qtyKg,
      unitCost,
      totalAmount,
      dateOfSale: date,
      month,
    });

    // Auto-add to cashbook as income based on payment method
    if (body.methodOfPayment && totalAmount > 0) {
      const incomeTypeMap = {
        'CASH': 'CASH',
        'MM-AIRTEL': 'MM-AIRTEL',
        'MM-MTN': 'MM-MTN',
        'BANK': 'BANK',
      };
      const incomeType = incomeTypeMap[body.methodOfPayment];
      if (incomeType) {
        await CashbookEntry.create({
          month,
          date,
          incomeType,
          incomeTypes: [incomeType],
          amount: totalAmount,
          amountsByType: new Map([[incomeType, totalAmount]]),
          ref: `INV-SALE-${sale._id}`,
          operationalCosts: `Inventory sale: ${body.itemType} to ${body.companyName}`,
          expenses: 0,
        });
      }
    }

    res.status(201).json(sale);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating inventory sale' });
  }
});

app.get('/v1/inventory/sales', requireAuth, async (req, res) => {
  try {
    const { month } = req.query;
    const filter = {};
    if (month) filter.month = month;
    const items = await InventorySale.find(filter).sort({ dateOfSale: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching sales' });
  }
});

app.get('/v1/inventory/sales/summary', requireAuth, async (req, res) => {
  try {
    const { month } = req.query;
    
    // Build match filter - month is optional now
    const match = {};
    if (month) match.month = month;

    const byItem = await InventorySale.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$itemType',
          totalKg: { $sum: '$qtyKg' },
          totalSales: { $sum: '$totalAmount' },
        },
      },
    ]);

    const overall = await InventorySale.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalKg: { $sum: '$qtyKg' },
          totalSales: { $sum: '$totalAmount' },
        },
      },
    ]);

    const withTons = byItem.map((x) => ({
      itemType: x._id,
      totalKg: x.totalKg,
      totalTons: x.totalKg / 1000,
      totalSales: x.totalSales,
    }));

    res.json({
      byItem: withTons,
      overall: overall[0] || {},
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching sales summary' });
  }
});

// Auto-compute monthly totals across all months for sales
app.get('/v1/inventory/sales/monthly-totals', requireAuth, async (req, res) => {
  try {
    const match = {};
    
    // Group by month to get totals for each month
    const monthlyTotals = await InventorySale.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$month',
          totalKg: { $sum: '$qtyKg' },
          totalSales: { $sum: '$totalAmount' },
          saleCount: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } }, // Sort by month descending (most recent first)
    ]);

    // Calculate overall totals across all months
    const overall = await InventorySale.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalKg: { $sum: '$qtyKg' },
          totalSales: { $sum: '$totalAmount' },
          saleCount: { $sum: 1 },
        },
      },
    ]);

    // Format response with tons
    const formatted = monthlyTotals.map((x) => ({
      month: x._id,
      totalKg: x.totalKg,
      totalTons: x.totalKg / 1000,
      totalSales: x.totalSales,
      saleCount: x.saleCount,
    }));

    res.json({
      monthlyTotals: formatted,
      overall: overall[0] ? {
        totalKg: overall[0].totalKg,
        totalTons: overall[0].totalKg / 1000,
        totalSales: overall[0].totalSales,
        saleCount: overall[0].saleCount,
      } : {},
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching monthly sales totals' });
  }
});

// PDF generation: Cashbook monthly report
app.get('/v1/reports/cashbook/pdf', requireAuth, async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ message: 'month is required' });

    const entries = await CashbookEntry.find({ month }).sort({ date: 1 });
    const summary = await CashbookEntry.aggregate([
      { $match: { month } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalExpenses: { $sum: '$expenses' },
          totalTransactionCharges: { $sum: '$transactionCharges' },
        },
      },
    ]);

    const byIncomeType = await CashbookEntry.aggregate([
      { $match: { month } },
      {
        $group: {
          _id: '$incomeType',
          totalAmount: { $sum: '$amount' },
          totalExpenses: { $sum: '$expenses' },
        },
      },
    ]);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cashbook-${month}.pdf"`
    );
    doc.pipe(res);

    doc.fontSize(16).text('BWWS Cashbook Report', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(12).text(`Month: ${month}`, { align: 'center' });
    doc.moveDown();

    // Summary
    const s = summary[0] || {};
    doc.fontSize(12).text('Summary', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10);
    doc.text(`Total Income: ${s.totalAmount || 0}`);
    doc.text(`Total Expenses: ${s.totalExpenses || 0}`);
    doc.text(`Transaction Charges: ${s.totalTransactionCharges || 0}`);
    doc.moveDown();

    // Per income type
    doc.fontSize(12).text('Per Income Type', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10);
    byIncomeType.forEach((row) => {
      doc.text(
        `${row._id || 'N/A'}: Income ${row.totalAmount || 0} | Expenses ${
          row.totalExpenses || 0
        }`
      );
    });
    doc.moveDown();

    // Entries table (compact)
    doc.fontSize(12).text('Entries', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(8);
    doc.text(
      'Date        IncomeType   Amount   Expenses   Method   Name       Salary   Allow   WildExp',
      { continued: false }
    );
    doc.moveDown(0.2);
    entries.forEach((e) => {
      const d = e.date ? new Date(e.date).toISOString().slice(0, 10) : '';
      doc.text(
        `${d.padEnd(12)} ${String(e.incomeType || '').padEnd(11)} ${String(
          e.amount || 0
        ).padEnd(8)} ${String(e.expenses || 0).padEnd(9)} ${String(
          e.methodOfPayment || ''
        ).padEnd(8)} ${String(e.name || '').padEnd(10)} ${String(
          e.salaryAmount || 0
        ).padEnd(8)} ${String(e.allowance || 0).padEnd(8)} ${
          e.wildExpenditure ? 'wild expenditure' : ''
        }`
      );
    });

    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating cashbook PDF' });
    }
  }
});

// PDF generation: Inventory monthly report (purchases + sales + supplier summary)
app.get('/v1/reports/inventory/pdf', requireAuth, async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ message: 'month is required' });

    // Only include approved purchases in PDF reports
    const purchases = await InventoryPurchase.find({ month, approvalStatus: 'APPROVED' }).sort({
      dateOfPurchase: 1,
    });
    const sales = await InventorySale.find({ month }).sort({ dateOfSale: 1 });

    const supplierAgg = await InventoryPurchase.aggregate([
      { $match: { month, approvalStatus: 'APPROVED' } },
      {
        $group: {
          _id: '$supplierName',
          totalPurchase: { $sum: '$purchasePriceTotal' },
          totalKg: { $sum: '$qtyKg' },
        },
      },
    ]);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="inventory-${month}.pdf"`
    );
    doc.pipe(res);

    doc.fontSize(16).text('BWWS Inventory Report', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(12).text(`Month: ${month}`, { align: 'center' });
    doc.moveDown();

    // Supplier receipt-style summary
    doc.fontSize(12).text('Supplier Summary', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10);
    supplierAgg.forEach((s) => {
      const tons = (s.totalKg || 0) / 1000;
      doc.text(
        `${s._id || 'Unknown'}: ${s.totalKg || 0} kg (${tons.toFixed(
          2
        )} tons), Total UGX ${s.totalPurchase || 0}`
      );
    });
    doc.moveDown();

    // Purchases
    doc.fontSize(12).text('Purchases', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(8);
    doc.text('Date   Supplier   Item   Kg   Tons   Amount', { continued: false });
    doc.moveDown(0.2);
    purchases.forEach((p) => {
      const d = p.dateOfPurchase
        ? new Date(p.dateOfPurchase).toISOString().slice(0, 10)
        : '';
      const tons = (p.qtyKg || 0) / 1000;
      doc.text(
        `${d.padEnd(11)} ${String(p.supplierName || '').padEnd(12)} ${String(
          p.itemType || ''
        ).padEnd(7)} ${String(p.qtyKg || 0).padEnd(6)} ${tons
          .toFixed(2)
          .padEnd(5)} ${p.purchasePriceTotal || 0}`
      );
    });
    doc.addPage();

    // Sales
    doc.fontSize(12).text('Sales', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(8);
    doc.text('Date   Company   Item   Kg   Tons   Amount   Method');
    doc.moveDown(0.2);
    sales.forEach((s) => {
      const d = s.dateOfSale
        ? new Date(s.dateOfSale).toISOString().slice(0, 10)
        : '';
      const tons = (s.qtyKg || 0) / 1000;
      doc.text(
        `${d.padEnd(11)} ${String(s.companyName || '').padEnd(12)} ${String(
          s.itemType || ''
        ).padEnd(7)} ${String(s.qtyKg || 0).padEnd(6)} ${tons
          .toFixed(2)
          .padEnd(5)} ${String(s.totalAmount || 0).padEnd(8)} ${
          s.methodOfPayment || ''
        }`
      );
    });

    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating inventory PDF' });
    }
  }
});

// API 404 handler
app.use('/v1', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

const port = process.env.PORT || 3000;

// Check if running under Passenger (cPanel)
if (typeof(PhusionPassenger) !== 'undefined') {
  PhusionPassenger.configure({ autoInstall: false });
}

// Start server
if (typeof(PhusionPassenger) !== 'undefined') {
  // Running under Passenger
  app.listen('passenger', () => {
    console.log('Server running under Passenger');
  });
} else {
  // Running standalone
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

// Export app for Passenger
module.exports = app;

