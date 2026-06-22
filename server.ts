import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { db } from './server/database';
import { databricksClient } from './server/databricks';
import { databricksSyncService } from './server/databricks-sync';
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

  // Initialize Database (async now — connects to PostgreSQL and seeds if needed)
  await db.initialize();

  // Background Data Simulation Ticker (Cron-Equivalent)
  let tickInterval: NodeJS.Timeout | null = null;
  const triggerTicker = () => {
    if (tickInterval) clearInterval(tickInterval);
    
    let ms = 5 * 60 * 1000; // default 5 minutes
    if (db.simulationSpeed === 'Fast') ms = 15000; // every 15 seconds
    if (db.simulationSpeed === 'Hyper') ms = 4000; // every 4 seconds
    
    if (db.simulationSpeed !== 'Pause') {
      tickInterval = setInterval(async () => {
        await db.tick();
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
  app.get('/health', async (req, res) => {
    res.json({
      status: 'healthy',
      container: 'hospital-stream-engine',
      database: 'postgresql-rds',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Prometheus Metrics Export
  app.get('/metrics', async (req, res) => {
    const metrics = await db.getPipelineMetrics();
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

  // Simulation: Speed Controls & Status Indicators (Authenticated)
  app.get('/api/simulation/status', verifyToken, (req, res) => {
    res.json({
      speed: db.simulationSpeed,
      lastGenerated: db.lastGeneratedTime,
      databaseMetrics: {
        patients: db.counts.patients,
        appointments: db.counts.appointments,
        doctors: db.counts.doctors,
        transactions: db.counts.transactions
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
  app.post('/api/simulation/reset', verifyToken, restrictTo('Admin'), async (req, res) => {
    await db.resetDatabase();
    res.json({ message: 'Operational database completely reset to seed volume.' });
  });

  // Force Manual Activity Burst
  app.post('/api/simulation/generate', verifyToken, async (req, res) => {
    await db.tick();
    res.json({
      message: 'Incremental synthetic operational record generation complete',
      metrics: {
        patients: db.counts.patients,
        appointments: db.counts.appointments,
        transactions: db.counts.transactions
      }
    });
  });

  // Analytics Module API
  app.get('/api/analytics/medallion', verifyToken, async (req, res) => {
    const medallionStats = await db.getPipelineMetrics();
    res.json(medallionStats);
  });

  // Dashboard Core Operational metrics
  app.get('/api/analytics/summary', verifyToken, async (req, res) => {
    const summary = await db.getSummaryStats();
    res.json(summary);
  });

  // Patients Resource Pool Filter (Analysts & Administrators)
  app.get('/api/patients', verifyToken, restrictTo('Admin', 'Analyst', 'Doctor', 'Finance'), async (req, res) => {
    const { page = '1', limit = '10', state, category, search } = req.query;
    const result = await db.getPatients({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      state: state as string | undefined,
      category: category as string | undefined,
      search: search as string | undefined
    });
    res.json(result);
  });

  // Appointments Resource Pool
  app.get('/api/appointments', verifyToken, restrictTo('Admin', 'Analyst', 'Doctor'), async (req, res) => {
    const { page = '1', limit = '10', status, department } = req.query;
    const result = await db.getAppointments({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      status: status as string | undefined,
      department: department as string | undefined
    });
    res.json(result);
  });

  // Doctor Resource Pool
  app.get('/api/doctors', verifyToken, restrictTo('Admin', 'Analyst', 'Doctor'), async (req, res) => {
    const result = await db.getDoctors();
    res.json(result);
  });

  // Department KPI Resource Pool
  app.get('/api/departments', verifyToken, async (req, res) => {
    const result = await db.getDepartments();
    res.json(result);
  });

  // Transactions Billing Flow (Admin, Auditor & Finance Access Only)
  app.get('/api/transactions', verifyToken, restrictTo('Admin', 'Analyst', 'Finance'), async (req, res) => {
    const { page = '1', limit = '10', type, paymentType } = req.query;
    const result = await db.getTransactions({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      type: type as string | undefined,
      paymentType: paymentType as string | undefined
    });
    res.json(result);
  });

  // ----------------------------------------------------
  // Databricks Data Lake Export Capability (Ingestion APIs)
  // ----------------------------------------------------

  // A. CSV Export Middleware (Authenticated)
  app.get('/api/export/csv/:table', verifyToken, async (req, res) => {
    const table = req.params.table;
    
    let headers: string[] = [];
    let rows: any[][] = [];

    try {
      if (table === 'patients') {
        headers = ['id', 'name', 'age', 'gender', 'bloodGroup', 'city', 'state', 'registrationDate', 'insuranceProvider', 'category'];
        const data = await db.getAllPatients();
        rows = data.map((p: any) => [p.id, p.name, p.age, p.gender, p.bloodGroup, p.city, p.state, p.registrationDate, p.insuranceProvider, p.category]);
      } else if (table === 'appointments') {
        headers = ['id', 'patientId', 'doctorId', 'department', 'appointmentDate', 'duration', 'status', 'revenueGenerated'];
        const data = await db.getAllAppointments();
        rows = data.map((a: any) => [a.id, a.patientId, a.doctorId, a.department, a.appointmentDate, a.duration, a.status, a.revenueGenerated]);
      } else if (table === 'doctors') {
        headers = ['id', 'name', 'department', 'experience', 'consultationFee', 'utilization'];
        const data = await db.getAllDoctors();
        rows = data.map((d: any) => [d.id, d.name, d.department, d.experience, d.consultationFee, d.utilization]);
      } else if (table === 'departments') {
        headers = ['id', 'name', 'bedsTotal', 'bedsOccupied', 'kpiSatisfaction', 'avgWaitTime'];
        const data = await db.getAllDepartments();
        rows = data.map((d: any) => [d.id, d.name, d.bedsTotal, d.bedsOccupied, d.kpiSatisfaction, d.avgWaitTime]);
      } else if (table === 'transactions') {
        headers = ['id', 'patientId', 'appointmentId', 'date', 'amount', 'type', 'insuranceCoverage', 'paymentType', 'department'];
        const data = await db.getAllTransactions();
        rows = data.map((t: any) => [t.id, t.patientId, t.appointmentId || 'NULL', t.date, t.amount, t.type, t.insuranceCoverage, t.paymentType, t.department]);
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
    } catch (err: any) {
      res.status(500).json({ error: 'Error exporting data: ' + err.message });
    }
  });

  // B. JSON Raw Lake Export (Authenticated)
  app.get('/api/export/json/:table', verifyToken, async (req, res) => {
    const table = req.params.table;
    
    try {
      let data: any[] = [];

      if (table === 'patients') data = await db.getAllPatients();
      else if (table === 'appointments') data = await db.getAllAppointments();
      else if (table === 'doctors') data = await db.getAllDoctors();
      else if (table === 'departments') data = await db.getAllDepartments();
      else if (table === 'transactions') data = await db.getAllTransactions();
      else {
        res.status(404).json({ error: 'Specifed simulation database table not found.' });
        return;
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=datacenter_bronze_${table}_lake.json`);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: 'Error exporting data: ' + err.message });
    }
  });

  // ----------------------------------------------------
  // Databricks Integration API Endpoints
  // ----------------------------------------------------

  // Databricks: Execute SQL Query against SQL Warehouse
  app.post('/api/databricks/query', verifyToken, restrictTo('Admin', 'Analyst'), async (req, res) => {
    try {
      const { sql } = req.body;
      if (!sql || typeof sql !== 'string') {
        res.status(400).json({ error: 'SQL query string is required' });
        return;
      }
      const result = await databricksClient.executeQuery(sql);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Databricks: Connection Status & Health
  app.get('/api/databricks/status', verifyToken, async (req, res) => {
    try {
      const connectionTest = await databricksClient.testConnection();
      const connectionInfo = databricksClient.getConnectionInfo();
      const syncStatus = databricksSyncService.getStatus();

      res.json({
        ...connectionTest,
        ...connectionInfo,
        syncStatus
      });
    } catch (err: any) {
      res.json({
        connected: false,
        message: err.message,
        configured: databricksClient.isConfigured(),
        syncStatus: databricksSyncService.getStatus()
      });
    }
  });

  // Databricks: List Jobs & Pipeline Runs
  app.get('/api/databricks/jobs', verifyToken, restrictTo('Admin', 'Analyst'), async (req, res) => {
    try {
      const jobs = await databricksClient.listJobs();
      res.json({ jobs });
    } catch (err: any) {
      res.status(500).json({ error: err.message, jobs: [] });
    }
  });

  // Databricks: Trigger Manual Data Sync (RDS → Databricks)
  app.post('/api/databricks/sync', verifyToken, restrictTo('Admin', 'Analyst'), async (req, res) => {
    try {
      const result = await databricksSyncService.fullSync();
      // Also materialize Silver and Gold
      await databricksSyncService.materializeSilver();
      await databricksSyncService.materializeGold();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Databricks: List Unity Catalog Tables
  app.get('/api/databricks/tables', verifyToken, restrictTo('Admin', 'Analyst'), async (req, res) => {
    try {
      const { catalog, schema } = req.query;
      const tables = await databricksClient.listTables(catalog as string, schema as string);
      res.json({ tables });
    } catch (err: any) {
      res.status(500).json({ error: err.message, tables: [] });
    }
  });

  // Databricks: Get Warehouse Status
  app.get('/api/databricks/warehouse', verifyToken, async (req, res) => {
    try {
      const status = await databricksClient.getWarehouseStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
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
    console.log(`Database: PostgreSQL RDS at ${process.env.PGHOST || 'localhost'}`);
    console.log(`Databricks: ${databricksClient.isConfigured() ? 'Configured' : 'Not configured'}`);
  });
}

startServer();
