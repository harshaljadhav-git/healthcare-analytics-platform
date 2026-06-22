/**
 * Databricks Data Sync Service
 * 
 * Pushes data from PostgreSQL to Databricks Delta Lake tables.
 * Implements Bronze/Silver/Gold materialization using SQL Statement Execution API.
 */

import { databricksClient } from './databricks';
import { query } from './postgres';

interface SyncResult {
  success: boolean;
  table: string;
  rowsSynced: number;
  durationMs: number;
  error?: string;
}

interface SyncStatus {
  lastSyncTime: string | null;
  syncs: SyncResult[];
  overallStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'NEVER';
}

class DatabricksSyncService {
  private lastSyncTime: string | null = null;
  private lastSyncResults: SyncResult[] = [];

  /**
   * Get current sync status
   */
  public getStatus(): SyncStatus {
    const overallStatus = this.lastSyncTime === null
      ? 'NEVER'
      : this.lastSyncResults.every(r => r.success)
        ? 'SUCCESS'
        : this.lastSyncResults.some(r => r.success)
          ? 'PARTIAL'
          : 'FAILED';

    return {
      lastSyncTime: this.lastSyncTime,
      syncs: this.lastSyncResults,
      overallStatus
    };
  }

  /**
   * Create Bronze Delta tables in Databricks if they don't exist
   */
  public async ensureBronzeTables(): Promise<void> {
    if (!databricksClient.isConfigured()) {
      throw new Error('Databricks is not configured');
    }

    const tables = [
      {
        name: 'bronze_patients',
        schema: `id STRING, name STRING, age INT, gender STRING, blood_group STRING, 
                 city STRING, state STRING, registration_date TIMESTAMP, 
                 insurance_provider STRING, category STRING`
      },
      {
        name: 'bronze_appointments',
        schema: `id STRING, patient_id STRING, doctor_id STRING, department STRING, 
                 appointment_date TIMESTAMP, duration INT, status STRING, revenue_generated DOUBLE`
      },
      {
        name: 'bronze_doctors',
        schema: `id STRING, name STRING, department STRING, experience INT, 
                 consultation_fee DOUBLE, utilization INT`
      },
      {
        name: 'bronze_departments',
        schema: `id STRING, name STRING, beds_total INT, beds_occupied INT, 
                 kpi_satisfaction DOUBLE, avg_wait_time INT`
      },
      {
        name: 'bronze_transactions',
        schema: `id STRING, patient_id STRING, appointment_id STRING, date TIMESTAMP, 
                 amount DOUBLE, type STRING, insurance_coverage DOUBLE, payment_type STRING, department STRING`
      }
    ];

    for (const table of tables) {
      try {
        await databricksClient.executeQuery(
          `CREATE TABLE IF NOT EXISTS ${table.name} (${table.schema}) USING DELTA`
        );
        console.log(`[Databricks Sync] Ensured table ${table.name} exists.`);
      } catch (err: any) {
        console.error(`[Databricks Sync] Error creating table ${table.name}:`, err.message);
      }
    }
  }

