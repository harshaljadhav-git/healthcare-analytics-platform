import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { db } from './server/database';
import { User, UserRole } from './src/types';

// Pre-defined users for simulation/testing
const USERS: { [key: string]: { user: User; passwordHash: string } } = {
  admin: {
    user: { username: 'admin', name: 'Chief Administrator', role: 'Admin', avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=120&auto=format&fit=crop&q=80' },
    passwordHash: 'admin123'
  },
  doctor: {
    user: { username: 'doctor', name: 'Dr. Sarah Wilson', role: 'Doctor', avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=120&auto=format&fit=crop&q=80' },
    passwordHash: 'doctor123'
  },
  analyst: {
    user: { username: 'analyst', name: 'Lead Platform Analyst', role: 'Analyst', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80' },
    passwordHash: 'analyst123'
  },
  finance: {
    user: { username: 'finance', name: 'Chief Financial Officer', role: 'Finance', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80' },
    passwordHash: 'finance123'
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: '10mb' }));

  // Initialize Database
  db.initialize();

  // Background Data Simulation Ticker (Cron-Equivalent)
  let tickInterval: NodeJS.Timeout | null = null;
  const triggerTicker = () => {
    if (tickInterval) clearInterval(tickInterval);
    
    let ms = 5 * 60 * 1000; // default 5 minutes
    if (db.simulationSpeed === 'Fast') ms = 15000; // every 15 seconds
    if (db.simulationSpeed === 'Hyper') ms = 4000; // every 4 seconds
    
    if (db.simulationSpeed !== 'Pause') {
      tickInterval = setInterval(() => {
        db.tick();
      }, ms);
    }
  };
  triggerTicker();

  // Authentication Middleware & Custom JWT Simulation
  const verifyToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization header is missing or malformed' });
      return;
    }
    const token = authHeader.split(' ')[1];
    try {
      // Decode simulated token
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
      const found = USERS[decoded.username];
      if (!found) {
         res.status(401).json({ error: 'Invalid mock access token' });
         return;
      }
      (req as any).user = found.user;
      next();
    } catch (e) {
       res.status(401).json({ error: 'Auth session expired or signature invalid' });
    }
  };

  // Role Access Control Middleware
  const restrictTo = (...allowedRoles: UserRole[]) => {
    return (req: any, res: express.Response, next: express.NextFunction) => {
      const user: User = req.user;
      if (!user || !allowedRoles.includes(user.role)) {
         res.status(403).json({ error: `Access denied. Role ${user?.role || 'Guest'} lacks permission ` });
         return;
      }
      next();
    };
  };

  // ----------------------------------------------------
  // REST API Endpoints
  // ----------------------------------------------------

  // Server Health Probe Check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      container: 'hospital-stream-engine',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Prometheus Metrics Export
  app.get('/metrics', (req, res) => {
    const metrics = db.getPipelineMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(`# HELP healthcare_simulator_patients_total Total synthetic patients generated in Bronze Lake
# TYPE healthcare_simulator_patients_total counter
healthcare_simulator_patients_total ${metrics.bronzeCount.patients}

# HELP healthcare_simulator_appointments_total Total clinical appointment logs in Bronze Lake
# TYPE healthcare_simulator_appointments_total counter
healthcare_simulator_appointments_total ${metrics.bronzeCount.appointments}

# HELP healthcare_simulator_transactions_total Total financial transactions synced to Medallion Gold
# TYPE healthcare_simulator_transactions_total counter
healthcare_simulator_transactions_total ${metrics.bronzeCount.transactions}

# HELP healthcare_simulator_silver_integrity_percentage Data quality pass rate on Silver Lake pipeline
# TYPE healthcare_simulator_silver_integrity_percentage gauge
healthcare_simulator_silver_integrity_percentage ${metrics.silverCleanPercentage}

# HELP healthcare_simulator_uptime_seconds Simulator container active uptime
# TYPE healthcare_simulator_uptime_seconds counter
healthcare_simulator_uptime_seconds ${process.uptime()}
`);
  });

  // Auth: Login Authentication
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const matched = USERS[username];
    if (matched && matched.passwordHash === password) {
      // Create lightweight simulated token (Base64 encoding a simple JSON payload)
      const tokenPayload = { username: matched.user.username, role: matched.user.role, exp: Date.now() + 24 * 60 * 60 * 1000 };
      const simulatedToken = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');
      res.json({
        token: simulatedToken,
        user: matched.user
      });
    } else {
      res.status(400).json({ error: 'Incorrect username or authentication password' });
    }
  });

  // Auth: Get Current Profile Session
  app.get('/api/auth/me', verifyToken, (req: any, res) => {
    res.json({ user: req.user });
  });

  // Simulation: Speed Controls & Status Indicators
  app.get('/api/simulation/status', (req, res) => {
    res.json({
      speed: db.simulationSpeed,
      lastGenerated: db.lastGeneratedTime,
      databaseMetrics: {
        patients: db.patients.length,
        appointments: db.appointments.length,
        doctors: db.doctors.length,
        transactions: db.transactions.length
      },
      recordGrowthHistory: db.recordGrowthHistory
    });
  });

  // Simulation Speed Alteration (Admin Access Only)
  app.post('/api/simulation/config', verifyToken, restrictTo('Admin'), (req, res) => {
    const { speed } = req.body;
    if (['Pause', 'RealTime', 'Fast', 'Hyper'].includes(speed)) {
      db.simulationSpeed = speed;
      triggerTicker();
      res.json({ message: `Simulation speed successfully set to ${speed}`, speed });
    } else {
      res.status(400).json({ error: 'Invalid speed config value specified' });
    }
  });

  // Reset database completely (Admin Access Only)
  app.post('/api/simulation/reset', verifyToken, restrictTo('Admin'), (req, res) => {
    db.resetDatabase();
    res.json({ message: 'Operational database completely reset to seed volume.' });
  });

  // Force Manual Activity Burst
  app.post('/api/simulation/generate', verifyToken, (req, res) => {
    db.tick();
    res.json({
      message: 'Incremental synthetic operational record generation complete',
      metrics: {
        patients: db.patients.length,
        appointments: db.appointments.length,
        transactions: db.transactions.length
      }
    });
  });

  // Analytics Module API
  app.get('/api/analytics/medallion', verifyToken, (req, res) => {
    const medallionStats = db.getPipelineMetrics();
    res.json(medallionStats);
  });

  // Dashboard Core Operational metrics
  app.get('/api/analytics/summary', verifyToken, (req, res) => {
    const patientsCount = db.patients.length;
    const appointmentsCount = db.appointments.length;
    const transactionsCount = db.transactions.length;

    // Computed Revenue Metrics
    const totalRevenue = db.transactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    // Doctor Utilizations Percentages
    const avgDocUtil = db.doctors.reduce((sum, doc) => sum + doc.utilization, 0) / db.doctors.length;
    
    // Departments patient satisfaction ratings
    const avgPatientSatisfy = db.departments.reduce((sum, d) => sum + d.kpiSatisfaction, 0) / db.departments.length;

    // Grouping appointments trends
    const appointmentTrends = db.appointments.reduce((acc: any, ap) => {
      const day = ap.appointmentDate.substring(0, 10);
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});
    const trendingList = Object.entries(appointmentTrends).map(([date, count]) => ({ date, count })).sort((a,b)=> a.date.localeCompare(b.date)).slice(-10);

    const activeInpatients = db.patients.filter(p => p.category === 'Inpatient').length;
    
    res.json({
      totalPatients: patientsCount,
      activePatients: activeInpatients,
      totalAppointments: appointmentsCount,
      revenueTotal: totalRevenue,
      avgDoctorUtilization: Math.round(avgDocUtil * 10) / 10,
      patientSatisfaction: Math.round(avgPatientSatisfy * 10) / 10,
      appointmentTrends: trendingList
    });
  });

  // Patients Resource Pool Filter (Analysts & Administrators)
  app.get('/api/patients', verifyToken, restrictTo('Admin', 'Analyst', 'Doctor', 'Finance'), (req, res) => {
    const { page = '1', limit = '10', state, category, search } = req.query;
    const pPage = parseInt(page as string);
    const pLimit = parseInt(limit as string);

    let filtered = db.patients;

    if (state) {
      filtered = filtered.filter(p => p.state === state);
    }
    if (category) {
      filtered = filtered.filter(p => p.category === category);
    }
    if (search) {
      const q = (search as string).toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    }

    const startIdx = (pPage - 1) * pLimit;
    const paged = filtered.slice(startIdx, startIdx + pLimit);

    res.json({
      data: paged,
      total: filtered.length,
      page: pPage,
      limit: pLimit,
      states: Array.from(new Set(db.patients.map(p => p.state))),
      categories: ['Inpatient', 'Outpatient', 'ER']
    });
  });

  // Appointments Resource Pool
  app.get('/api/appointments', verifyToken, restrictTo('Admin', 'Analyst', 'Doctor'), (req, res) => {
    const { page = '1', limit = '10', status, department } = req.query;
    const pPage = parseInt(page as string);
    const pLimit = parseInt(limit as string);

    let filtered = db.appointments;
    if (status) {
      filtered = filtered.filter(a => a.status === status);
    }
    if (department) {
      filtered = filtered.filter(a => a.department === department);
    }

    const startIdx = (pPage - 1) * pLimit;
    const paged = filtered.slice(startIdx, startIdx + pLimit);

    res.json({
      data: paged,
      total: filtered.length,
      page: pPage,
      limit: pLimit
    });
  });

  // Doctor Resource Pool
  app.get('/api/doctors', verifyToken, restrictTo('Admin', 'Analyst', 'Doctor'), (req, res) => {
    res.json({
      data: db.doctors,
      total: db.doctors.length
    });
  });

  // Department KPI Resource Pool
  app.get('/api/departments', verifyToken, (req, res) => {
    res.json({
      data: db.departments,
      total: db.departments.length
    });
  });

  // Transactions Billing Flow (Admin, Auditor & Finance Access Only)
  app.get('/api/transactions', verifyToken, restrictTo('Admin', 'Analyst', 'Finance'), (req, res) => {
    const { page = '1', limit = '10', type, paymentType } = req.query;
    const pPage = parseInt(page as string);
    const pLimit = parseInt(limit as string);

    let filtered = db.transactions;
    if (type) {
      filtered = filtered.filter(t => t.type === type);
    }
    if (paymentType) {
      filtered = filtered.filter(t => t.paymentType === paymentType);
    }

    const startIdx = (pPage - 1) * pLimit;
    const paged = filtered.slice(startIdx, startIdx + pLimit);

    res.json({
      data: paged,
      total: filtered.length,
      page: pPage,
      limit: pLimit
    });
  });

  // ----------------------------------------------------
  // Databricks Data Lake Export Capability (Ingestion APIs)
  // ----------------------------------------------------

  // A. CSV Export Middleware
  app.get('/api/export/csv/:table', (req, res) => {
    const table = req.params.table;
    
    let headers: string[] = [];
    let rows: any[] = [];

    if (table === 'patients') {
      headers = ['id', 'name', 'age', 'gender', 'bloodGroup', 'city', 'state', 'registrationDate', 'insuranceProvider', 'category'];
      rows = db.patients.map((p: any) => [
        p.id, p.name, p.age, p.gender, p.bloodGroup, p.city, p.state, p.registrationDate, p.insuranceProvider, p.category
      ]);
    } else if (table === 'appointments') {
      headers = ['id', 'patientId', 'doctorId', 'department', 'appointmentDate', 'duration', 'status', 'revenueGenerated'];
      rows = db.appointments.map((a: any) => [
        a.id, a.patientId, a.doctorId, a.department, a.appointmentDate, a.duration, a.status, a.revenueGenerated
      ]);
    } else if (table === 'doctors') {
      headers = ['id', 'name', 'department', 'experience', 'consultationFee', 'utilization'];
      rows = db.doctors.map((d: any) => [
        d.id, d.name, d.department, d.experience, d.consultationFee, d.utilization
      ]);
    } else if (table === 'departments') {
      headers = ['id', 'name', 'bedsTotal', 'bedsOccupied', 'kpiSatisfaction', 'avgWaitTime'];
      rows = db.departments.map((d: any) => [
        d.id, d.name, d.bedsTotal, d.bedsOccupied, d.kpiSatisfaction, d.avgWaitTime
      ]);
    } else if (table === 'transactions') {
      headers = ['id', 'patientId', 'appointmentId', 'date', 'amount', 'type', 'insuranceCoverage', 'paymentType', 'department'];
      rows = db.transactions.map((t: any) => [
        t.id, t.patientId, t.appointmentId || 'NULL', t.date, t.amount, t.type, t.insuranceCoverage, t.paymentType, t.department
      ]);
    } else {
      res.status(404).json({ error: 'Specifed simulation database table not found.' });
      return;
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map((val: any) => {
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=datacenter_bronze_${table}_lake.csv`);
    res.send(csvContent);
  });

  // B. JSON Raw Lake Export
  app.get('/api/export/json/:table', (req, res) => {
    const table = req.params.table;
    let data: any[] = [];

    if (table === 'patients') data = db.patients;
    else if (table === 'appointments') data = db.appointments;
    else if (table === 'doctors') data = db.doctors;
    else if (table === 'departments') data = db.departments;
    else if (table === 'transactions') data = db.transactions;
    else {
      res.status(404).json({ error: 'Specifed simulation database table not found.' });
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=datacenter_bronze_${table}_lake.json`);
    res.json(data);
  });

  // ----------------------------------------------------
  // Client Ingress Proxy Setup (Vite / Prod Fallback)
  // ----------------------------------------------------

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Healthcare Ingestion Engine server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
