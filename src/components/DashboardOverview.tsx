import React, { useState } from 'react';
import { 
  Users, Calendar, CreditCard, Shield, Settings2, Sparkles, Activity, Clock, ThumbsUp, HelpCircle
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend, Cell } from 'recharts';
import { motion } from 'motion/react';

interface DashboardProps {
  summary: any;
  simStatus: any;
  userRole: string;
  onSpeedChange: (speed: string) => void;
  onForceGenerate: () => void;
  loading: boolean;
}

export default function DashboardOverview({
  summary,
  simStatus,
  userRole,
  onSpeedChange,
  onForceGenerate,
  loading
}: DashboardProps) {
  const [showConfigHelp, setShowConfigHelp] = useState(false);

  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  };

  const statCards = [
    {
      id: "stat_patients",
      title: "Total Tracked Patients",
      value: summary?.totalPatients?.toLocaleString() || '-',
      desc: "Captured across hospital network",
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-50"
    },
    {
      id: "stat_inpatients",
      title: "Active Inpatients",
      value: summary?.activePatients?.toLocaleString() || '-',
      desc: "Occupying ward beds currently",
      icon: Activity,
      color: "text-indigo-500",
      bg: "bg-indigo-50"
    },
    {
      id: "stat_appointments",
      title: "Total Appointments",
      value: summary?.totalAppointments?.toLocaleString() || '-',
      desc: "Scheduled, completed & cancelled",
      icon: Calendar,
      color: "text-emerald-500",
      bg: "bg-emerald-50"
    },
    {
      id: "stat_revenue",
      title: "Consolidated Revenue",
      value: summary?.revenueTotal ? formatCurrency(summary.revenueTotal) : '-',
      desc: "Consultation, labs & pharmacy services",
      icon: CreditCard,
      color: "text-amber-500",
      bg: "bg-amber-50"
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Simulation Header Controller */}
      <div className="bg-white text-[#141414] rounded-none p-5 md:p-6 shadow-none relative overflow-hidden border-2 border-[#141414]">
        <div className="absolute inset-0 bg-[#F0EFEC]/40 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-[#141414] text-white font-mono tracking-widest px-2 py-0.5 rounded-none uppercase font-bold">
                SIMULATION INBOUND REPLICATION
              </span>
              <span className={`h-2.5 w-2.5 rounded-full ${simStatus?.speed === 'Pause' ? 'bg-[#CC6600] animate-pulse' : 'bg-[#00CC66] animate-pulse'}`} />
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tighter mt-1.5 text-[#141414] uppercase font-sans">
              HEAL-SIM REPLICATION CONTROLLER
            </h2>
            <p className="text-[#141414]/70 text-xs font-mono mt-1 uppercase">
              Feeding high-frequency medical records & billing ledger partitions into the Bronze and Silver delta buckets.
            </p>
          </div>

          {/* Controller selectors */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="bg-[#F0EFEC] p-1 border border-[#141414] rounded-none flex items-center">
              {(['Pause', 'RealTime', 'Fast', 'Hyper'] as const).map((sp) => (
                <button
                  key={sp}
                  onClick={() => {
                    if (userRole !== 'Admin') {
                      alert("Access Denied: Only users with the 'Admin' role can alter the simulation speed.");
                      return;
                    }
                    onSpeedChange(sp);
                  }}
                  className={`px-3 py-1.5 text-[10px] font-bold font-mono uppercase tracking-wider transition-all cursor-pointer ${
                    simStatus?.speed === sp
                      ? 'bg-[#141414] text-white'
                      : 'text-[#141414]/65 hover:text-[#141414] hover:bg-white'
                  }`}
                >
                  {sp === 'RealTime' ? '1x Live' : sp === 'Fast' ? '10x Run' : sp === 'Hyper' ? '50x Hyper' : 'Paused'}
                </button>
              ))}
            </div>

            <button
              onClick={onForceGenerate}
              disabled={loading}
              className="bg-[#141414] hover:bg-[#333] text-white border border-[#141414] px-4 py-2 rounded-none text-xs font-bold font-mono tracking-wider transition-all inline-flex items-center gap-1.5 cursor-pointer uppercase"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              FORCE_SPIKE_GEN
            </button>
          </div>
        </div>

        {/* Live Simulation Statistics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-5 border-t border-[#141414] relative z-10">
          <div className="border-r border-[#141414]/20 last:border-0 pr-4">
            <span className="text-[#141414]/50 text-[9px] uppercase font-mono block tracking-wider font-bold">Data Cadence</span>
            <span className="text-sm font-black font-mono text-[#141414] mt-1 block">
              {simStatus?.speed === 'Pause' ? 'TERMINATED' : (simStatus?.speed === 'RealTime' ? '5 MIN CYCLE' : simStatus?.speed === 'Fast' ? '15 SEC CYCLE' : '4 SEC INTERVAL')}
            </span>
          </div>
          <div className="border-r border-[#141414]/20 last:border-0 pr-4">
            <span className="text-[#141414]/50 text-[9px] uppercase font-mono block tracking-wider font-bold">Latest Pipeline Block</span>
            <span className="text-sm font-black font-mono text-[#141414] mt-1 block">
              {simStatus?.lastGenerated ? new Date(simStatus.lastGenerated).toLocaleTimeString() : 'WAITING_SYNC'}
            </span>
          </div>
          <div className="border-r border-[#141414]/20 last:border-0 pr-4">
            <span className="text-[#141414]/50 text-[9px] uppercase font-mono block tracking-wider font-bold">Total Ingested Rows</span>
            <span className="text-sm font-black font-mono text-[#141414] mt-1 block">
              {simStatus?.databaseMetrics ? (
                (simStatus.databaseMetrics.patients + simStatus.databaseMetrics.appointments + simStatus.databaseMetrics.transactions).toLocaleString()
              ) : '-'}
            </span>
          </div>
          <div className="pr-4">
            <span className="text-[#141414]/50 text-[9px] uppercase font-mono block tracking-wider font-bold">Ingress Schema Compliance</span>
            <span className="text-sm font-black font-mono text-[#0066FF] mt-1 block flex items-center gap-1">
              <Shield className="h-3 w-3 shrink-0" /> v4.2-STRICT (100%)
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.id} className="bg-white rounded-none p-5 border border-[#141414] flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold opacity-50 block italic font-serif tracking-widest">{card.title}</span>
                <span className="text-2xl md:text-3xl font-black font-mono text-[#141414] block leading-tight tracking-tighter">{card.value}</span>
                <span className="text-[9px] text-[#141414]/60 block font-mono bg-[#F0EFEC] px-1.5 py-0.5 border border-[#141414]/10 inline-block uppercase">{card.desc}</span>
              </div>
              <div className="p-2.5 bg-[#F0EFEC] border border-[#141414] shrink-0">
                <Icon className="h-4.5 w-4.5 text-[#141414]" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Interactive Revenue Trend Chart */}
        <div className="bg-white rounded-none p-5 border border-[#141414] lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold tracking-wider text-[#141414] uppercase">Consolidated Ingestion Volume Trend</h3>
              <p className="text-[9px] font-mono text-[#141414]/60 uppercase mt-0.5">Rolling operational records count captured during micro-batching</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-[10px] font-mono font-bold">
                <span className="h-2 w-2 bg-[#0066FF]" />
                <span className="text-[#141414]">BRONZE_STREAM</span>
              </div>
            </div>
          </div>

          <div className="h-80 w-full font-mono text-[10px]">
            {summary?.appointmentTrends && summary.appointmentTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summary.appointmentTrends}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0066FF" stopOpacity={0.12}/>
                      <stop offset="95%" stopColor="#0066FF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#141414" strokeOpacity={0.1} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#141414" 
                    fontSize={9} 
                    fontFamily="monospace"
                    tickLine={true}
                    axisLine={true}
                    tickFormatter={(date) => date.split('-').slice(1).join('/')}
                  />
                  <YAxis 
                    stroke="#141414" 
                    fontSize={9} 
                    fontFamily="monospace"
                    tickLine={true}
                    axisLine={true}
                    tickFormatter={(val) => `${val}`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '0px', background: '#141414', border: '1px solid #141414', color: '#fff', fontSize: '10px', fontFamily: 'monospace' }}
                    labelFormatter={(label) => `Timestamp Date: ${label}`}
                  />
                  <Area type="stepBefore" dataKey="count" name="Replicated Rows" stroke="#0066FF" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex text-slate-400 justify-center items-center h-full text-xs font-mono">Loading Real-Time Simulation Ingress...</div>
            )}
          </div>
        </div>

        {/* Right: Operational Hospital Status indicators & performance summary */}
        <div className="bg-white rounded-none p-5 border border-[#141414] space-y-5">
          <div>
            <h3 className="text-xs font-bold tracking-wider text-[#141414] uppercase">Live Operational Benchmarks</h3>
            <p className="text-[9px] font-mono text-[#141414]/60 uppercase mt-0.5">Statistical aggregate partitions validated in Silver Layer</p>
          </div>

          <div className="space-y-4">
            
            {/* Average Patient Satisfaction Index */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#141414]/80 font-bold flex items-center gap-1">
                  <ThumbsUp className="h-3.5 w-3.5 text-[#141414]" />
                  SYS_PATIENT_SATISFACTION
                </span>
                <span className="font-mono font-bold text-[#141414] bg-[#F0EFEC] px-1.5 py-0.2 border border-[#141414]/10">{summary?.patientSatisfaction || '4.5'} / 5.0</span>
              </div>
              <div className="h-2.5 w-full bg-[#F0EFEC] border border-[#141414]/30 overflow-hidden">
                <div 
                  className="h-full bg-[#0066FF]" 
                  style={{ width: `${(summary?.patientSatisfaction || 4.5) * 20}%` }}
                />
              </div>
              <span className="text-[9px] text-[#141414]/50 block font-mono">ACCUMULATED ACROSS 8 ACTIVE DEPARTMENTS</span>
            </div>

            {/* General Doctor Workload Index */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#141414]/80 font-bold flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-[#141414]" />
                  AVG_CLINICAL_UTILIZATION
                </span>
                <span className="font-mono font-bold text-[#141414] bg-[#F0EFEC] px-1.5 py-0.2 border border-[#141414]/10">{summary?.avgDoctorUtilization || '76'}%</span>
              </div>
              <div className="h-2.5 w-full bg-[#F0EFEC] border border-[#141414]/30 overflow-hidden">
                <div 
                  className="h-full bg-[#CC6600]" 
                  style={{ width: `${summary?.avgDoctorUtilization || 76}%` }}
                />
              </div>
              <span className="text-[9px] text-[#141414]/50 block font-mono">REFLECTS STAFF CAP UNIFORM DISTRIBUTION LEVEL</span>
            </div>

            {/* Ingestion Stream Pipeline Status block */}
            <div className="p-3.5 bg-[#F0EFEC] border border-[#141414] space-y-2 font-mono">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#141414]/60 block mb-3 font-mono">DATABRICKS_LAKEHOUSE_STATS</span>
              
              <div className="flex items-center justify-between text-[11px] border-b border-[#141414]/10 pb-1.5">
                <span className="text-[#141414]/70">Bronze Lake Dimensions:</span>
                <span className="font-bold text-[#141414]">5 Tables</span>
              </div>
              
              <div className="flex items-center justify-between text-[11px] border-b border-[#141414]/10 pb-1.5">
                <span className="text-[#141414]/70">Storage Compliance:</span>
                <span className="font-bold text-[#0066FF]">Delta Parquet</span>
              </div>
              
              <div className="flex items-center justify-between text-[11px] pt-0.5">
                <span className="text-[#141414]/70">Ingestion Inbound Scale:</span>
                <span className="font-bold text-[#141414]">+14.2 GB / day</span>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
