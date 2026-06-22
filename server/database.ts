import { query, getClient, runMigrations, connectWithRetry } from './postgres';
import { Patient, Doctor, Appointment, BillingTransaction, Department, PipelineMetrics } from '../src/types';

/**
 * PostgreSQL-backed Healthcare Database
 * 
 * All operations are async and backed by SQL queries against RDS PostgreSQL.
 * No in-memory arrays — all reads go through indexed SQL queries.
 */
class HealthcareDatabase {
  // Simulation config (cached locally, synced to DB)
  simulationSpeed: 'Pause' | 'RealTime' | 'Fast' | 'Hyper' = 'Fast';
  lastGeneratedTime: string = new Date().toISOString();
  recordGrowthHistory: { timestamp: string; patientsCount: number; appointmentsCount: number; transactionsCount: number }[] = [];

  // Cached counts for quick access (updated on tick)
  private _cachedCounts = { patients: 0, appointments: 0, doctors: 0, transactions: 0, departments: 0 };

  constructor() {}

  // ─────────────────────────────────────────────────
  // Initialize: Connect, migrate, seed if empty
  // ─────────────────────────────────────────────────
  public async initialize(): Promise<void> {
    console.log('[Database] Initializing PostgreSQL-backed Healthcare Database...');

    // Connect with retry
    const connected = await connectWithRetry(5);
    if (!connected) {
      throw new Error('Failed to connect to PostgreSQL after retries. Check PGHOST/PGUSER/PGPASSWORD env vars.');
    }

    // Run schema migration
    await runMigrations();

    // Load simulation config
    await this.loadSimulationConfig();

    // Check if data exists
    const result = await query('SELECT COUNT(*) AS cnt FROM pulsestream.patients');
    const patientCount = parseInt(result.rows[0].cnt);

    if (patientCount === 0) {
      console.log('[Database] No data found. Seeding initial dataset...');
      await this.seed();
    } else {
      console.log(`[Database] Found existing data: ${patientCount} patients.`);
    }

    // Refresh cached counts
    await this.refreshCachedCounts();

    console.log(`[Database] Initialization complete. Counts: ${JSON.stringify(this._cachedCounts)}`);
  }

  // ─────────────────────────────────────────────────
  // Load simulation config from DB
  // ─────────────────────────────────────────────────
  private async loadSimulationConfig(): Promise<void> {
    try {
      const result = await query('SELECT simulation_speed, last_generated_time, record_growth_history FROM pulsestream.simulation_config WHERE id = 1');
      if (result.rows.length > 0) {
        const row = result.rows[0];
        this.simulationSpeed = row.simulation_speed || 'Fast';
        this.lastGeneratedTime = row.last_generated_time ? new Date(row.last_generated_time).toISOString() : new Date().toISOString();
        this.recordGrowthHistory = row.record_growth_history || [];
      }
    } catch (err: any) {
      console.error('[Database] Error loading simulation config:', err.message);
    }
  }

  // ─────────────────────────────────────────────────
  // Save simulation config to DB
  // ─────────────────────────────────────────────────
  private async saveSimulationConfig(): Promise<void> {
    try {
      await query(
        `UPDATE pulsestream.simulation_config 
         SET simulation_speed = $1, last_generated_time = $2, record_growth_history = $3 
         WHERE id = 1`,
        [this.simulationSpeed, this.lastGeneratedTime, JSON.stringify(this.recordGrowthHistory)]
      );
    } catch (err: any) {
      console.error('[Database] Error saving simulation config:', err.message);
    }
  }

  // ─────────────────────────────────────────────────
  // Refresh cached counts (for quick dashboard access)
  // ─────────────────────────────────────────────────
  private async refreshCachedCounts(): Promise<void> {
    try {
      const [p, a, d, t, dep] = await Promise.all([
        query('SELECT COUNT(*) AS cnt FROM pulsestream.patients'),
        query('SELECT COUNT(*) AS cnt FROM pulsestream.appointments'),
        query('SELECT COUNT(*) AS cnt FROM pulsestream.doctors'),
        query('SELECT COUNT(*) AS cnt FROM pulsestream.transactions'),
        query('SELECT COUNT(*) AS cnt FROM pulsestream.departments'),
      ]);
      this._cachedCounts = {
        patients: parseInt(p.rows[0].cnt),
        appointments: parseInt(a.rows[0].cnt),
        doctors: parseInt(d.rows[0].cnt),
        transactions: parseInt(t.rows[0].cnt),
        departments: parseInt(dep.rows[0].cnt),
      };
    } catch (err: any) {
      console.error('[Database] Error refreshing counts:', err.message);
    }
  }

  // ─────────────────────────────────────────────────
  // Public count accessors (used by server.ts)
  // ─────────────────────────────────────────────────
  get counts() {
    return this._cachedCounts;
  }

