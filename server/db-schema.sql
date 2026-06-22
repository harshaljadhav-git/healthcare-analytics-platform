-- ==========================================================
-- PulseStream Healthcare Analytics - PostgreSQL Schema
-- Target: Amazon RDS PostgreSQL 15+
-- ==========================================================

-- Create schema
CREATE SCHEMA IF NOT EXISTS pulsestream;

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS pulsestream.departments (
  id          VARCHAR(10) PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  beds_total  INTEGER NOT NULL DEFAULT 0,
  beds_occupied INTEGER NOT NULL DEFAULT 0,
  kpi_satisfaction NUMERIC(2,1) NOT NULL DEFAULT 0.0,
  avg_wait_time INTEGER NOT NULL DEFAULT 0
);

-- 2. Doctors Table
CREATE TABLE IF NOT EXISTS pulsestream.doctors (
  id               VARCHAR(10) PRIMARY KEY,
  name             VARCHAR(150) NOT NULL,
  department       VARCHAR(100) NOT NULL,
  experience       INTEGER NOT NULL DEFAULT 0,
  consultation_fee INTEGER NOT NULL DEFAULT 0,
  utilization      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_doctors_department ON pulsestream.doctors(department);

-- 3. Patients Table
CREATE TABLE IF NOT EXISTS pulsestream.patients (
  id                 VARCHAR(10) PRIMARY KEY,
  name               VARCHAR(200) NOT NULL,
  age                INTEGER NOT NULL,
  gender             VARCHAR(10) NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
  blood_group        VARCHAR(5) NOT NULL,
  city               VARCHAR(100) NOT NULL,
  state              VARCHAR(5) NOT NULL,
  registration_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  insurance_provider VARCHAR(30) NOT NULL,
  category           VARCHAR(15) NOT NULL CHECK (category IN ('Inpatient', 'Outpatient', 'ER'))
);

CREATE INDEX IF NOT EXISTS idx_patients_state ON pulsestream.patients(state);
CREATE INDEX IF NOT EXISTS idx_patients_category ON pulsestream.patients(category);
CREATE INDEX IF NOT EXISTS idx_patients_insurance ON pulsestream.patients(insurance_provider);

-- 4. Appointments Table
CREATE TABLE IF NOT EXISTS pulsestream.appointments (
  id                VARCHAR(10) PRIMARY KEY,
  patient_id        VARCHAR(10) NOT NULL REFERENCES pulsestream.patients(id),
  doctor_id         VARCHAR(10) NOT NULL REFERENCES pulsestream.doctors(id),
  department        VARCHAR(100) NOT NULL,
  appointment_date  TIMESTAMPTZ NOT NULL,
  duration          INTEGER NOT NULL DEFAULT 30,
  status            VARCHAR(15) NOT NULL CHECK (status IN ('Scheduled', 'Completed', 'Cancelled', 'Rescheduled')),
  revenue_generated NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON pulsestream.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON pulsestream.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON pulsestream.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_department ON pulsestream.appointments(department);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON pulsestream.appointments(appointment_date);

-- 5. Transactions Table
CREATE TABLE IF NOT EXISTS pulsestream.transactions (
  id                 VARCHAR(10) PRIMARY KEY,
  patient_id         VARCHAR(10) NOT NULL REFERENCES pulsestream.patients(id),
  appointment_id     VARCHAR(10) REFERENCES pulsestream.appointments(id),
  date               TIMESTAMPTZ NOT NULL,
  amount             NUMERIC(10,2) NOT NULL DEFAULT 0,
  type               VARCHAR(25) NOT NULL CHECK (type IN ('Consultation', 'Lab Fee', 'Pharmacy', 'Emergency Services')),
  insurance_coverage NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_type       VARCHAR(15) NOT NULL,
  department         VARCHAR(100) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_patient ON pulsestream.transactions(patient_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON pulsestream.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_payment ON pulsestream.transactions(payment_type);
CREATE INDEX IF NOT EXISTS idx_transactions_department ON pulsestream.transactions(department);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON pulsestream.transactions(date);

-- 6. Simulation Config (single-row table)
CREATE TABLE IF NOT EXISTS pulsestream.simulation_config (
  id                     INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  simulation_speed       VARCHAR(10) NOT NULL DEFAULT 'Fast',
  last_generated_time    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  record_growth_history  JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Seed default config row if not exists
INSERT INTO pulsestream.simulation_config (id, simulation_speed, last_generated_time, record_growth_history)
VALUES (1, 'Fast', NOW(), '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;
