import React, { useState } from 'react';
import { Shield, Key, HeartPulse, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLogin: (username: string, password: string) => void;
  errorMsg: string | null;
  loading: boolean;
}

export default function Login({ onLogin, errorMsg, loading }: LoginProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');

  const presetAccounts = [
    { username: 'admin', role: 'Admin', pass: 'admin123', desc: 'Manage simulations, configurations & database resets.' },
    { username: 'doctor', role: 'Doctor', pass: 'doctor123', desc: 'Review clinical panels, doctor metrics & work utilization.' },
    { username: 'analyst', role: 'Analyst', pass: 'analyst123', desc: 'Monitor Bronze/Silver/Gold data streams & API endpoints.' },
    { username: 'finance', role: 'Finance', pass: 'finance123', desc: 'Inspect transaction streams, insurance coverages & CFO reports.' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username, password as any);
  };

  const handleSelectPreset = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-none shadow-none flex flex-col md:flex-row overflow-hidden border border-[#141414]">
        
        {/* Left Side: Branding and info */}
        <div className="md:w-5/12 bg-[#141414] p-8 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,102,255,0.1),transparent)]" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2.5 bg-[#0066FF] border border-white/20 rounded-none shadow-none">
                <HeartPulse className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="font-sans font-black text-lg tracking-tighter uppercase block">PulseStream</span>
                <span className="text-[9px] text-white/50 font-mono tracking-normal uppercase block">Healthcare Simulation</span>
              </div>
            </div>
            
            <h1 className="text-xl font-black tracking-tight mb-4 leading-tight uppercase font-sans border-b border-white/10 pb-4">
              Production-Grade Operations Data Engine
            </h1>
            <p className="text-white/70 text-xs leading-relaxed mb-6 font-mono uppercase">
              PulseStream simulates patient entries, diagnostics, appointments, and billing streams to populate Bronze, Silver, and Gold data lakes.
            </p>
          </div>

          <div className="relative z-10 border-t border-white/10 pt-6">
            <span className="text-[9px] text-white/40 font-mono block mb-2 uppercase tracking-wider">
              Ingestion Simulation Stats
            </span>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[9px] text-white/50 uppercase font-mono block">Baseline Nodes</span>
                <span className="text-base font-bold font-mono text-[#0066FF]">160,000+ RECORDS</span>
              </div>
              <div>
                <span className="text-[9px] text-white/50 uppercase font-mono block">Ingress Stream</span>
                <span className="text-base font-bold font-mono text-[#00CC66] uppercase">CONTINUOUS</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form and credentials picker */}
        <div className="md:w-7/12 p-8 flex flex-col justify-center bg-white">
          <div className="max-w-md w-full mx-auto">
            <div className="mb-6 border-b border-[#141414]/10 pb-4">
              <h2 className="text-2xl font-black text-[#141414] tracking-tighter uppercase">Access Simulation Core</h2>
              <p className="text-[#141414]/65 text-xs font-mono uppercase mt-1">Authenticate using pre-configured role profiles.</p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3.5 bg-[#FF3300]/10 text-[#FF3300] text-xs rounded-none border border-[#FF3300] flex items-center gap-2 font-mono uppercase">
                <Shield className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold font-mono text-[#141414] uppercase tracking-wider mb-1.5">
                  Simulation User Role
                </label>
                <div className="relative font-mono">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter simulation role"
                    className="w-full px-4 py-2.5 bg-white rounded-none border border-[#141414] text-[#141414] text-xs focus:outline-none focus:ring-1 focus:ring-[#141414] transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold font-mono text-[#141414] uppercase tracking-wider mb-1.5">
                  Private Key / Password
                </label>
                <div className="relative font-mono">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-4 py-2.5 bg-white rounded-none border border-[#141414] text-[#141414] text-xs focus:outline-none focus:ring-1 focus:ring-[#141414] transition-all font-mono"
                    required
                  />
                  <div className="absolute right-3 top-2.5 text-[#141414]/80">
                    <Key className="h-4 w-4" />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#141414] hover:bg-[#0066FF] text-white rounded-none py-2.5 text-xs font-bold font-mono tracking-wider uppercase transition-colors cursor-pointer disabled:opacity-30 inline-flex items-center justify-center gap-2"
              >
                {loading ? 'Booting Console...' : 'Initialize Secure Console'}
              </button>
            </form>

            <div className="mt-8 border-t border-[#141414]/15 pt-6">
              <span className="text-[10px] font-bold text-[#141414]/70 block mb-3 uppercase tracking-wider flex items-center gap-1 font-mono">
                <Sparkles className="h-3 w-3 text-[#CC6600]" /> Preset accounts profiling registry:
              </span>
              <div className="grid grid-cols-2 gap-2.5 font-mono">
                {presetAccounts.map((ac) => (
                  <button
                    key={ac.username}
                    type="button"
                    onClick={() => handleSelectPreset(ac.username, ac.pass)}
                    className={`p-2.5 text-left rounded-none border transition-all text-xs group cursor-pointer ${
                      username === ac.username
                        ? 'border-[#141414] bg-[#F0EFEC] ring-1 ring-[#141414]'
                        : 'border-[#141414]/20 bg-white hover:bg-[#F0EFEC]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#141414] capitalize">{ac.username}</span>
                      <span className="text-[8px] px-1 py-0.5 rounded-none font-mono font-bold text-white bg-[#141414] uppercase">
                        {ac.role}
                      </span>
                    </div>
                    <span className="text-[9px] text-[#141414]/50 mt-1 block leading-normal line-clamp-1 uppercase">{ac.desc}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
