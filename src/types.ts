/**
 * Healthcare Analytics Simulation Platform Types
 */

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  city: string;
  state: string;
  registrationDate: string; // ISO date
  insuranceProvider: 'HealthShield' | 'AuraCare' | 'MedLife' | 'ApexPay' | 'Self-Pay';
  category: 'Inpatient' | 'Outpatient' | 'ER';
}

export interface Doctor {
  id: string;
  name: string;
  department: string;
  experience: number; // in years
  consultationFee: number;
  utilization: number; // percentage, e.g., 78
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  department: string;
  appointmentDate: string; // ISO date-time
  duration: number; // duration in minutes (e.g., 15, 30, 45, 60)
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'Rescheduled';
  revenueGenerated: number;
}

export interface BillingTransaction {
  id: string;
  patientId: string;
  appointmentId: string | null;
  date: string; // ISO date
  amount: number;
  type: 'Consultation' | 'Lab Fee' | 'Pharmacy' | 'Emergency Services';
  insuranceCoverage: number; // amount insurance covers
  paymentType: 'Insurance' | 'Cash' | 'Credit Card' | 'Debit Card';
  department: string;
}

export interface Department {
  id: string;
  name: string;
  bedsTotal: number;
  bedsOccupied: number;
  kpiSatisfaction: number; // 0 - 5 stars
  avgWaitTime: number; // in minutes
}

export type UserRole = 'Admin' | 'Doctor' | 'Analyst' | 'Finance';

export interface User {
  username: string;
  name: string;
  role: UserRole;
  avatar: string;
}

// Medallion Pipeline Stats
export interface PipelineMetrics {
  bronzeCount: {
    patients: number;
    appointments: number;
    doctors: number;
    departments: number;
    transactions: number;
    total: number;
  };
  silverCleanPercentage: number;
  silverRecordsProcessed: number;
  goldAggregations: {
    insuranceUtilization: { provider: string; count: number; totalRevenue: number }[];
    departmentProfitability: { department: string; cost: number; revenue: number; profit: number }[];
    monthlyRevenueTrend: { month: string; consultation: number; lab: number; pharmacy: number; emergency: number; total: number }[];
    doctorPerformance: { doctorName: string; department: string; appointments: number; revenue: number; utilization: number }[];
  };
}

export interface AuthState {
  user: User | null;
  token: string | null;
}