  // ─────────────────────────────────────────────────
  // SEED: Batch insert 10K patients, 50K appointments, 100K transactions
  // ─────────────────────────────────────────────────
  private async seed(): Promise<void> {
    console.log('[Database] Generating seed database (10,000 patients, 50,000 appointments, 100,000 transactions)...');
    const startTime = Date.now();

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // 1. Departments
      const departments: Department[] = [
        { id: 'DEP_CARD', name: 'Cardiology', bedsTotal: 50, bedsOccupied: 32, kpiSatisfaction: 4.7, avgWaitTime: 24 },
        { id: 'DEP_NEUR', name: 'Neurology', bedsTotal: 30, bedsOccupied: 19, kpiSatisfaction: 4.5, avgWaitTime: 31 },
        { id: 'DEP_ORTH', name: 'Orthopedics', bedsTotal: 40, bedsOccupied: 28, kpiSatisfaction: 4.6, avgWaitTime: 20 },
        { id: 'DEP_PEDI', name: 'Pediatrics', bedsTotal: 35, bedsOccupied: 14, kpiSatisfaction: 4.9, avgWaitTime: 15 },
        { id: 'DEP_EMER', name: 'Emergency', bedsTotal: 60, bedsOccupied: 48, kpiSatisfaction: 4.1, avgWaitTime: 42 },
        { id: 'DEP_ONCO', name: 'Oncology', bedsTotal: 25, bedsOccupied: 21, kpiSatisfaction: 4.8, avgWaitTime: 18 },
        { id: 'DEP_DERM', name: 'Dermatology', bedsTotal: 15, bedsOccupied: 4, kpiSatisfaction: 4.4, avgWaitTime: 12 },
        { id: 'DEP_RADI', name: 'Radiology', bedsTotal: 20, bedsOccupied: 7, kpiSatisfaction: 4.6, avgWaitTime: 28 }
      ];

      for (const dep of departments) {
        await client.query(
          `INSERT INTO pulsestream.departments (id, name, beds_total, beds_occupied, kpi_satisfaction, avg_wait_time) 
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
          [dep.id, dep.name, dep.bedsTotal, dep.bedsOccupied, dep.kpiSatisfaction, dep.avgWaitTime]
        );
      }

      // 2. Doctors (24 doctors, 3 per department)
      const departmentNames = departments.map(d => d.name);
      const doctorFirstNames = ['David', 'Sarah', 'Robert', 'Emily', 'Michael', 'Jessica', 'James', 'Ashley', 'William', 'Karen', 'Richard', 'Nancy', 'Thomas', 'Lisa'];
      const doctorLastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson', 'Martinez', 'Anderson', 'Taylor', 'Thomas'];

      interface DoctorRecord { id: string; name: string; department: string; experience: number; consultationFee: number; utilization: number; }
      const doctors: DoctorRecord[] = [];
      let docIdCounter = 1;

      for (const dept of departmentNames) {
        for (let i = 0; i < 3; i++) {
          const id = `DR${String(docIdCounter).padStart(3, '0')}`;
          const name = `Dr. ${doctorFirstNames[(docIdCounter * 3 + i) % doctorFirstNames.length]} ${doctorLastNames[(docIdCounter * 7 + i) % doctorLastNames.length]}`;
          const experience = 5 + ((docIdCounter * 11 + i) % 31);
          const consultationFee = 100 + ((docIdCounter * 37 + i * 50) % 251);
          const utilization = 60 + ((docIdCounter * 13 + i * 8) % 31);

          doctors.push({ id, name, department: dept, experience, consultationFee, utilization });

          await client.query(
            `INSERT INTO pulsestream.doctors (id, name, department, experience, consultation_fee, utilization) 
             VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
            [id, name, dept, experience, consultationFee, utilization]
          );
          docIdCounter++;
        }
      }