  /**
   * Sync a single table from PostgreSQL to Databricks Bronze
   */
  private async syncTable(tableName: string, pgQuery: string, insertColumns: string): Promise<SyncResult> {
    const startTime = Date.now();
    const bronzeTable = `bronze_${tableName}`;

    try {
      // Fetch data from PostgreSQL
      const result = await query(pgQuery);
      const rows = result.rows;

      if (rows.length === 0) {
        return { success: true, table: bronzeTable, rowsSynced: 0, durationMs: Date.now() - startTime };
      }

      // Build INSERT VALUES using batch SQL statements
      // Process in chunks of 500 rows to avoid SQL statement size limits
      let totalSynced = 0;

      for (let chunk = 0; chunk < rows.length; chunk += 500) {
        const batch = rows.slice(chunk, chunk + 500);

        const valueStrings = batch.map(row => {
          const vals = Object.values(row).map(val => {
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return val.toString();
            if (val instanceof Date) return `'${val.toISOString()}'`;
            // Escape single quotes
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          return `(${vals.join(', ')})`;
        });

        const insertSql = `INSERT INTO ${bronzeTable} (${insertColumns}) VALUES ${valueStrings.join(', ')}`;

        try {
          await databricksClient.executeQuery(insertSql);
          totalSynced += batch.length;
        } catch (err: any) {
          console.error(`[Databricks Sync] Batch insert error for ${bronzeTable}:`, err.message);
        }
      }

      return {
        success: true,
        table: bronzeTable,
        rowsSynced: totalSynced,
        durationMs: Date.now() - startTime
      };
    } catch (err: any) {
      return {
        success: false,
        table: bronzeTable,
        rowsSynced: 0,
        durationMs: Date.now() - startTime,
        error: err.message
      };
    }
  }

  /**
   * Full sync: push all tables from PostgreSQL → Databricks Bronze
   */
  public async fullSync(): Promise<SyncStatus> {
    console.log('[Databricks Sync] Starting full sync to Databricks...');

    if (!databricksClient.isConfigured()) {
      const result: SyncStatus = {
        lastSyncTime: null,
        syncs: [{ success: false, table: 'all', rowsSynced: 0, durationMs: 0, error: 'Databricks not configured' }],
        overallStatus: 'FAILED'
      };
      return result;
    }

    // Ensure Bronze tables exist
    try {
      await this.ensureBronzeTables();
    } catch (err: any) {
      console.error('[Databricks Sync] Failed to ensure Bronze tables:', err.message);
    }

    // Clear existing data and re-sync (TRUNCATE + INSERT)
    const tables = ['bronze_patients', 'bronze_appointments', 'bronze_doctors', 'bronze_departments', 'bronze_transactions'];
    for (const table of tables) {
      try {
        await databricksClient.executeQuery(`TRUNCATE TABLE ${table}`);
      } catch {
        // Table may not exist yet
      }
    }

    // Sync each table
    const results = await Promise.all([
      this.syncTable('patients',
        'SELECT id, name, age, gender, blood_group, city, state, registration_date, insurance_provider, category FROM pulsestream.patients',
        'id, name, age, gender, blood_group, city, state, registration_date, insurance_provider, category'),

      this.syncTable('appointments',
        'SELECT id, patient_id, doctor_id, department, appointment_date, duration, status, revenue_generated FROM pulsestream.appointments',
        'id, patient_id, doctor_id, department, appointment_date, duration, status, revenue_generated'),

      this.syncTable('doctors',
        'SELECT id, name, department, experience, consultation_fee, utilization FROM pulsestream.doctors',
        'id, name, department, experience, consultation_fee, utilization'),

      this.syncTable('departments',
        'SELECT id, name, beds_total, beds_occupied, kpi_satisfaction, avg_wait_time FROM pulsestream.departments',
        'id, name, beds_total, beds_occupied, kpi_satisfaction, avg_wait_time'),

      this.syncTable('transactions',
        'SELECT id, patient_id, appointment_id, date, amount, type, insurance_coverage, payment_type, department FROM pulsestream.transactions',
        'id, patient_id, appointment_id, date, amount, type, insurance_coverage, payment_type, department'),
    ]);

    this.lastSyncTime = new Date().toISOString();
    this.lastSyncResults = results;

    const status = this.getStatus();
    console.log(`[Databricks Sync] Sync completed: ${status.overallStatus}. Total rows: ${results.reduce((sum, r) => sum + r.rowsSynced, 0)}`);

    return status;
  }

  /**
   * Create Silver views (cleaned/validated data)
   */
  public async materializeSilver(): Promise<void> {
    if (!databricksClient.isConfigured()) return;

    try {
      await databricksClient.executeQuery(`
        CREATE OR REPLACE VIEW silver_patients AS
        SELECT *, current_timestamp() AS _silver_processed_at
        FROM bronze_patients
        WHERE id IS NOT NULL AND name IS NOT NULL AND age > 0 AND age < 120
      `);

      await databricksClient.executeQuery(`
        CREATE OR REPLACE VIEW silver_transactions AS
        SELECT *, current_timestamp() AS _silver_processed_at
        FROM bronze_transactions
        WHERE id IS NOT NULL AND amount > 0
      `);

      console.log('[Databricks Sync] Silver views materialized.');
    } catch (err: any) {
      console.error('[Databricks Sync] Silver materialization error:', err.message);
    }
  }

  /**
   * Create Gold aggregate tables (business intelligence)
   */
  public async materializeGold(): Promise<void> {
    if (!databricksClient.isConfigured()) return;

    try {
      await databricksClient.executeQuery(`
        CREATE OR REPLACE VIEW gold_dept_profitability AS
        SELECT department, SUM(amount) AS total_revenue, COUNT(*) AS transaction_count
        FROM bronze_transactions
        GROUP BY department
        ORDER BY total_revenue DESC
      `);

      await databricksClient.executeQuery(`
        CREATE OR REPLACE VIEW gold_monthly_revenue AS
        SELECT DATE_FORMAT(date, 'yyyy-MM') AS month, type, SUM(amount) AS total
        FROM bronze_transactions
        GROUP BY month, type
        ORDER BY month DESC
      `);

      await databricksClient.executeQuery(`
        CREATE OR REPLACE VIEW gold_insurance_utilization AS
        SELECT p.insurance_provider, COUNT(*) AS count, SUM(t.amount) AS total_revenue
        FROM bronze_transactions t
        JOIN bronze_patients p ON t.patient_id = p.id
        GROUP BY p.insurance_provider
      `);

      console.log('[Databricks Sync] Gold views materialized.');
    } catch (err: any) {
      console.error('[Databricks Sync] Gold materialization error:', err.message);
    }
  }
}

export const databricksSyncService = new DatabricksSyncService();
