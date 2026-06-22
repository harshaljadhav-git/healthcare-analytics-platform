import fs from 'fs';
import path from 'path';
import { Patient, Doctor, Appointment, BillingTransaction, Department, PipelineMetrics } from '../src/types';

// Constants
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'healthcare_db.json');

// Memory store
class HealthcareDatabase {
  patients: Patient[] = [];
  doctors: Doctor[] = [];
  appointments: Appointment[] = [];
  transactions: BillingTransaction[] = [];
  departments: Department[] = [];
  
  // O(1) patient lookup index
  patientIndex: Map<string, Patient> = new Map();
  
  // Custom simulation configs
  simulationSpeed: 'Pause' | 'RealTime' | 'Fast' | 'Hyper' = 'Fast';
  lastGeneratedTime: string = new Date().toISOString();
  recordGrowthHistory: { timestamp: string; patientsCount: number; appointmentsCount: number; transactionsCount: number }[] = [];

  constructor() {
    this.ensureDirectories();
  }

  private ensureDirectories() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  // Load from disk or seed completely new data
  public initialize() {
    console.log('Initializing Healthcare Simulation Database...');
    if (fs.existsSync(DB_FILE)) {
      try {
        console.log('Found existing database file. Loading...');
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        this.patients = parsed.patients || [];
        this.doctors = parsed.doctors || [];
        this.appointments = parsed.appointments || [];
        this.transactions = parsed.transactions || [];
        this.departments = parsed.departments || [];
        this.simulationSpeed = parsed.simulationSpeed || 'Fast';
        this.lastGeneratedTime = parsed.lastGeneratedTime || new Date().toISOString();
        this.recordGrowthHistory = parsed.recordGrowthHistory || [];
        
        console.log(`Loaded fully functional dataset: ${this.patients.length} patients, ${this.appointments.length} appointments, ${this.transactions.length} transactions.`);
        
        // Build patient index for O(1) lookups
        this.rebuildPatientIndex();
        
        // If data is somehow empty, seed it
        if (this.patients.length === 0) {
          this.seed();
        }
        return;
      } catch (err) {
        console.error('Failed to load database file, generating fresh seed...', err);
      }
    }
    
    // Seed new data
    this.seed();
  }