      // 3. Patients (10,000) — batch insert in chunks of 1000
      console.log('[Database] Seeding patients...');
      const firstNamesMale = ['John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Paul', 'Steven', 'Andrew', 'Kenneth', 'Joshua', 'Kevin', 'Brian', 'George', 'Timothy', 'Ronald'];
      const firstNamesFemale = ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Lisa', 'Nancy', 'Betty', 'Sandra', 'Margaret', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle', 'Carol', 'Amanda', 'Dorothy', 'Melissa', 'Deborah'];
      const lastNamesList = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'];
      const insuranceOptions = ['HealthShield', 'AuraCare', 'MedLife', 'ApexPay', 'Self-Pay'];
      const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
      const citiesByState: { [key: string]: string[] } = {
        'OH': ['Cleveland', 'Columbus', 'Cincinnati', 'Toledo'],
        'IL': ['Chicago', 'Naperville', 'Aurora', 'Rockford'],
        'MA': ['Boston', 'Cambridge', 'Worcester', 'Springfield'],
        'WA': ['Seattle', 'Tacoma', 'Bellevue', 'Spokane'],
        'TX': ['Austin', 'Dallas', 'Houston', 'San Antonio'],
        'GA': ['Atlanta', 'Savannah', 'Augusta', 'Macon'],
        'CO': ['Denver', 'Boulder', 'Colorado Springs', 'Fort Collins'],
        'PA': ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie']
      };
      const states = Object.keys(citiesByState);
      const categories = ['Inpatient', 'Outpatient', 'ER'];

      // Build all patient data first
      interface PatientRecord { id: string; name: string; age: number; gender: string; bloodGroup: string; city: string; state: string; registrationDate: string; insuranceProvider: string; category: string; }
      const patientRecords: PatientRecord[] = [];

      for (let i = 1; i <= 10000; i++) {
        const isMale = i % 2 === 0;
        const firstName = isMale ? firstNamesMale[i % firstNamesMale.length] : firstNamesFemale[i % firstNamesFemale.length];
        const lastName = lastNamesList[i % lastNamesList.length];
        const id = `PT${String(i).padStart(6, '0')}`;
        const name = `${firstName} ${lastName}`;
        const age = 1 + (i % 95);
        const gender = isMale ? 'Male' : (i % 31 === 0 ? 'Other' : 'Female');
        const bloodGroup = bloodTypes[i % bloodTypes.length];
        const state = states[i % states.length];
        const cities = citiesByState[state];
        const city = cities[i % cities.length];
        const insuranceProvider = insuranceOptions[i % insuranceOptions.length];
        const regDaysAgo = Math.floor((i * 17) % 365);
        const registrationDate = new Date(Date.now() - regDaysAgo * 24 * 60 * 60 * 1000).toISOString();
        const category = categories[i % categories.length];

        patientRecords.push({ id, name, age, gender, bloodGroup, city, state, registrationDate, insuranceProvider, category });
      }

      // Batch insert patients in chunks of 1000
      for (let chunk = 0; chunk < patientRecords.length; chunk += 1000) {
        const batch = patientRecords.slice(chunk, chunk + 1000);
        const values: any[] = [];
        const placeholders: string[] = [];

        batch.forEach((p, idx) => {
          const offset = idx * 10;
          placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`);
          values.push(p.id, p.name, p.age, p.gender, p.bloodGroup, p.city, p.state, p.registrationDate, p.insuranceProvider, p.category);
        });

        await client.query(
          `INSERT INTO pulsestream.patients (id, name, age, gender, blood_group, city, state, registration_date, insurance_provider, category) 
           VALUES ${placeholders.join(', ')} ON CONFLICT (id) DO NOTHING`,
          values
        );
      }

      // 4. Appointments (50,000)
      console.log('[Database] Seeding appointments...');
      const appointmentStatuses = ['Completed', 'Completed', 'Completed', 'Scheduled', 'Cancelled', 'Rescheduled', 'Completed', 'Completed', 'Completed', 'Completed'];
      const durations = [15, 30, 45, 60];

      interface AppointmentRecord { id: string; patientId: string; doctorId: string; department: string; appointmentDate: string; duration: number; status: string; revenueGenerated: number; }
      const appointmentRecords: AppointmentRecord[] = [];

      for (let i = 1; i <= 50000; i++) {
        const id = `AP${String(i).padStart(6, '0')}`;
        const patientIndex = (i * 13) % 10000;
        const patient = patientRecords[patientIndex];
        const doctorIndex = (i * 7) % doctors.length;
        const doctor = doctors[doctorIndex];
        const appDaysAgo = Math.floor((i * 23) % 364);
        const status = appointmentStatuses[i % appointmentStatuses.length];

        let appDate: Date;
        if (status === 'Scheduled') {
          const daysInFuture = 1 + ((i * 11) % 30);
          appDate = new Date(Date.now() + daysInFuture * 24 * 60 * 60 * 1000);
        } else {
          appDate = new Date(Date.now() - appDaysAgo * 24 * 60 * 60 * 1000);
        }
        const hour = 8 + (i % 10);
        appDate.setHours(hour, (i % 4) * 15, 0, 0);

        const duration = durations[i % durations.length];
        const revenueGenerated = status === 'Cancelled' ? 0 : doctor.consultationFee;

        appointmentRecords.push({
          id,
          patientId: patient.id,
          doctorId: doctor.id,
          department: doctor.department,
          appointmentDate: appDate.toISOString(),
          duration,
          status,
          revenueGenerated
        });
      }

      // Batch insert appointments in chunks of 1000
      for (let chunk = 0; chunk < appointmentRecords.length; chunk += 1000) {
        const batch = appointmentRecords.slice(chunk, chunk + 1000);
        const values: any[] = [];
        const placeholders: string[] = [];

        batch.forEach((a, idx) => {
          const offset = idx * 8;
          placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`);
          values.push(a.id, a.patientId, a.doctorId, a.department, a.appointmentDate, a.duration, a.status, a.revenueGenerated);
        });

        await client.query(
          `INSERT INTO pulsestream.appointments (id, patient_id, doctor_id, department, appointment_date, duration, status, revenue_generated) 
           VALUES ${placeholders.join(', ')} ON CONFLICT (id) DO NOTHING`,
          values
        );
      }

      // 5. Transactions (100,000)
      console.log('[Database] Seeding transactions...');
      const billableAppointments = appointmentRecords.filter(ap => ap.status === 'Completed' || ap.status === 'Rescheduled');

      interface TransactionRecord { id: string; patientId: string; appointmentId: string | null; date: string; amount: number; type: string; insuranceCoverage: number; paymentType: string; department: string; }
      const transactionRecords: TransactionRecord[] = [];
      let txIdCounter = 1;

      // A. 50,000 linked to completed appointments
      for (let i = 0; i < Math.min(billableAppointments.length, 50000); i++) {
        const app = billableAppointments[i];
        const patient = patientRecords.find(pt => pt.id === app.patientId) || patientRecords[0];
        const txId = `TX${String(txIdCounter).padStart(6, '0')}`;
        const amount = app.revenueGenerated;
        const isSelfPay = patient.insuranceProvider === 'Self-Pay';
        const insuranceCoverage = isSelfPay ? 0 : Math.round(amount * (0.7 + (txIdCounter % 2) * 0.15));
        const paymentType = isSelfPay ? 'Cash' : 'Insurance';

        transactionRecords.push({
          id: txId,
          patientId: patient.id,
          appointmentId: app.id,
          date: app.appointmentDate,
          amount,
          type: 'Consultation',
          insuranceCoverage,
          paymentType,
          department: app.department
        });
        txIdCounter++;
      }

      // B. Remaining transactions (pharmacy, labs, ER)
      const paymentMethods = ['Cash', 'Credit Card', 'Debit Card'];
      for (let i = txIdCounter; i <= 100000; i++) {
        const txId = `TX${String(i).padStart(6, '0')}`;
        const patientIdx = (i * 29) % 10000;
        const patient = patientRecords[patientIdx];
        const randomTypePercent = i % 100;
        let type: string;
        let amount = 0;

        if (randomTypePercent < 50) {
          type = 'Pharmacy';
          amount = 15 + ((i * 13) % 285);
        } else if (randomTypePercent < 90) {
          type = 'Lab Fee';
          amount = 50 + ((i * 19) % 451);
        } else {
          type = 'Emergency Services';
          amount = 500 + ((i * 43) % 4501);
        }

        const isSelfPay = patient.insuranceProvider === 'Self-Pay';
        let insuranceCoverage = 0;
        let paymentType = paymentMethods[i % paymentMethods.length];

        if (!isSelfPay) {
          insuranceCoverage = Math.round(amount * (0.6 + (i % 31) * 0.01));
          paymentType = 'Insurance';
        }

        const txDaysAgo = Math.floor((i * 47) % 364);
        const txDate = new Date(Date.now() - txDaysAgo * 24 * 60 * 60 * 1000);
        txDate.setHours(9 + (i % 8), (i % 12) * 5, 0, 0);

        const doc = doctors[(i * 3) % doctors.length];
        const dept = type === 'Emergency Services' ? 'Emergency' : (type === 'Lab Fee' ? 'Radiology' : doc.department);

        transactionRecords.push({
          id: txId,
          patientId: patient.id,
          appointmentId: null,
          date: txDate.toISOString(),
          amount,
          type,
          insuranceCoverage,
          paymentType,
          department: dept
        });
      }

      // Batch insert transactions in chunks of 1000
      for (let chunk = 0; chunk < transactionRecords.length; chunk += 1000) {
        const batch = transactionRecords.slice(chunk, chunk + 1000);
        const values: any[] = [];
        const placeholders: string[] = [];

        batch.forEach((t, idx) => {
          const offset = idx * 9;
          placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`);
          values.push(t.id, t.patientId, t.appointmentId, t.date, t.amount, t.type, t.insuranceCoverage, t.paymentType, t.department);
        });

        await client.query(
          `INSERT INTO pulsestream.transactions (id, patient_id, appointment_id, date, amount, type, insurance_coverage, payment_type, department) 
           VALUES ${placeholders.join(', ')} ON CONFLICT (id) DO NOTHING`,
          values
        );
      }

      // Create baseline record growth history
      this.recordGrowthHistory = Array.from({ length: 12 }).map((_, idx) => {
        const monthDaysAgo = (11 - idx) * 30;
        const targetDate = new Date(Date.now() - monthDaysAgo * 24 * 60 * 60 * 1000).toISOString().substring(0, 7);
        return {
          timestamp: targetDate,
          patientsCount: Math.round(5000 + idx * 416),
          appointmentsCount: Math.round(20000 + idx * 2500),
          transactionsCount: Math.round(40000 + idx * 5000)
        };
      });

      await this.saveSimulationConfig();

      await client.query('COMMIT');

      const elapsed = Date.now() - startTime;
      console.log(`[Database] Seeded 10,000 patients, 50,000 appointments, 100,000 transactions in ${elapsed}ms.`);
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[Database] Seed failed, rolling back:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  // ─────────────────────────────────────────────────
  // TICK: Generate incremental records
  // ─────────────────────────────────────────────────
  public async tick(): Promise<void> {
    if (this.simulationSpeed === 'Pause') return;

    let multiplier = 1;
    if (this.simulationSpeed === 'Fast') multiplier = 5;
    if (this.simulationSpeed === 'Hyper') multiplier = 20;

    const countsToGenerate = Math.floor(Math.random() * multiplier) + 1;
    console.log(`[Simulation Tick] Generating ${countsToGenerate} records...`);

    const firstNamesMale = ['John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Christopher'];
    const firstNamesFemale = ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen'];
    const lastNamesList = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    const insuranceOptions = ['HealthShield', 'AuraCare', 'MedLife', 'ApexPay', 'Self-Pay'];
    const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const citiesAndStates = [
      { city: 'Cleveland', state: 'OH' }, { city: 'Chicago', state: 'IL' },
      { city: 'Boston', state: 'MA' }, { city: 'Seattle', state: 'WA' },
      { city: 'Austin', state: 'TX' }, { city: 'Atlanta', state: 'GA' },
      { city: 'Denver', state: 'CO' }, { city: 'Philadelphia', state: 'PA' }
    ];
    const categories = ['Inpatient', 'Outpatient', 'ER'];
    const durationOptions = [15, 30, 45, 60];
    const appointmentStatuses = ['Completed', 'Completed', 'Scheduled', 'Rescheduled', 'Completed'];

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Get current max IDs
      const [maxPt, maxAp, maxTx] = await Promise.all([
        client.query('SELECT COUNT(*) AS cnt FROM pulsestream.patients'),
        client.query('SELECT COUNT(*) AS cnt FROM pulsestream.appointments'),
        client.query('SELECT COUNT(*) AS cnt FROM pulsestream.transactions'),
      ]);

      let ptCounter = parseInt(maxPt.rows[0].cnt) + 1;
      let apCounter = parseInt(maxAp.rows[0].cnt) + 1;
      let txCounter = parseInt(maxTx.rows[0].cnt) + 1;

      // Get doctors for assignment
      const doctorsResult = await client.query('SELECT id, department, consultation_fee FROM pulsestream.doctors');
      const doctorRows = doctorsResult.rows;

      for (let i = 0; i < countsToGenerate; i++) {
        // 1. Patient
        const pId = `PT${String(ptCounter).padStart(6, '0')}`;
        const isMale = Math.random() > 0.5;
        const firstName = isMale ? firstNamesMale[Math.floor(Math.random() * firstNamesMale.length)] : firstNamesFemale[Math.floor(Math.random() * firstNamesFemale.length)];
        const lastName = lastNamesList[Math.floor(Math.random() * lastNamesList.length)];
        const loc = citiesAndStates[Math.floor(Math.random() * citiesAndStates.length)];
        const insuranceProvider = insuranceOptions[Math.floor(Math.random() * insuranceOptions.length)];

        await client.query(
          `INSERT INTO pulsestream.patients (id, name, age, gender, blood_group, city, state, registration_date, insurance_provider, category)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [pId, `${firstName} ${lastName}`, 18 + Math.floor(Math.random() * 70), isMale ? 'Male' : 'Female',
           bloodTypes[Math.floor(Math.random() * bloodTypes.length)], loc.city, loc.state, new Date().toISOString(),
           insuranceProvider, categories[Math.floor(Math.random() * categories.length)]]
        );

        // 2. Appointment
        const apId = `AP${String(apCounter).padStart(6, '0')}`;
        const doctor = doctorRows[Math.floor(Math.random() * doctorRows.length)];
        const status = appointmentStatuses[Math.floor(Math.random() * appointmentStatuses.length)];
        const revenueGenerated = status === 'Cancelled' ? 0 : doctor.consultation_fee;

        await client.query(
          `INSERT INTO pulsestream.appointments (id, patient_id, doctor_id, department, appointment_date, duration, status, revenue_generated)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [apId, pId, doctor.id, doctor.department, new Date().toISOString(),
           durationOptions[Math.floor(Math.random() * durationOptions.length)], status, revenueGenerated]
        );

        // 3. Transaction
        const txId = `TX${String(txCounter).padStart(6, '0')}`;
        let amount = doctor.consultation_fee;
        let type = 'Consultation';

        if (Math.random() > 0.5) {
          const typeRand = Math.random();
          if (typeRand < 0.45) { type = 'Pharmacy'; amount = Math.round(15 + Math.random() * 200); }
          else if (typeRand < 0.85) { type = 'Lab Fee'; amount = Math.round(50 + Math.random() * 300); }
          else { type = 'Emergency Services'; amount = Math.round(500 + Math.random() * 1500); }
        }

        const isSelfPay = insuranceProvider === 'Self-Pay';
        const insuranceCoverage = isSelfPay ? 0 : Math.round(amount * (0.65 + Math.random() * 0.25));
        const paymentType = isSelfPay ? 'Cash' : 'Insurance';

        await client.query(
          `INSERT INTO pulsestream.transactions (id, patient_id, appointment_id, date, amount, type, insurance_coverage, payment_type, department)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [txId, pId, type === 'Consultation' ? apId : null, new Date().toISOString(),
           amount, type, insuranceCoverage, paymentType, doctor.department]
        );

        ptCounter++;
        apCounter++;
        txCounter++;
      }

      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[Database] Tick error:', err.message);
      return;
    } finally {
      client.release();
    }

    // Update growth history
    await this.refreshCachedCounts();

    const currentMonth = new Date().toISOString().substring(0, 7);
    const existing = this.recordGrowthHistory.find(h => h.timestamp === currentMonth);
    if (existing) {
      existing.patientsCount = this._cachedCounts.patients;
      existing.appointmentsCount = this._cachedCounts.appointments;
      existing.transactionsCount = this._cachedCounts.transactions;
    } else {
      this.recordGrowthHistory.push({
        timestamp: currentMonth,
        patientsCount: this._cachedCounts.patients,
        appointmentsCount: this._cachedCounts.appointments,
        transactionsCount: this._cachedCounts.transactions
      });
      if (this.recordGrowthHistory.length > 12) {
        this.recordGrowthHistory.shift();
      }
    }

    this.lastGeneratedTime = new Date().toISOString();
    await this.saveSimulationConfig();
  }

  // ─────────────────────────────────────────────────
  // QUERY METHODS - Used by server.ts route handlers
  // ─────────────────────────────────────────────────

  public async getPatients(options: { page: number; limit: number; state?: string; category?: string; search?: string }) {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (options.state) { conditions.push(`state = $${paramIdx++}`); params.push(options.state); }
    if (options.category) { conditions.push(`category = $${paramIdx++}`); params.push(options.category); }
    if (options.search) {
      conditions.push(`(LOWER(name) LIKE $${paramIdx} OR LOWER(id) LIKE $${paramIdx})`);
      params.push(`%${options.search.toLowerCase()}%`);
      paramIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (options.page - 1) * options.limit;

    const [dataResult, countResult, statesResult] = await Promise.all([
      query(`SELECT id, name, age, gender, blood_group AS "bloodGroup", city, state, registration_date AS "registrationDate", insurance_provider AS "insuranceProvider", category FROM pulsestream.patients ${where} ORDER BY id DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`, [...params, options.limit, offset]),
      query(`SELECT COUNT(*) AS cnt FROM pulsestream.patients ${where}`, params),
      query('SELECT DISTINCT state FROM pulsestream.patients ORDER BY state'),
    ]);

    return {
      data: dataResult.rows.map(r => ({ ...r, registrationDate: new Date(r.registrationDate).toISOString() })),
      total: parseInt(countResult.rows[0].cnt),
      page: options.page,
      limit: options.limit,
      states: statesResult.rows.map(r => r.state),
      categories: ['Inpatient', 'Outpatient', 'ER']
    };
  }

  public async getAppointments(options: { page: number; limit: number; status?: string; department?: string }) {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (options.status) { conditions.push(`status = $${paramIdx++}`); params.push(options.status); }
    if (options.department) { conditions.push(`department = $${paramIdx++}`); params.push(options.department); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (options.page - 1) * options.limit;

    const [dataResult, countResult] = await Promise.all([
      query(`SELECT id, patient_id AS "patientId", doctor_id AS "doctorId", department, appointment_date AS "appointmentDate", duration, status, revenue_generated AS "revenueGenerated" FROM pulsestream.appointments ${where} ORDER BY appointment_date DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`, [...params, options.limit, offset]),
      query(`SELECT COUNT(*) AS cnt FROM pulsestream.appointments ${where}`, params),
    ]);

    return {
      data: dataResult.rows.map(r => ({ ...r, appointmentDate: new Date(r.appointmentDate).toISOString(), revenueGenerated: parseFloat(r.revenueGenerated) })),
      total: parseInt(countResult.rows[0].cnt),
      page: options.page,
      limit: options.limit
    };
  }

  public async getDoctors() {
    const result = await query('SELECT id, name, department, experience, consultation_fee AS "consultationFee", utilization FROM pulsestream.doctors ORDER BY id');
    return {
      data: result.rows.map(r => ({ ...r, consultationFee: parseFloat(r.consultationFee), utilization: parseInt(r.utilization) })),
      total: result.rows.length
    };
  }

  public async getDepartments() {
    const result = await query('SELECT id, name, beds_total AS "bedsTotal", beds_occupied AS "bedsOccupied", kpi_satisfaction AS "kpiSatisfaction", avg_wait_time AS "avgWaitTime" FROM pulsestream.departments ORDER BY name');
    return {
      data: result.rows.map(r => ({ ...r, bedsTotal: parseInt(r.bedsTotal), bedsOccupied: parseInt(r.bedsOccupied), kpiSatisfaction: parseFloat(r.kpiSatisfaction), avgWaitTime: parseInt(r.avgWaitTime) })),
      total: result.rows.length
    };
  }

  public async getTransactions(options: { page: number; limit: number; type?: string; paymentType?: string }) {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (options.type) { conditions.push(`type = $${paramIdx++}`); params.push(options.type); }
    if (options.paymentType) { conditions.push(`payment_type = $${paramIdx++}`); params.push(options.paymentType); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (options.page - 1) * options.limit;

    const [dataResult, countResult] = await Promise.all([
      query(`SELECT id, patient_id AS "patientId", appointment_id AS "appointmentId", date, amount, type, insurance_coverage AS "insuranceCoverage", payment_type AS "paymentType", department FROM pulsestream.transactions ${where} ORDER BY date DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`, [...params, options.limit, offset]),
      query(`SELECT COUNT(*) AS cnt FROM pulsestream.transactions ${where}`, params),
    ]);

    return {
      data: dataResult.rows.map(r => ({
        ...r,
        date: new Date(r.date).toISOString(),
        amount: parseFloat(r.amount),
        insuranceCoverage: parseFloat(r.insuranceCoverage)
      })),
      total: parseInt(countResult.rows[0].cnt),
      page: options.page,
      limit: options.limit
    };
  }

  // ─────────────────────────────────────────────────
  // Analytics: Summary stats for dashboard
  // ─────────────────────────────────────────────────
  public async getSummaryStats() {
    const [revenueResult, avgDocUtil, avgSatisfaction, trendResult, inpatientCount] = await Promise.all([
      query('SELECT COALESCE(SUM(amount), 0) AS total_revenue FROM pulsestream.transactions'),
      query('SELECT COALESCE(AVG(utilization), 0) AS avg_util FROM pulsestream.doctors'),
      query('SELECT COALESCE(AVG(kpi_satisfaction), 0) AS avg_sat FROM pulsestream.departments'),
      query(`SELECT TO_CHAR(appointment_date, 'YYYY-MM-DD') AS date, COUNT(*) AS count 
             FROM pulsestream.appointments 
             GROUP BY date ORDER BY date DESC LIMIT 10`),
      query("SELECT COUNT(*) AS cnt FROM pulsestream.patients WHERE category = 'Inpatient'"),
    ]);

    return {
      totalPatients: this._cachedCounts.patients,
      activePatients: parseInt(inpatientCount.rows[0].cnt),
      totalAppointments: this._cachedCounts.appointments,
      revenueTotal: parseFloat(revenueResult.rows[0].total_revenue),
      avgDoctorUtilization: Math.round(parseFloat(avgDocUtil.rows[0].avg_util) * 10) / 10,
      patientSatisfaction: Math.round(parseFloat(avgSatisfaction.rows[0].avg_sat) * 10) / 10,
      appointmentTrends: trendResult.rows.map(r => ({ date: r.date, count: parseInt(r.count) })).reverse()
    };
  }

  // ─────────────────────────────────────────────────
  // Medallion Pipeline Metrics - SQL aggregations
  // ─────────────────────────────────────────────────
  public async getPipelineMetrics(): Promise<PipelineMetrics> {
    await this.refreshCachedCounts();

    const pCount = this._cachedCounts.patients;
    const aCount = this._cachedCounts.appointments;
    const dCount = this._cachedCounts.doctors;
    const depCount = this._cachedCounts.departments;
    const tCount = this._cachedCounts.transactions;

    const silverRecordsProcessed = pCount + aCount + dCount + depCount + tCount;
    const silverCleanPercentage = 99.85;

    // Run Gold aggregation queries in parallel
    const [insuranceResult, deptProfitResult, monthlyResult, doctorPerfResult] = await Promise.all([
      // Insurance Utilization
      query(`SELECT p.insurance_provider AS provider, COUNT(*) AS count, COALESCE(SUM(t.amount), 0) AS total_revenue
             FROM pulsestream.transactions t
             JOIN pulsestream.patients p ON t.patient_id = p.id
             GROUP BY p.insurance_provider
             ORDER BY count DESC`),

      // Department Profitability
      query(`SELECT t.department, COALESCE(SUM(t.amount), 0) AS revenue
             FROM pulsestream.transactions t
             GROUP BY t.department
             ORDER BY revenue DESC`),

      // Monthly Revenue Trend
      query(`SELECT TO_CHAR(t.date, 'YYYY-MM') AS month, t.type, COALESCE(SUM(t.amount), 0) AS total
             FROM pulsestream.transactions t
             GROUP BY month, t.type
             ORDER BY month DESC`),

      // Doctor Performance
      query(`SELECT d.name, d.department, d.utilization,
                    COUNT(a.id) AS appointments,
                    COALESCE(SUM(CASE WHEN a.status = 'Completed' THEN a.revenue_generated ELSE 0 END), 0) AS revenue
             FROM pulsestream.doctors d
             LEFT JOIN pulsestream.appointments a ON d.id = a.doctor_id
             GROUP BY d.id, d.name, d.department, d.utilization
             ORDER BY revenue DESC`),
    ]);

    // Process insurance utilization
    const insuranceUtilization = insuranceResult.rows.map(r => ({
      provider: r.provider,
      count: parseInt(r.count),
      totalRevenue: Math.round(parseFloat(r.total_revenue))
    }));

    // Process department profitability (add simulated costs)
    const deptCosts: { [key: string]: number } = {};
    const deptResult = await query('SELECT name, beds_occupied, avg_wait_time FROM pulsestream.departments');
    for (const dep of deptResult.rows) {
      deptCosts[dep.name] = 25000 + dep.beds_occupied * 450 + dep.avg_wait_time * 150;
    }

    const departmentProfitability = deptProfitResult.rows.map(r => {
      const revenue = Math.round(parseFloat(r.revenue));
      const cost = Math.round(deptCosts[r.department] || 15000);
      return {
        department: r.department,
        revenue,
        cost,
        profit: revenue - cost
      };
    });

    // Process monthly revenue trend (pivot by type)
    const monthMap: { [key: string]: { consultation: number; lab: number; pharmacy: number; emergency: number; total: number } } = {};
    for (const row of monthlyResult.rows) {
      if (!monthMap[row.month]) {
        monthMap[row.month] = { consultation: 0, lab: 0, pharmacy: 0, emergency: 0, total: 0 };
      }
      const amount = Math.round(parseFloat(row.total));
      if (row.type === 'Consultation') monthMap[row.month].consultation = amount;
      else if (row.type === 'Lab Fee') monthMap[row.month].lab = amount;
      else if (row.type === 'Pharmacy') monthMap[row.month].pharmacy = amount;
      else if (row.type === 'Emergency Services') monthMap[row.month].emergency = amount;
      monthMap[row.month].total += amount;
    }

    const sortedMonths = Object.keys(monthMap).sort();
    const monthlyRevenueTrend = sortedMonths.map(month => ({
      month,
      ...monthMap[month]
    })).slice(-12);

    // Process doctor performance
    const doctorPerformance = doctorPerfResult.rows.map(r => ({
      doctorName: r.name,
      department: r.department,
      appointments: parseInt(r.appointments),
      revenue: Math.round(parseFloat(r.revenue)),
      utilization: parseInt(r.utilization)
    }));

    return {
      bronzeCount: {
        patients: pCount,
        appointments: aCount,
        doctors: dCount,
        departments: depCount,
        transactions: tCount,
        total: pCount + aCount + dCount + depCount + tCount
      },
      silverCleanPercentage,
      silverRecordsProcessed,
      goldAggregations: {
        insuranceUtilization,
        departmentProfitability,
        monthlyRevenueTrend,
        doctorPerformance
      }
    };
  }

  // ─────────────────────────────────────────────────
  // Export methods for CSV/JSON endpoints
  // ─────────────────────────────────────────────────
  public async getAllPatients(): Promise<Patient[]> {
    const result = await query('SELECT id, name, age, gender, blood_group AS "bloodGroup", city, state, registration_date AS "registrationDate", insurance_provider AS "insuranceProvider", category FROM pulsestream.patients ORDER BY id');
    return result.rows.map(r => ({ ...r, registrationDate: new Date(r.registrationDate).toISOString() }));
  }

  public async getAllAppointments(): Promise<Appointment[]> {
    const result = await query('SELECT id, patient_id AS "patientId", doctor_id AS "doctorId", department, appointment_date AS "appointmentDate", duration, status, revenue_generated AS "revenueGenerated" FROM pulsestream.appointments ORDER BY id');
    return result.rows.map(r => ({ ...r, appointmentDate: new Date(r.appointmentDate).toISOString(), revenueGenerated: parseFloat(r.revenueGenerated) }));
  }

  public async getAllDoctors(): Promise<Doctor[]> {
    const result = await query('SELECT id, name, department, experience, consultation_fee AS "consultationFee", utilization FROM pulsestream.doctors ORDER BY id');
    return result.rows.map(r => ({ ...r, consultationFee: parseFloat(r.consultationFee), utilization: parseInt(r.utilization) }));
  }

  public async getAllDepartments(): Promise<Department[]> {
    const result = await query('SELECT id, name, beds_total AS "bedsTotal", beds_occupied AS "bedsOccupied", kpi_satisfaction AS "kpiSatisfaction", avg_wait_time AS "avgWaitTime" FROM pulsestream.departments ORDER BY id');
    return result.rows.map(r => ({ ...r, bedsTotal: parseInt(r.bedsTotal), bedsOccupied: parseInt(r.bedsOccupied), kpiSatisfaction: parseFloat(r.kpiSatisfaction), avgWaitTime: parseInt(r.avgWaitTime) }));
  }

  public async getAllTransactions(): Promise<BillingTransaction[]> {
    const result = await query('SELECT id, patient_id AS "patientId", appointment_id AS "appointmentId", date, amount, type, insurance_coverage AS "insuranceCoverage", payment_type AS "paymentType", department FROM pulsestream.transactions ORDER BY id');
    return result.rows.map(r => ({ ...r, date: new Date(r.date).toISOString(), amount: parseFloat(r.amount), insuranceCoverage: parseFloat(r.insuranceCoverage) }));
  }

  // ─────────────────────────────────────────────────
  // Reset database to initial seed
  // ─────────────────────────────────────────────────
  public async resetDatabase(): Promise<void> {
    console.log('[Database] Resetting database...');
    await query('TRUNCATE pulsestream.transactions, pulsestream.appointments, pulsestream.patients, pulsestream.doctors, pulsestream.departments CASCADE');
    await this.seed();
    await this.refreshCachedCounts();
  }
}

export const db = new HealthcareDatabase();
