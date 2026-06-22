/**
 * Databricks REST API Client
 * 
 * Communicates with a Databricks workspace via the REST API using fetch().
 * Supports SQL Statement Execution, warehouse status, job listing, and Unity Catalog operations.
 */

interface DatabricksConfig {
  host: string;
  token: string;
  warehouseId: string;
  catalog: string;
  schema: string;
}

interface SqlQueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  status: string;
  executionTimeMs?: number;
}

interface WarehouseStatus {
  id: string;
  name: string;
  state: string;
  numClusters: number;
  numActiveQueries: number;
  health: 'HEALTHY' | 'DEGRADED' | 'FAILED' | 'UNKNOWN';
}

interface DatabricksJob {
  jobId: number;
  name: string;
  createdTime: number;
  creatorUserName: string;
}

interface DatabricksJobRun {
  runId: number;
  jobId: number;
  state: { lifeCycleState: string; resultState?: string; stateMessage?: string };
  startTime: number;
  endTime?: number;
  executionDuration?: number;
}

class DatabricksClient {
  private config: DatabricksConfig;
  private baseUrl: string;

  constructor() {
    // Clean the host URL - remove query params and trailing slashes
    let host = process.env.DATABRICKS_HOST || '';
    // Extract just the base URL (protocol + hostname)
    try {
      const url = new URL(host);
      host = `${url.protocol}//${url.hostname}`;
    } catch {
      // If URL parsing fails, use as-is but strip trailing slash
      host = host.replace(/\/+$/, '');
    }

    this.config = {
      host,
      token: process.env.DATABRICKS_TOKEN || '',
      warehouseId: process.env.DATABRICKS_WAREHOUSE_ID || '',
      catalog: process.env.DATABRICKS_CATALOG || 'pulsestream_healthcare',
      schema: process.env.DATABRICKS_SCHEMA || 'default',
    };

    this.baseUrl = this.config.host;
    console.log(`[Databricks] Client initialized for workspace: ${this.baseUrl}`);
  }

  /**
   * Check if Databricks is configured
   */
  public isConfigured(): boolean {
    return !!(this.config.host && this.config.token && this.config.warehouseId);
  }

  /**
   * Make authenticated request to Databricks REST API
   */
  private async request(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.token}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Databricks API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (err: any) {
      if (err.message?.includes('Databricks API error')) throw err;
      throw new Error(`Databricks connection failed: ${err.message}`);
    }
  }

  /**
   * Test connection to Databricks workspace
   */
  public async testConnection(): Promise<{ connected: boolean; message: string; warehouseState?: string }> {
    if (!this.isConfigured()) {
      return { connected: false, message: 'Databricks not configured. Set DATABRICKS_HOST, DATABRICKS_TOKEN, and DATABRICKS_WAREHOUSE_ID.' };
    }

    try {
      const status = await this.getWarehouseStatus();
      return {
        connected: true,
        message: `Connected to warehouse "${status.name}" (${status.state})`,
        warehouseState: status.state
      };
    } catch (err: any) {
      return { connected: false, message: `Connection failed: ${err.message}` };
    }
  }

  /**
   * Execute SQL query against the SQL Warehouse via Statement Execution API
   * POST /api/2.0/sql/statements
   */
  public async executeQuery(sql: string, maxRows: number = 1000): Promise<SqlQueryResult> {
    const startTime = Date.now();

    const payload = {
      warehouse_id: this.config.warehouseId,
      statement: sql,
      wait_timeout: '30s',
      on_wait_timeout: 'CANCEL',
      catalog: this.config.catalog,
      schema: this.config.schema,
    };

    const result = await this.request('POST', '/api/2.0/sql/statements', payload);

    const executionTimeMs = Date.now() - startTime;

    // Parse response
    const status = result.status?.state || 'UNKNOWN';

    if (status === 'FAILED') {
      throw new Error(`Query failed: ${result.status?.error?.message || 'Unknown error'}`);
    }

    // Extract columns
    const columns = (result.manifest?.schema?.columns || []).map((col: any) => col.name);

    // Extract rows
    const rows = result.result?.data_array || [];

    return {
      columns,
      rows: rows.slice(0, maxRows),
      rowCount: rows.length,
      status,
      executionTimeMs
    };
  }

  /**
   * Get SQL Warehouse status
   * GET /api/2.0/sql/warehouses/{id}
   */
  public async getWarehouseStatus(): Promise<WarehouseStatus> {
    const result = await this.request('GET', `/api/2.0/sql/warehouses/${this.config.warehouseId}`);

    return {
      id: result.id,
      name: result.name || 'Unknown',
      state: result.state || 'UNKNOWN',
      numClusters: result.num_clusters || 0,
      numActiveQueries: result.num_active_sessions || 0,
      health: result.health?.status || 'UNKNOWN',
    };
  }

  /**
   * List jobs in the workspace
   * GET /api/2.1/jobs/list
   */
  public async listJobs(limit: number = 25): Promise<DatabricksJob[]> {
    try {
      const result = await this.request('GET', `/api/2.1/jobs/list?limit=${limit}`);
      return (result.jobs || []).map((job: any) => ({
        jobId: job.job_id,
        name: job.settings?.name || 'Unnamed Job',
        createdTime: job.created_time,
        creatorUserName: job.creator_user_name || 'Unknown',
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get job run history
   * GET /api/2.1/jobs/runs/list
   */
  public async getJobRuns(jobId: number, limit: number = 10): Promise<DatabricksJobRun[]> {
    try {
      const result = await this.request('GET', `/api/2.1/jobs/runs/list?job_id=${jobId}&limit=${limit}`);
      return (result.runs || []).map((run: any) => ({
        runId: run.run_id,
        jobId: run.job_id,
        state: {
          lifeCycleState: run.state?.life_cycle_state || 'UNKNOWN',
          resultState: run.state?.result_state,
          stateMessage: run.state?.state_message,
        },
        startTime: run.start_time,
        endTime: run.end_time,
        executionDuration: run.execution_duration,
      }));
    } catch {
      return [];
    }
  }

  /**
   * List tables in a catalog/schema via Unity Catalog
   * GET /api/2.1/unity-catalog/tables
   */
  public async listTables(catalog?: string, schema?: string): Promise<any[]> {
    const cat = catalog || this.config.catalog;
    const sch = schema || this.config.schema;

    try {
      const result = await this.request('GET', `/api/2.1/unity-catalog/tables?catalog_name=${cat}&schema_name=${sch}`);
      return (result.tables || []).map((table: any) => ({
        name: table.name,
        fullName: table.full_name,
        tableType: table.table_type,
        dataSourceFormat: table.data_source_format,
        columns: (table.columns || []).map((col: any) => ({
          name: col.name,
          type: col.type_name,
        })),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get connection info for display
   */
  public getConnectionInfo() {
    return {
      host: this.config.host,
      warehouseId: this.config.warehouseId,
      catalog: this.config.catalog,
      schema: this.config.schema,
      configured: this.isConfigured(),
    };
  }
}

// Singleton instance
export const databricksClient = new DatabricksClient();
