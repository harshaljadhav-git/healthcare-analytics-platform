import React, { useState, useEffect } from 'react';
import { 
  HeartPulse, LayoutDashboard, Users, Calendar, Award, DollarSign, Database, LogOut, ArrowUpRight, ShieldAlert, Sparkles, RefreshCw
} from 'lucide-react';
import { User, UserRole } from './types';
import Login from './components/Login';
import DashboardOverview from './components/DashboardOverview';
import PatientsPanel from './components/PatientsPanel';
import AppointmentsPanel from './components/AppointmentsPanel';
import DoctorsPanel from './components/DoctorsPanel';
import FinanceReportPanel from './components/FinanceReportPanel';
import DatabricksLakePanel from './components/DatabricksLakePanel';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('sim_token'));
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [summary, setSummary] = useState<any>(null);
  const [simStatus, setSimStatus] = useState<any>(null);
  const [databricksHealth, setDatabricksHealth] = useState<{ connected: boolean; warehouseState?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Authenticate user session
  const handleLogin = async (username: string, pass: string) => {
    setAuthLoading(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: pass })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('sim_token', data.token);
        setToken(data.token);
        setUser(data.user);
      } else {
        setLoginError(data.error || 'Authentication credential failure');
      }
    } catch (err) {
      setLoginError('Failed to contact simulation ingress network server.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('sim_token');
    setToken(null);
    setUser(null);
    setActiveTab('dashboard');
  };

  // Get current user details if token exists
  const fetchCurrentUser = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        handleLogout();
      }
    } catch (err) {
      console.error('Session verify failed:', err);
    }
  };

  // Fetch quick metrics counters
  const fetchSummaryStats = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/analytics/summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data) {
        setSummary(data);
      }
    } catch (err) {
      console.error('Core analytics fetch failed:', err);
    }
  };

  // Fetch simulation speeds/states
  const fetchSimStatus = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/simulation/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data) {
        setSimStatus(data);
      }
    } catch (err) {
      console.error('Simulation configuration fetch failed:', err);
    }
  };

  // Fetch Databricks connection health
  const fetchDatabricksHealth = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/databricks/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setDatabricksHealth({ connected: data.connected, warehouseState: data.warehouseState });
    } catch {
      setDatabricksHealth({ connected: false });
    }
  };

  // Alter speed configurations
  const handleSpeedChange = async (speed: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/simulation/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ speed })
      });
      if (res.ok) {
        await fetchSimStatus();
      }
    } catch (err) {
      console.error('Failed altering speed configurations:', err);
    } finally {
      setLoading(false);
    }
  };

  // Manual Activity Burst trigger
  const handleForceGenerate = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/simulation/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchSummaryStats();
        await fetchSimStatus();
      }
    } catch (err) {
      console.error('Failed triggering manual operations pulse:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
      fetchSummaryStats();
      fetchSimStatus();
      fetchDatabricksHealth();
    }
  }, [token]);

  // Background polling intervals to capture real-time rows growth!
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      fetchSummaryStats();
      fetchSimStatus();
    }, 4500); // Poll every 4.5 seconds
    return () => clearInterval(interval);
  }, [token]);

  // Slower poll for Databricks health (every 30s)
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      fetchDatabricksHealth();
    }, 30000);
    return () => clearInterval(interval);
  }, [token]);

  if (!token) {
    return <Login onLogin={handleLogin} errorMsg={loginError} loading={authLoading} />;
  }

  // Sidebar Tabs Config
  const menuItems = [
    { id: 'dashboard', name: 'Executive Cockpit', icon: LayoutDashboard, roles: ['Admin', 'Doctor', 'Analyst', 'Finance'] },
    { id: 'patients', name: 'Patient Ingress', icon: Users, roles: ['Admin', 'Doctor', 'Analyst', 'Finance'] },
    { id: 'appointments', name: 'Roster Schedules', icon: Calendar, roles: ['Admin', 'Doctor', 'Analyst'] },
    { id: 'doctors', name: 'Physician Registry', icon: Award, roles: ['Admin', 'Doctor', 'Analyst'] },
    { id: 'finance', name: 'Financial & Claims', icon: DollarSign, roles: ['Admin', 'Analyst', 'Finance'] },
    { id: 'databricks', name: 'Databricks Exploration', icon: Database, roles: ['Admin', 'Doctor', 'Analyst', 'Finance'] },
  ];

  // Filtering tabs matching user credentials
  const allowedMenuItems = menuItems.filter(item => user && item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-[#E4E3E0] flex flex-col md:flex-row font-sans text-[#141414] select-none">
      
      {/* Sidebar Workspace Switcher */}
      <aside className="w-full md:w-64 bg-[#F0EFEC] text-[#141414] flex flex-col justify-between shrink-0 border-r border-[#141414]">
        <div>
          {/* Logo */}
          <div className="p-5 border-b border-[#141414] flex items-center gap-3 bg-white">
            <div className="w-8 h-8 bg-[#141414] flex items-center justify-center shrink-0">
              <HeartPulse className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <span className="font-black text-sm tracking-tighter text-[#141414] block uppercase">PULSESTREAM v2.1</span>
              <span className="text-[9px] text-[#141414] font-mono tracking-wider block opacity-60 uppercase">Data Ingest Core</span>
            </div>
          </div>

          <div className="p-3 border-b border-[#141414] bg-[#141414] text-white">
            <span className="text-[10px] uppercase opacity-70 font-mono tracking-wider font-semibold">System Controls</span>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col bg-slate-50/50">
            {allowedMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 border-b border-[#141414] text-xs font-bold uppercase transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-white text-[#141414] font-bold border-l-4 border-l-[#141414]'
                      : 'hover:bg-white text-[#141414]/70 hover:text-[#141414]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-[#141414]" />
                    {item.name}
                  </span>
                  <span className="text-[10px] opacity-40 font-mono">{isActive ? '●' : '→'}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Medallion Pipeline Stats and Client Host Status (styled from the design theme spec) */}
        <div className="p-4 space-y-4 border-t border-[#141414]">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase font-bold opacity-55 tracking-wider">Medallion Ingest Status</span>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-[#0066FF] font-bold">BRONZE_LAKE</span>
                <span className="bg-blue-50 text-[#0066FF] px-1 py-0.2 border border-[#0066FF]/20">SYNCED</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-[#CC6600] font-bold">SILVER_CLEAN</span>
                <span className="bg-amber-50 text-[#CC6600] px-1 py-0.2 border border-[#CC6600]/20 animate-pulse">VALIDATING</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono text-gray-400">
                <span className="font-bold">GOLD_AGGREG</span>
                <span className="opacity-60 text-slate-500">AGGREGATING</span>
              </div>
            </div>
          </div>
          
          <div className="pt-3 border-t border-[#141414]/10 text-[10px] font-mono opacity-50 uppercase space-y-0.5">
            <div>Worker: node-01-ok</div>
            <div>DB instance: postgresql-rds</div>
          </div>
        </div>

        {/* Workspace User Details */}
        <div className="p-4 border-t border-[#141414] bg-white space-y-3">
          {user && (
            <div className="flex items-center gap-3">
              <img
                src={user.avatar}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="h-9 w-9 object-cover border-2 border-[#141414] shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-[#141414] block truncate">{user.name}</span>
                <span className="inline-block text-[9px] font-mono tracking-wide mt-1 uppercase text-[#141414] border border-[#141414] px-1.5 py-0.5 bg-[#F0EFEC]">
                  ROLE: {user.role}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full py-2 bg-[#F0EFEC] hover:bg-[#141414] hover:text-white border border-[#141414] text-[10px] font-mono font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer uppercase"
          >
            <LogOut className="h-3 w-3 shrink-0" />
            DISCONNECT_CONSOLE
          </button>
        </div>
      </aside>

      {/* Primary Workspace Area */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* Top bar indicators */}
        <header className="bg-[#F0EFEC] border-b border-[#141414] flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase opacity-60">WORKSPACE PARTITION</span>
              <span className="h-2 w-2 rounded-full bg-[#00CC66] animate-pulse" />
            </div>
            <h2 className="text-base font-black tracking-tighter uppercase text-[#141414] mt-0.5">
              {activeTab === 'dashboard' ? 'OPERATIONAL COCKPIT' : `${activeTab}_manager`}
            </h2>
          </div>

          <div className="flex items-center gap-6 text-xs font-mono">
            <div className="flex gap-4">
              <div className="flex flex-col items-end">
                <span className="text-[9px] uppercase font-bold opacity-40">SIM_STATUS</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00CC66] animate-pulse"></span>
                  <span className="text-[10px] font-mono font-bold">REPL_MODE</span>
                </div>
              </div>
              <div className="w-px h-8 bg-[#141414] opacity-20"></div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] uppercase font-bold opacity-40">DATABRICKS</span>
                <div className={`flex items-center gap-1.5 font-bold text-[10px] ${
                  databricksHealth?.connected ? 'text-[#00CC66]' : 'text-[#FF3300]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    databricksHealth?.connected ? 'bg-[#00CC66] animate-pulse' : 'bg-[#FF3300]'
                  }`}></span>
                  {databricksHealth?.connected ? (databricksHealth.warehouseState || 'CONNECTED') : 'OFFLINE'}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                fetchSummaryStats();
                fetchSimStatus();
              }}
              className="px-3 py-1.5 text-[10px] font-bold border border-[#141414] bg-white hover:bg-[#141414] hover:text-white transition-colors flex items-center gap-1 uppercase cursor-pointer"
            >
              <RefreshCw className="h-3 w-3 shrink-0" />
              SYNC_MANUAL
            </button>
          </div>
        </header>

        {/* Scrollable Active Screen Content */}
        <section className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          
          {activeTab === 'dashboard' && (
            <DashboardOverview
              summary={summary}
              simStatus={simStatus}
              userRole={user?.role || 'Guest'}
              onSpeedChange={handleSpeedChange}
              onForceGenerate={handleForceGenerate}
              loading={loading}
            />
          )}

          {activeTab === 'patients' && (
            <PatientsPanel token={token} userRole={user?.role || 'Guest'} onRefreshSummary={fetchSummaryStats} />
          )}

          {activeTab === 'appointments' && (
            <AppointmentsPanel token={token} userRole={user?.role || 'Guest'} />
          )}

          {activeTab === 'doctors' && (
            <DoctorsPanel token={token} />
          )}

          {activeTab === 'finance' && (
            <FinanceReportPanel token={token} />
          )}

          {activeTab === 'databricks' && (
            <DatabricksLakePanel token={token} />
          )}

        </section>
      </main>

    </div>
  );
}
