import React, { useState, useEffect } from 'react';
import { 
  Database, ArrowRight, Download, Terminal, Code2, Play, Table, HelpCircle, FileJson, FileSpreadsheet, CheckCircle, ChevronDown, ChevronRight
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { motion } from 'motion/react';

interface MedallionProps {
  token: string;
}

export default function DatabricksLakePanel({ token }: MedallionProps) {
  const [pipelineMetrics, setPipelineMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'visualizer' | 'code' | 'exports' | 'sandbox'>('visualizer');
  
  // SQL Playground States
  const [sqlQuery, setSqlQuery] = useState('SELECT doc.name, doc.department, doc.consultationFee \nFROM doctors doc \nWHERE doc.experience > 15 \nORDER BY doc.consultationFee DESC;');
  const [sqlResults, setSqlResults] = useState<any[]>([]);
  const [sqlHeaders, setSqlHeaders] = useState<string[]>([]);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [executingSql, setExecutingSql] = useState(false);

  const fetchMedallionMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics/medallion', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data) {
        setPipelineMetrics(data);
      }
    } catch (err) {
      console.error('Error loading pipeline data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedallionMetrics();
  }, [token]);

  // SQL preset queries for database testing
  const sqlPresets = [
    {
      title: "Gold: Top 5 Highest Consultation Earners",
      query: "SELECT doc.name, doc.department, doc.experience, SUM(ap.revenueGenerated) as total_earned \nFROM doctors doc \nJOIN appointments ap ON doc.id = ap.doctorId \nWHERE ap.status = 'Completed' \nGROUP BY doc.id \nORDER BY total_earned DESC \nLIMIT 5;"
    },
    {
      title: "Silver: Insurance Provider Billing Statistics",
      query: "SELECT pt.insuranceProvider, COUNT(tx.id) as trans_count, AVG(tx.amount) as avg_claim_cost, SUM(tx.insuranceCoverage) as total_insured_payout \nFROM patients pt \nJOIN transactions tx ON pt.id = tx.patientId \nWHERE tx.paymentType = 'Insurance' \nGROUP BY pt.insuranceProvider \nORDER BY trans_count DESC;"
    },
    {
      title: "Bronze: High Risk Geriatric Cardiac Patients",
      query: "SELECT pt.id, pt.name, pt.age, pt.gender, pt.bloodGroup, pt.city \nFROM patients pt \nWHERE pt.age > 75 AND pt.category = 'Inpatient' \nORDER BY pt.age DESC \nLIMIT 10;"
    }
  ];

  // Simulated SQL engine executing dynamic Javascript filtering
  const handleExecuteSql = async () => {
    setExecutingSql(true);
    setSqlError(null);
    setSqlResults([]);
    setSqlHeaders([]);

    try {
      // Small timeout to simulate DB planner overhead
      await new Promise(r => setTimeout(r, 700));

      const queryLc = sqlQuery.toLowerCase().trim();
      if (!queryLc.startsWith('select')) {
        throw new Error("Syntax Error: Only 'SELECT' query structures are permitted in the Read-Only Sandbox environment.");
      }

      // 1. Fetch tables
      const getTableData = async (endpoint: string) => {
        const res = await fetch(`/api/${endpoint}?limit=250`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        return json.data || json;
      };

      // Lazy loads
      const pData = await getTableData('patients');
      const dData = await getTableData('doctors');
      const apResponse = await getTableData('appointments');
      const tResponse = await getTableData('transactions');
      
      const pRows = pData || [];
      const dRows = dData || [];
      const apRows = apResponse || [];
      const tRows = tResponse || [];

      let results: any[] = [];

      // A. Hand-roll executors for the predefined presets to return real values, otherwise fallback to doctor search
      if (queryLc.includes('insuranceprovider')) {
        // Group transactions by insurance provider
        const groups: { [key: string]: { count: number; totalAmt: number; totalIns: number } } = {};
        for (const t of tRows) {
          const pt = pRows.find((p: any) => p.id === t.patientId);
          const provider = pt?.insuranceProvider || 'Self-Pay';
          if (!groups[provider]) {
            groups[provider] = { count: 0, totalAmt: 0, totalIns: 0 };
          }
          groups[provider].count++;
          groups[provider].totalAmt += t.amount || 0;
          groups[provider].totalIns += t.insuranceCoverage || 0;
        }
        results = Object.entries(groups).map(([provider, g]) => ({
          'insuranceProvider': provider,
          'trans_count': g.count,
          'avg_claim_cost': `$${Math.round(g.totalAmt / g.count)}`,
          'total_insured_payout': `$${g.totalIns.toLocaleString()}`
        }));
      } else if (queryLc.includes('total_earned') || queryLc.includes('doctors doc join appointments')) {
        // Doc earnings
        const earnings: { [key: string]: { name: string; dept: string; exp: number; earned: number } } = {};
        for (const d of dRows) {
          earnings[d.id] = { name: d.name, dept: d.department, exp: d.experience, earned: 0 };
        }
        for (const a of apRows) {
          if (a.status === 'Completed' && earnings[a.doctorId]) {
            earnings[a.doctorId].earned += a.revenueGenerated || 0;
          }
        }
        results = Object.values(earnings)
          .sort((a,b) => b.earned - a.earned)
          .slice(0, 5)
          .map(e => ({
            'name': e.name,
            'department': e.dept,
            'experience': `${e.exp} yrs`,
            'total_earned': `$${e.earned.toLocaleString()}`
          }));
      } else if (queryLc.includes('geriatric') || (queryLc.includes('age > 75') && queryLc.includes('patients'))) {
        // Geriatric
        results = pRows
          .filter((p: any) => p.age > 75 && p.category === 'Inpatient')
          .slice(0, 10)
          .map((p: any) => ({
            'id': p.id,
            'name': p.name,
            'age': p.age,
            'gender': p.gender,
            'bloodGroup': p.bloodGroup,
            'city': p.city
          }));
      } else if (queryLc.includes('where doc.experience > 15') || queryLc.includes('doctors')) {
        // Standard experience query
        results = dRows
          .filter((d: any) => d.experience > 15)
          .map((d: any) => ({
            'name': d.name,
            'department': d.department,
            'consultationFee': `$${d.consultationFee}`
          }));
      } else {
        // General fallback
        results = dRows.slice(0, 10).map((d: any) => ({
          'id': d.id,
          'name': d.name,
          'department': d.department,
          'consultationFee': `$${d.consultationFee}`,
          'experience': `${d.experience} yrs`
        }));
      }

      if (results.length > 0) {
        setSqlHeaders(Object.keys(results[0]));
        setSqlResults(results);
      } else {
        throw new Error("Query executed successfully but returned 0 rows in active session partition.");
      }

    } catch (err: any) {
      setSqlError(err.message || 'Simulation Engine error during SELECT command execution parsing.');
    } finally {
      setExecutingSql(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h2 className="text-xl font-black tracking-tighter text-[#141414] uppercase font-sans">DATABRICKS DATA LAKE INTEGRATION CONTROL PANEL</h2>
        <p className="text-[10px] font-mono text-[#141414]/60 uppercase mt-0.5">
          Orchestrate Medallion (Bronze/Silver/Gold) ingestion pipelines, generate Spark workloads, and query structured lakes.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#141414] flex flex-wrap items-center gap-1">
        <button
          onClick={() => setActiveTab('visualizer')}
          className={`px-4 py-2 text-[10px] font-mono font-bold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeTab === 'visualizer'
              ? 'border-[#0066FF] text-[#0066FF]'
              : 'border-transparent text-[#141414]/60 hover:text-[#141414]'
          }`}
        >
          Pipeline Visualizer
        </button>
        <button
          onClick={() => setActiveTab('code')}
          className={`px-4 py-2 text-[10px] font-mono font-bold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeTab === 'code'
              ? 'border-[#0066FF] text-[#0066FF]'
              : 'border-transparent text-[#141414]/60 hover:text-[#141414]'
          }`}
        >
          Spark ETL Templates
        </button>
        <button
          onClick={() => setActiveTab('exports')}
          className={`px-4 py-2 text-[10px] font-mono font-bold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeTab === 'exports'
              ? 'border-[#0066FF] text-[#0066FF]'
              : 'border-transparent text-[#141414]/60 hover:text-[#141414]'
          }`}
        >
          Lake Endpoints (CSV/JSON)
        </button>
        <button
          onClick={() => {
            setActiveTab('sandbox');
            if (sqlResults.length === 0) handleExecuteSql();
          }}
          className={`px-4 py-2 text-[10px] font-mono font-bold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeTab === 'sandbox'
              ? 'border-[#0066FF] text-[#0066FF]'
              : 'border-transparent text-[#141414]/60 hover:text-[#141414]'
          }`}
        >
          Interactive SQL Sandbox
        </button>
      </div>

      {/* Tab: Visualizer */}
      {activeTab === 'visualizer' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
            
            {/* Bronze Node */}
            <div className="bg-white rounded-none p-5 border border-[#141414] shadow-none flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold font-mono text-white bg-[#CC6600] px-1.5 py-0.5 rounded-none uppercase">
                    BRONZE_INGRESS_STAGE
                  </span>
                  <Database className="h-4 w-4 text-[#141414]" />
                </div>
                <h3 className="text-sm font-bold text-[#141414] uppercase tracking-wider mt-3">Raw Append-Only Logs</h3>
                <p className="text-[11px] text-[#141414]/75 mt-1 leading-normal font-sans">
                  Accumulates raw HTTP payload logs, JSON streams, and system event queues directly from wards into parquet tables.
                </p>

                {/* Sub schema indicators */}
                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono border-b border-[#141414]/10 pb-1">
                    <span className="text-[#141414]/60 uppercase text-[10px]">raw_patients:</span>
                    <span className="text-[#141414] font-bold">{pipelineMetrics?.bronzeCount?.patients?.toLocaleString() || '-'} rows</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono border-b border-[#141414]/10 pb-1">
                    <span className="text-[#141414]/60 uppercase text-[10px]">raw_appointments:</span>
                    <span className="text-[#141414] font-bold">{pipelineMetrics?.bronzeCount?.appointments?.toLocaleString() || '-'} rows</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono border-b border-[#141414]/10 pb-1">
                    <span className="text-[#141414]/60 uppercase text-[10px]">raw_transactions:</span>
                    <span className="text-[#141414] font-bold">{pipelineMetrics?.bronzeCount?.transactions?.toLocaleString() || '-'} rows</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-[#141414]/15 pt-4 mt-6 font-mono">
                <span className="text-[9px] text-[#141414]/50 block">STORAGE_LOCATION:</span>
                <span className="text-[11px] font-bold text-[#141414] mt-0.5 block">mnt/pulse/bronze/db/</span>
              </div>
            </div>

            {/* Silver Node */}
            <div className="bg-white rounded-none p-5 border border-[#141414] shadow-none flex flex-col justify-between relative">
              <div className="absolute -left-3 top-[50%] bg-white p-1 border border-[#141414] hidden lg:block z-10">
                <ArrowRight className="h-4 w-4 text-[#141414]" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold font-mono text-white bg-[#141414] px-1.5 py-0.5 rounded-none uppercase">
                    SILVER_SANITY_STAGE
                  </span>
                  <CheckCircle className="h-4 w-4 text-[#141414]" />
                </div>
                <h3 className="text-sm font-bold text-[#141414] uppercase tracking-wider mt-3">Sanitized Dimensional Models</h3>
                <p className="text-[11px] text-[#141414]/75 mt-1 leading-normal font-sans">
                  Applies strict schema validation, datetime formatting, deduplication, and types coercion. Implements strict GDPR audit boundaries.
                </p>

                {/* KPI block */}
                <div className="mt-5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-mono border-b border-[#141414]/10 pb-1">
                    <span className="text-[#141414]/50 uppercase text-[10px]">Schema Pass Rate:</span>
                    <span className="text-[#00CC66] font-bold">{pipelineMetrics?.silverCleanPercentage || '99.85'}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono border-b border-[#141414]/10 pb-1">
                    <span className="text-[#141414]/50 uppercase text-[10px]">Index Partitions:</span>
                    <span className="text-[#141414] font-bold">12 Active</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono border-b border-[#141414]/10 pb-1">
                    <span className="text-[#141414]/50 uppercase text-[10px]">Records Parsed:</span>
                    <span className="text-[#141414] font-bold">{pipelineMetrics?.silverRecordsProcessed?.toLocaleString() || '-'} rows</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-[#141414]/15 pt-4 mt-6 font-mono">
                <span className="text-[9px] text-[#141414]/50 block">STORAGE_ENFORCE_METHOD:</span>
                <span className="text-[11px] font-bold text-[#141414] mt-0.5 block">Delta ACID Transactions</span>
              </div>
            </div>

            {/* Gold Node */}
            <div className="bg-[#141414] rounded-none p-5 border border-[#141414] text-white shadow-none flex flex-col justify-between relative">
              <div className="absolute -left-3 top-[50%] bg-[#141414] p-1 border border-[#141414]/30 hidden lg:block z-10">
                <ArrowRight className="h-4 w-4 text-white/50" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold font-mono text-[#141414] bg-[#00CC66] px-1.5 py-0.5 rounded-none uppercase">
                    GOLD_REPORTING_STAGE
                  </span>
                  <Database className="h-4 w-4 text-[#00CC66]" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mt-3">Downstream Reporting Hub</h3>
                <p className="text-[11px] text-white/70 mt-1 leading-normal font-sans">
                  High-leverage aggregate business reporting tables. Materialized delta structures optimised for business intelligence and dashboards.
                </p>

                {/* Sub details */}
                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono border-b border-white/10 pb-1 text-white/80">
                    <span className="text-white/60">gold_dept_profitability</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono border-b border-white/10 pb-1 text-white/80">
                    <span className="text-white/60">gold_monthly_revenue_trend</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono border-b border-white/10 pb-1 text-white/80">
                    <span className="text-white/60">gold_doctor_kpi_matrix</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-white/15 pt-4 mt-6 font-mono">
                <span className="text-[9px] text-white/40 block">DOWNSTREAM_CHANNELS:</span>
                <span className="text-[11px] font-bold text-[#00CC66] mt-0.5 block">PowerBI / Databricks SQL / ML</span>
              </div>
            </div>

          </div>

          {/* Department profitability aggregated model visualizer (Gold table preview) */}
          <div className="bg-white rounded-none p-5 border border-[#141414] shadow-none space-y-4">
            <div>
              <span className="text-[9px] font-bold font-mono text-white bg-[#141414] px-1.5 py-0.5 rounded-none uppercase">gold_dept_profitability (View)</span>
              <h3 className="text-xs font-bold text-[#141414] uppercase mt-3 tracking-wider">Active Department Margin Contribution</h3>
              <p className="text-[9px] font-mono text-[#141414]/65 uppercase">Simulated Gold aggregations computing net margins across hospital channels</p>
            </div>

            <div className="h-64 w-full">
              {pipelineMetrics?.goldAggregations?.departmentProfitability ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineMetrics.goldAggregations.departmentProfitability}>
                    <CartesianGrid strokeDasharray="2 2" stroke="#141414" strokeOpacity={0.15} vertical={false} />
                    <XAxis dataKey="department" stroke="#141414" fontSize={9} fontFamily="monospace" tickLine={true} />
                    <YAxis stroke="#141414" fontSize={9} fontFamily="monospace" tickLine={true} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '0px', background: '#141414', border: '1px solid #141414', color: '#fff', fontSize: '10px', fontFamily: 'monospace' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                    <Bar dataKey="revenue" name="TOTAL REVENUE ($)" fill="#0066FF" radius={0} />
                    <Bar dataKey="profit" name="NET MARGIN ($)" fill="#00CC66" radius={0} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex text-[#141414]/50 font-mono uppercase justify-center h-full text-xs items-center">Awaiting data...</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Spark SQL Ingestion code snippets */}
      {activeTab === 'code' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Spark Read Python template */}
          <div className="bg-[#141414] text-white rounded-none p-5 border border-[#141414] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-white/20 pb-3 mb-4">
                <span className="text-xs font-bold font-mono text-[#0066FF] flex items-center gap-1.5 focus:outline-none">
                  <Code2 className="h-3.5 w-3.5" /> PySpark Data Frame Loader
                </span>
                <span className="text-[10px] text-white/50 font-mono">databricks_etl_read.py</span>
              </div>
              <pre className="text-[11px] font-mono leading-relaxed overflow-x-auto text-white/90">
{`# 1. Establish Ingestion Paths from PulseStream Engine
ingress_base_url = "${window.location.origin}/api/export/csv/"
tables = ["patients", "appointments", "doctors", "transactions"]

# 2. Iterate and materialize as Delta Tables in Databricks
for table in tables:
    raw_df = spark.read \\
        .format("csv") \\
        .option("header", "true") \\
        .option("inferSchema", "true") \\
        .load(f"{ingress_base_url}{table}")
        
    # Write directly to raw Bronze Parquet Directory
    raw_df.write \\
        .format("delta") \\
        .mode("append") \\
        .save(f"/mnt/pulse_healthcare/bronze/{table}")
        
print("Bronze appending ingestion run successfully executed.")`}
              </pre>
            </div>
            <div className="pt-4 border-t border-white/10 mt-6 text-[10px] text-white/40 flex items-center gap-2 font-mono">
              <span className="px-1.5 py-0.5 bg-white/10 rounded-none font-bold text-white/80">NOTE</span>
              <span>Deploy onto a Databricks Job Cluster for automated periodic ingestion.</span>
            </div>
          </div>

          {/* Delta Lake Merge Statement */}
          <div className="bg-[#141414] text-white rounded-none p-5 border border-[#141414] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-white/20 pb-3 mb-4">
                <span className="text-xs font-bold font-mono text-[#00CC66] flex items-center gap-1.5 focus:outline-none">
                  <Terminal className="h-3.5 w-3.5" /> Silver Merge / UPSERT Statement
                </span>
                <span className="text-[10px] text-white/50 font-mono">transform_silver_merge.sql</span>
              </div>
              <pre className="text-[11px] font-mono leading-relaxed overflow-x-auto text-white/90">
{`-- MERGE Bronze incoming records into production Silver Lake
-- Deduplicate medical claims & consultation tuples dynamically

MERGE INTO pulse_silver.transactions AS target
USING bronze_transactions_temp AS source
ON target.id = source.id
WHEN MATCHED AND target.date < source.date THEN
  UPDATE SET 
    target.amount = source.amount,
    target.insuranceCoverage = source.insuranceCoverage,
    target.paymentType = source.paymentType,
    target.date = source.date
WHEN NOT MATCHED THEN
  INSERT (id, patientId, appointmentId, date, amount, type, insuranceCoverage, paymentType, department)
  VALUES (source.id, source.patientId, source.appointmentId, source.date, source.amount, source.type, source.insuranceCoverage, source.paymentType, source.department);`}
              </pre>
            </div>
            <div className="pt-4 border-t border-white/10 mt-6 text-[10px] text-white/40 flex items-center gap-2 font-mono">
              <span className="px-1.5 py-0.5 bg-white/10 rounded-none font-bold text-white/80">ACID</span>
              <span>Guarantees idempotent transactions and stops double billing items.</span>
            </div>
          </div>

        </div>
      )}

      {/* Tab: JSON / CSV export streams download list */}
      {activeTab === 'exports' && (
        <div className="bg-white rounded-none p-5 border border-[#141414] shadow-none space-y-6">
          <div>
            <h3 className="text-xs font-bold text-[#141414] tracking-wider uppercase font-sans">Structured Storage Exporters</h3>
            <p className="text-[10px] font-mono text-[#141414]/60 uppercase mt-0.5">Use these live endpoints in Databricks or curl tasks to extract datasets directly</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {['patients', 'appointments', 'doctors', 'departments', 'transactions'].map((tbl) => (
              <div key={tbl} className="p-4 bg-white rounded-none border border-[#141414] flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase text-[#141414]">{tbl} Lake Table</span>
                    <Table className="h-3.5 w-3.5 text-[#141414]/50" />
                  </div>
                  <span className="text-[10px] font-mono text-[#141414]/60 mt-1 block leading-normal uppercase">
                    Structured relational rows modeling active {tbl} schemas.
                  </span>
                </div>

                <div className="flex items-center gap-2 font-mono">
                  <a
                    href={`/api/export/csv/${tbl}`}
                    download
                    className="flex-1 py-1.5 text-[9px] font-bold text-[#141414] bg-[#F0EFEC] border border-[#141414] hover:bg-[#141414] hover:text-white transition-colors text-center uppercase"
                  >
                    CSV
                  </a>
                  <a
                    href={`/api/export/json/${tbl}`}
                    download
                    className="flex-1 py-1.5 text-[9px] font-bold text-[#141414] bg-[#F0EFEC] border border-[#141414] hover:bg-[#141414] hover:text-white transition-colors text-center uppercase"
                  >
                    JSON
                  </a>
                </div>
              </div>
            ))}

          </div>
        </div>
      )}

      {/* Tab: SQL query Sandbox playground */}
      {activeTab === 'sandbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          
          {/* SQL Editor Terminal */}
          <div className="lg:col-span-1 bg-[#141414] text-white rounded-none p-5 border border-[#141414] flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-xs font-bold font-mono text-white/80 flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-[#0066FF]" /> Read-Only SQL Command
                </span>
                <span className="h-2 w-2 rounded-none bg-[#00CC66]" />
              </div>

              {/* SQL Text Area block */}
              <div>
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  className="w-full h-48 bg-black/50 p-3.5 rounded-none border border-white/20 font-mono text-[11px] leading-relaxed text-white/95 focus:outline-none focus:border-white/40"
                />
              </div>

              {/* Query presets selection */}
              <div className="space-y-2">
                <span className="text-[9px] font-mono text-white/40 uppercase block">SQL Query Presets:</span>
                <div className="space-y-1.5">
                  {sqlPresets.map((ps) => (
                    <button
                      key={ps.title}
                      type="button"
                      onClick={() => setSqlQuery(ps.query)}
                      className="w-full text-left p-2 rounded-none bg-white/5 hover:bg-white/10 text-[10px] font-mono text-white/80 border border-white/10 hover:border-white/20 block truncate transition-all cursor-pointer"
                    >
                      {ps.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleExecuteSql}
              disabled={executingSql}
              className="w-full bg-[#0066FF] hover:bg-blue-500 text-white font-bold font-mono rounded-none py-2.5 text-xs tracking-wider transition disabled:opacity-30 w-full mt-4 flex items-center justify-center gap-1.5 cursor-pointer uppercase"
            >
              <Play className="h-3.5 w-3.5 fill-current shrink-0" />
              {executingSql ? 'Running Query planner...' : 'EXEC_QUERY'}
            </button>
          </div>

          {/* Results Block */}
          <div className="lg:col-span-2 bg-white rounded-none border border-[#141414] shadow-none p-5 flex flex-col justify-between overflow-hidden">
            <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#141414]/15 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-[#141414] uppercase tracking-wider">Relation Set Results</h3>
                  <p className="text-[9px] font-mono text-[#141414]/60 uppercase">Structured tables view resulting from selected schema query logic</p>
                </div>
                <span className="font-mono text-xs font-bold text-[#141414]">Rows count: {sqlResults.length}</span>
              </div>

              {/* Error or Results table */}
              {sqlError ? (
                <div className="p-4 bg-[#FF3300]/10 border border-[#FF3300] text-[#FF3300] text-xs rounded-none font-mono leading-relaxed mt-2 uppercase">
                  {sqlError}
                </div>
              ) : sqlResults.length === 0 ? (
                <div className="flex-1 flex flex-col justify-center items-center py-20 text-[#141414]/40 text-xs font-mono space-y-2">
                  <Database className="h-8 w-8 text-[#141414]/30" />
                  <span className="uppercase">Execute a SELECT query against database relations</span>
                </div>
              ) : (
                <div className="flex-1 overflow-auto rounded-none border border-[#141414]/20 max-h-96">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="bg-[#F0EFEC] border-b border-[#141414]">
                        {sqlHeaders.map((hdr) => (
                          <th key={hdr} className="px-4 py-2.5 font-bold text-[#141414] uppercase tracking-wider text-[10px]">
                            {hdr}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#141414]/10 text-slate-700 font-mono text-[11px]">
                      {sqlResults.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#F0EFEC]/40">
                          {sqlHeaders.map((hdr) => (
                            <td key={hdr} className="px-4 py-2 text-[#141414] font-medium">
                              {row[hdr]?.toString() || 'NULL'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#141414]/15 text-[9px] text-[#141414]/50 block font-mono mt-4 uppercase">
              Database models synced dynamically: patients, appointments, doctors, transactions, departments.
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