  // Save database back to disk asynchronously to prevent blocking the main thread
  public async save() {
    try {
      this.ensureDirectories();
      const payload = {
        patients: this.patients,
        doctors: this.doctors,
        appointments: this.appointments,
        transactions: this.transactions,
        departments: this.departments,
        simulationSpeed: this.simulationSpeed,
        lastGeneratedTime: this.lastGeneratedTime,
        recordGrowthHistory: this.recordGrowthHistory
      };
      
      // Write to a temporary file, then rename it (atomic write)
      const tempFile = DB_FILE + '.tmp';
      fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2));
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error('Error saving databases to disk:', err);
    }
  }

  // Rebuild the patient index Map for O(1) lookups
  private rebuildPatientIndex() {
    this.patientIndex.clear();
    for (const p of this.patients) {
      this.patientIndex.set(p.id, p);
    }
  }

  // Pure fast synthetic seed generator
  private seed() {
    console.log('Generating seed database (10,000 patients, 50,000 appointments, 100,000 transactions)...');
    
    const startTime = Date.now();

    // 1. Core Departments
    this.departments = [
      { id: 'DEP_CARD', name: 'Cardiology', bedsTotal: 50, bedsOccupied: 32, kpiSatisfaction: 4.7, avgWaitTime: 24 },
      { id: 'DEP_NEUR', name: 'Neurology', bedsTotal: 30, bedsOccupied: 19, kpiSatisfaction: 4.5, avgWaitTime: 31 },
      { id: 'DEP_ORTH', name: 'Orthopedics', bedsTotal: 40, bedsOccupied: 28, kpiSatisfaction: 4.6, avgWaitTime: 20 },
      { id: 'DEP_PEDI', name: 'Pediatrics', bedsTotal: 35, bedsOccupied: 14, kpiSatisfaction: 4.9, avgWaitTime: 15 },
      { id: 'DEP_EMER', name: 'Emergency', bedsTotal: 60, bedsOccupied: 48, kpiSatisfaction: 4.1, avgWaitTime: 42 },
      { id: 'DEP_ONCO', name: 'Oncology', bedsTotal: 25, bedsOccupied: 21, kpiSatisfaction: 4.8, avgWaitTime: 18 },
      { id: 'DEP_DERM', name: 'Dermatology', bedsTotal: 15, bedsOccupied: 4, kpiSatisfaction: 4.4, avgWaitTime: 12 },
      { id: 'DEP_RADI', name: 'Radiology', bedsTotal: 20, bedsOccupied: 7, kpiSatisfaction: 4.6, avgWaitTime: 28 }
    ];

    // 2. Doctors (24 doctors, 3 per department)
    const departmentsNames = this.departments.map(d => d.name);
    const doctorFirstNames = ['David', 'Sarah', 'Robert', 'Emily', 'Michael', 'Jessica', 'James', 'Ashley', 'William', 'Karen', 'Richard', 'Nancy', 'Thomas', 'Lisa'];
    const doctorLastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson', 'Martinez', 'Anderson', 'Taylor', 'Thomas'];
    
    let docIdCounter = 1;
    for (const dept of departmentsNames) {
      for (let i = 0; i < 3; i++) {
        const id = `DR${String(docIdCounter).padStart(3, '0')}`;
        const name = `Dr. ${doctorFirstNames[(docIdCounter * 3 + i) % doctorFirstNames.length]} ${doctorLastNames[(docIdCounter * 7 + i) % doctorLastNames.length]}`;
        const experience = 5 + ((docIdCounter * 11 + i) % 31); // 5 to 35
        const consultationFee = 100 + ((docIdCounter * 37 + i * 50) % 251); // 100 to 350
        const utilization = 60 + ((docIdCounter * 13 + i * 8) % 31); // 60 to 90 %
        this.doctors.push({
          id,
          name,
          department: dept,
          experience,
          consultationFee,
          utilization
        });
        docIdCounter++;
      }
    }

    // 3. Patients (10,000 synthetic patients)
    const firstNamesMale = ['John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Paul', 'Steven', 'Andrew', 'Kenneth', 'Joshua', 'Kevin', 'Brian', 'George', 'Timothy', 'Ronald'];
    const firstNamesFemale = ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Lisa', 'Nancy', 'Betty', 'Sandra', 'Margaret', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle', 'Carol', 'Amanda', 'Dorothy', 'Melissa', 'Deborah'];
    const lastNamesList = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'];
    
    const insuranceOptions: ('HealthShield' | 'AuraCare' | 'MedLife' | 'ApexPay' | 'Self-Pay')[] = ['HealthShield', 'AuraCare', 'MedLife', 'ApexPay', 'Self-Pay'];
    const bloodTypes: ('A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-')[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
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
    const categories: ('Inpatient' | 'Outpatient' | 'ER')[] = ['Inpatient', 'Outpatient', 'ER'];

    console.log('Generating patients...');
    for (let i = 1; i <= 10000; i++) {
      const isMale = i % 2 === 0;
      const firstName = isMale ? firstNamesMale[i % firstNamesMale.length] : firstNamesFemale[i % firstNamesFemale.length];
      const lastName = lastNamesList[i % lastNamesList.length];
      const id = `PT${String(i).padStart(6, '0')}`;
      const name = `${firstName} ${lastName}`;
      const age = 1 + (i % 95); // 1 to 95 years old
      const gender = isMale ? 'Male' : (i % 31 === 0 ? 'Other' : 'Female');
      const bloodGroup = bloodTypes[i % bloodTypes.length];
      
      const state = states[i % states.length];
      const cities = citiesByState[state];
      const city = cities[i % cities.length];
      
      const insuranceProvider = insuranceOptions[i % insuranceOptions.length];
      
      // Distributed over past 12 months (365 days)
      const regDaysAgo = Math.floor((i * 17) % 365);
      const registrationDate = new Date(Date.now() - regDaysAgo * 24 * 60 * 60 * 1000).toISOString();
      const category = categories[i % categories.length];

      this.patients.push({
        id,
        name,
        age,
        gender,
        bloodGroup,
        city,
        state,
        registrationDate,
        insuranceProvider,
        category
      });
    }

    // 4. Appointments (50,000 appointments)
    console.log('Generating appointments...');
    const appointmentStatuses: ('Scheduled' | 'Completed' | 'Cancelled' | 'Rescheduled')[] = ['Completed', 'Completed', 'Completed', 'Scheduled', 'Cancelled', 'Rescheduled', 'Completed', 'Completed', 'Completed', 'Completed'];
    const durations = [15, 30, 45, 60];

    for (let i = 1; i <= 50000; i++) {
      const id = `AP${String(i).padStart(6, '0')}`;
      
      // Choose consistent patient and doctor
      const patientIndex = (i * 13) % 10000;
      const patient = this.patients[patientIndex];
      
      const doctorIndex = (i * 7) % this.doctors.length;
      const doctor = this.doctors[doctorIndex];

      // Distribute appointment date over 12 months
      const appDaysAgo = Math.floor((i * 23) % 364);
      // To ensure "Scheduled" are in the FUTURE (past registrations but upcoming appointments)
      const status = appointmentStatuses[i % appointmentStatuses.length];
      
      let appDate: Date;
      if (status === 'Scheduled') {
        // Scheduled is in the future (next 30 days)
        const daysInFuture = 1 + ((i * 11) % 30);
        appDate = new Date(Date.now() + daysInFuture * 24 * 60 * 60 * 1000);
      } else {
        // In the past
        appDate = new Date(Date.now() - appDaysAgo * 24 * 60 * 60 * 1000);
      }
      
      // Set to realistic working hours (8 AM to 5 PM)
      const hour = 8 + (i % 10);
      appDate.setHours(hour, (i % 4) * 15, 0, 0);

      const duration = durations[i % durations.length];
      const revenueGenerated = status === 'Cancelled' ? 0 : doctor.consultationFee;

      this.appointments.push({
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

    // 5. Billing Transactions (100,000 transactions)
    // 50,000 tied directly to completed appointments as Consultation fee
    // 25,000 Pharmacy bills
    // 20,000 Lab Fee bills
    // 5,000 Emergency Services bills
    console.log('Generating billing transactions...');
    let txIdCounter = 1;

    // A. 50,000 linked to completed appointments
    // We filter the generated appointments that are completed/rescheduled to associate transactions
    const billableAppointments = this.appointments.filter(ap => ap.status === 'Completed' || ap.status === 'Rescheduled');
    
    for (let i = 0; i < Math.min(billableAppointments.length, 50000); i++) {
      const app = billableAppointments[i];
      const patient = this.patients.find(pt => pt.id === app.patientId) || this.patients[0];
      const txId = `TX${String(txIdCounter).padStart(6, '0')}`;
      
      const amount = app.revenueGenerated;
      const isSelfPay = patient.insuranceProvider === 'Self-Pay';
      const insuranceCoverage = isSelfPay ? 0 : Math.round(amount * (0.7 + (txIdCounter % 2) * 0.15)); // 70% or 85% coverage
      const paymentType = isSelfPay ? 'Cash' : 'Insurance';

      this.transactions.push({
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

    // B. Build the other 50,000 transactions (unlinked to appointments - pharmacy, labs, ER)
    const transactionTypes: ('Pharmacy' | 'Lab Fee' | 'Emergency Services')[] = ['Pharmacy', 'Lab Fee', 'Emergency Services'];
    const paymentMethods: ('Cash' | 'Credit Card' | 'Debit Card')[] = ['Cash', 'Credit Card', 'Debit Card'];

    for (let i = txIdCounter; i <= 100000; i++) {
      const txId = `TX${String(i).padStart(6, '0')}`;
      const patientIdx = (i * 29) % 10000;
      const patient = this.patients[patientIdx];
      
      const randomTypePercent = i % 100;
      let type: 'Pharmacy' | 'Lab Fee' | 'Emergency Services';
      let amount = 0;
      let deptName = 'Radiology';

      if (randomTypePercent < 50) {
        // Pharmacy (50%)
        type = 'Pharmacy';
        amount = 15 + ((i * 13) % 285); // $15 to $300
        deptName = 'Pediatrics'; // default distribution
      } else if (randomTypePercent < 90) {
        // Lab Fee (40%)
        type = 'Lab Fee';
        amount = 50 + ((i * 19) % 451); // $50 to $500
        deptName = 'Radiology';
      } else {
        // Emergency Services (10%)
        type = 'Emergency Services';
        amount = 500 + ((i * 43) % 4501); // $500 to $5000
        deptName = 'Emergency';
      }

      const isSelfPay = patient.insuranceProvider === 'Self-Pay';
      let insuranceCoverage = 0;
      let paymentType: 'Insurance' | 'Cash' | 'Credit Card' | 'Debit Card' = paymentMethods[i % paymentMethods.length];

      if (!isSelfPay) {
        // Has insurance
        insuranceCoverage = Math.round(amount * (0.6 + (i % 31) * 0.01)); // 60% to 91% coverage
        paymentType = 'Insurance';
      }

      // Distribute date over last 12 months
      const txDaysAgo = Math.floor((i * 47) % 364);
      const txDate = new Date(Date.now() - txDaysAgo * 24 * 60 * 60 * 1000);
      txDate.setHours(9 + (i % 8), (i % 12) * 5, 0, 0);

      // Select Doctor's department dynamically for other entries
      const doc = this.doctors[(i * 3) % this.doctors.length];
      const dept = type === 'Emergency Services' ? 'Emergency' : (type === 'Lab Fee' ? 'Radiology' : doc.department);

      this.transactions.push({
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

    const elapsed = Date.now() - startTime;
    console.log(`Database seeded with 10,000 patients, 50,000 appointments, and 100,000 transactions in ${elapsed}ms.`);
    
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

    this.save();
    
    // Build patient index after seeding
    this.rebuildPatientIndex();
  }

  // Generate 1-10 incremental records to simulate system activity
  public tick() {
    if (this.simulationSpeed === 'Pause') return;

    let multiplier = 1;
    if (this.simulationSpeed === 'Fast') multiplier = 5;
    if (this.simulationSpeed === 'Hyper') multiplier = 20;

    const countsToGenerate = Math.floor(Math.random() * multiplier) + 1;
    console.log(`[Simulation Tick] Generating ${countsToGenerate} records of synthetic clinical activity...`);

    const firstNamesMale = ['John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Christopher'];
    const firstNamesFemale = ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen'];
    const lastNamesList = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    const insuranceOptions: ('HealthShield' | 'AuraCare' | 'MedLife' | 'ApexPay' | 'Self-Pay')[] = ['HealthShield', 'AuraCare', 'MedLife', 'ApexPay', 'Self-Pay'];
    const bloodTypes: ('A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-')[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const citiesAndStates = [
      { city: 'Cleveland', state: 'OH' },
      { city: 'Chicago', state: 'IL' },
      { city: 'Boston', state: 'MA' },
      { city: 'Seattle', state: 'WA' },
      { city: 'Austin', state: 'TX' },
      { city: 'Atlanta', state: 'GA' },
      { city: 'Denver', state: 'CO' },
      { city: 'Philadelphia', state: 'PA' }
    ];
    const categories: ('Inpatient' | 'Outpatient' | 'ER')[] = ['Inpatient', 'Outpatient', 'ER'];
    const durations = [15, 30, 45, 60];
    const appointmentStatuses: ('Scheduled' | 'Completed' | 'Cancelled' | 'Rescheduled')[] = ['Completed', 'Completed', 'Scheduled', 'Rescheduled', 'Completed'];

    for (let i = 0; i < countsToGenerate; i++) {
      const rand = Math.random();

      // 1. Generate patient
      const pId = `PT${String(this.patients.length + 1).padStart(6, '0')}`;
      const isMale = Math.random() > 0.5;
      const firstName = isMale ? firstNamesMale[Math.floor(Math.random() * firstNamesMale.length)] : firstNamesFemale[Math.floor(Math.random() * firstNamesFemale.length)];
      const lastName = lastNamesList[Math.floor(Math.random() * lastNamesList.length)];
      const loc = citiesAndStates[Math.floor(Math.random() * citiesAndStates.length)];
      
      const newPatient: Patient = {
        id: pId,
        name: `${firstName} ${lastName}`,
        age: 18 + Math.floor(Math.random() * 70),
        gender: isMale ? 'Male' : 'Female',
        bloodGroup: bloodTypes[Math.floor(Math.random() * bloodTypes.length)],
        city: loc.city,
        state: loc.state,
        registrationDate: new Date().toISOString(),
        insuranceProvider: insuranceOptions[Math.floor(Math.random() * insuranceOptions.length)],
        category: categories[Math.floor(Math.random() * categories.length)]
      };
      this.patients.push(newPatient);
      this.patientIndex.set(pId, newPatient);

      // 2. Generate appointment
      const apId = `AP${String(this.appointments.length + 1).padStart(6, '0')}`;
      const doctor = this.doctors[Math.floor(Math.random() * this.doctors.length)];
      const status = appointmentStatuses[Math.floor(Math.random() * appointmentStatuses.length)];
      
      const newAppointment: Appointment = {
        id: apId,
        patientId: pId,
        doctorId: doctor.id,
        department: doctor.department,
        appointmentDate: new Date().toISOString(),
        duration: durations[Math.floor(Math.random() * durations.length)],
        status: status,
        revenueGenerated: status === 'Cancelled' ? 0 : doctor.consultationFee
      };
      this.appointments.push(newAppointment);

      // 3. Generate transaction
      const txId = `TX${String(this.transactions.length + 1).padStart(6, '0')}`;
      let amount = doctor.consultationFee;
      let type: 'Consultation' | 'Lab Fee' | 'Pharmacy' | 'Emergency Services' = 'Consultation';

      if (Math.random() > 0.5) {
        const typeRand = Math.random();
        if (typeRand < 0.45) {
          type = 'Pharmacy';
          amount = Math.round(15 + Math.random() * 200);
        } else if (typeRand < 0.85) {
          type = 'Lab Fee';
          amount = Math.round(50 + Math.random() * 300);
        } else {
          type = 'Emergency Services';
          amount = Math.round(500 + Math.random() * 1500);
        }
      }

      const isSelfPay = newPatient.insuranceProvider === 'Self-Pay';
      const insuranceCoverage = isSelfPay ? 0 : Math.round(amount * (0.65 + Math.random() * 0.25));
      const paymentType = isSelfPay ? 'Cash' : 'Insurance';

      const newTransaction: BillingTransaction = {
        id: txId,
        patientId: pId,
        appointmentId: type === 'Consultation' ? apId : null,
        date: new Date().toISOString(),
        amount,
        type,
        insuranceCoverage,
        paymentType,
        department: doctor.department
      };
      this.transactions.push(newTransaction);
    }

    // Push to record growth history if day/month changes
    const currentMonth = new Date().toISOString().substring(0, 7);
    const existing = this.recordGrowthHistory.find(h => h.timestamp === currentMonth);
    if (existing) {
      existing.patientsCount = this.patients.length;
      existing.appointmentsCount = this.appointments.length;
      existing.transactionsCount = this.transactions.length;
    } else {
      this.recordGrowthHistory.push({
        timestamp: currentMonth,
        patientsCount: this.patients.length,
        appointmentsCount: this.appointments.length,
        transactionsCount: this.transactions.length
      });
      if (this.recordGrowthHistory.length > 12) {
        this.recordGrowthHistory.shift();
      }
    }

    this.lastGeneratedTime = new Date().toISOString();
    this.save();
  }

  // Compute Medallion Pipeline Stats dynamically (Simulating databricks batching!)
  public getPipelineMetrics(): PipelineMetrics {
    // 1. Bronze Count (raw input counts)
    const pCount = this.patients.length;
    const aCount = this.appointments.length;
    const dCount = this.doctors.length;
    const depCount = this.departments.length;
    const tCount = this.transactions.length;

    // 2. Silver: Validate schemas (Clean rows)
    const silverRecordsProcessed = pCount + aCount + dCount + depCount + tCount;
    const silverCleanPercentage = 99.85; // Simulated 0.15% schema deviations standard in Bronze

    // 3. Gold Aggregations (Durable multi-dimensional models)
    // Dynamic Insurance Share
    const insuranceRevenueMap: { [key: string]: { count: number; total: number } } = {};
    for (const tx of this.transactions) {
      const pt = this.patientIndex.get(tx.patientId);
      const provider = pt?.insuranceProvider || 'Self-Pay';
      
      if (!insuranceRevenueMap[provider]) {
        insuranceRevenueMap[provider] = { count: 0, total: 0 };
      }
      insuranceRevenueMap[provider].count++;
      insuranceRevenueMap[provider].total += tx.amount;
    }
    const insuranceUtilization = Object.entries(insuranceRevenueMap).map(([provider, data]) => ({
      provider,
      count: data.count,
      totalRevenue: Math.round(data.total)
    }));

    // Dynamic Department profitability
    const deptProfitMap: { [key: string]: { revenue: number; cost: number } } = {};
    for (const dep of this.departments) {
      deptProfitMap[dep.name] = { revenue: 0, cost: 25000 + dep.bedsOccupied * 450 + dep.avgWaitTime * 150 }; // Simulated operational costs
    }
    for (const tx of this.transactions) {
      const dept = tx.department;
      if (deptProfitMap[dept]) {
        deptProfitMap[dept].revenue += tx.amount;
      } else {
        deptProfitMap[dept] = { revenue: tx.amount, cost: 15000 };
      }
    }
    const departmentProfitability = Object.entries(deptProfitMap).map(([department, data]) => ({
      department,
      revenue: Math.round(data.revenue),
      cost: Math.round(data.cost),
      profit: Math.round(data.revenue - data.cost)
    }));

    // Monthly revenue trend (Past 12 months)
    const monthMap: { [key: string]: { consultation: number; lab: number; pharmacy: number; emergency: number; total: number } } = {};
    for (const tx of this.transactions) {
      const month = tx.date.substring(0, 7); // YYYY-MM
      if (!monthMap[month]) {
        monthMap[month] = { consultation: 0, lab: 0, pharmacy: 0, emergency: 0, total: 0 };
      }
      if (tx.type === 'Consultation') monthMap[month].consultation += tx.amount;
      else if (tx.type === 'Lab Fee') monthMap[month].lab += tx.amount;
      else if (tx.type === 'Pharmacy') monthMap[month].pharmacy += tx.amount;
      else if (tx.type === 'Emergency Services') monthMap[month].emergency += tx.amount;
      monthMap[month].total += tx.amount;
    }
    // Sort keys and take last 12
    const sortedMonths = Object.keys(monthMap).sort();
    const monthlyRevenueTrend = sortedMonths.map(month => ({
      month,
      consultation: Math.round(monthMap[month].consultation),
      lab: Math.round(monthMap[month].lab),
      pharmacy: Math.round(monthMap[month].pharmacy),
      emergency: Math.round(monthMap[month].emergency),
      total: Math.round(monthMap[month].total)
    })).slice(-12);

    // Doctor Performance (Util and Appointments count)
    const docPerformances = this.doctors.map(doc => {
      const docApps = this.appointments.filter(ap => ap.doctorId === doc.id);
      const appCount = docApps.length;
      const totalRev = docApps
        .filter(ap => ap.status === 'Completed')
        .reduce((sum, ap) => sum + ap.revenueGenerated, 0);

      return {
        doctorName: doc.name,
        department: doc.department,
        appointments: appCount,
        revenue: totalRev,
        utilization: doc.utilization
      };
    });

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
        doctorPerformance: docPerformances.sort((a, b) => b.revenue - a.revenue)
      }
    };
  }

  // Reset database to initial seed
  public resetDatabase() {
    this.seed();
  }
}

export const db = new HealthcareDatabase();
