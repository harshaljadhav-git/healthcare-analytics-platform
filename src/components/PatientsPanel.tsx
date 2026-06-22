import React, { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, ChevronLeft, ChevronRight, UserPlus, Heart } from 'lucide-react';
import { motion } from 'motion/react';

interface PatientsPanelProps {
  token: string;
  userRole: string;
  onRefreshSummary: () => void;
}

export default function PatientsPanel({ token, userRole, onRefreshSummary }: PatientsPanelProps) {
  const [patients, setPatients] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [statesList, setStatesList] = useState<string[]>([]);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const url = new URL('/api/patients', window.location.origin);
      url.searchParams.set('page', page.toString());
      url.searchParams.set('limit', limit.toString());
      if (search) url.searchParams.set('search', search);
      if (selectedState) url.searchParams.set('state', selectedState);
      if (selectedCategory) url.searchParams.set('category', selectedCategory);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data && data.data) {
        setPatients(data.data);
        setTotal(data.total);
        setStatesList(data.states || []);
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [page, limit, selectedState, selectedCategory, token]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPatients();
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      
      {/* Header and Counters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tighter text-[#141414] uppercase">SYNTHETIC INGRESS REGISTER: PATIENTS</h2>
          <p className="text-[10px] font-mono text-[#141414]/60 uppercase mt-0.5">
            Operational Patient Master Index (PMI) feed reflecting synthetic demographics.
          </p>
        </div>
        
        {/* Total stats */}
        <div className="bg-white shrink-0 shadow-none border border-[#141414] rounded-none px-4 py-2 flex items-center gap-3">
          <div className="p-2 bg-[#F0EFEC] border border-[#141414] text-[#141414] font-bold font-mono">
            <Heart className="h-4 w-4 fill-current shrink-0 text-[#141414]" />
          </div>
          <div>
            <span className="text-[9px] text-[#141414]/50 font-mono block uppercase">Total Lake Size</span>
            <span className="text-sm font-black font-mono text-[#141414]">{total.toLocaleString()} PATIENTS</span>
          </div>
        </div>
      </div>

      {/* Query Filters */}
      <div className="bg-white p-4 rounded-none border border-[#141414] shadow-none">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Left search */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Query patient details (ID, Name)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-[#141414] rounded-none text-xs font-mono text-[#141414] placeholder-[#141414]/40 focus:outline-none focus:ring-1 focus:ring-[#141414]"
            />
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#141414]/60" />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Category selection */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-white border border-[#141414] rounded-none text-xs text-[#141414] focus:outline-none focus:ring-1 focus:ring-[#141414] font-mono"
            >
              <option value="">All Care Categories</option>
              <option value="Inpatient">Inpatient</option>
              <option value="Outpatient">Outpatient</option>
              <option value="ER">Emergency Room (ER)</option>
            </select>

            {/* State selection */}
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-white border border-[#141414] rounded-none text-xs text-[#141414] focus:outline-none focus:ring-1 focus:ring-[#141414] font-mono"
            >
              <option value="">All States</option>
              {statesList.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>

            {/* Action buttons */}
            <button
              type="submit"
              className="px-4 py-2 bg-[#141414] text-white rounded-none text-xs font-bold hover:bg-[#333] transition-colors uppercase font-mono cursor-pointer"
            >
              APPLY_FILTER
            </button>

            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedState('');
                setSelectedCategory('');
                setPage(1);
              }}
              className="p-2 bg-[#F0EFEC] hover:bg-[#141414] hover:text-white border border-[#141414] rounded-none text-[#141414] transition cursor-pointer"
              title="Reset configuration"
            >
              <RefreshCw className="h-3.5 w-3.5 shrink-0" />
            </button>
          </div>

        </form>
      </div>

      {/* Grid Table */}
      <div className="bg-white rounded-none border border-[#141414] shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F0EFEC] border-b border-[#141414]">
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Patient ID</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Full Name</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Age / Gender</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Blood Type</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Region</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Care Category</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Insurance Cover</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Registration Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141414]/15 text-[#141414] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 font-mono text-[#141414]/65">
                    Executing Ingress Index Query...
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-[#141414]/65 font-mono">
                    No active synthetic database tuples match your filtration rules.
                  </td>
                </tr>
              ) : (
                patients.map((pt) => (
                  <tr key={pt.id} className="hover:bg-[#F0EFEC] transition-all font-mono">
                    <td className="px-5 py-3 text-[#141414] font-bold font-mono text-xs">{pt.id}</td>
                    <td className="px-5 py-3 font-sans font-bold text-[#141414] uppercase">{pt.name}</td>
                    <td className="px-5 py-3">
                      {pt.age} yrs / <span className="opacity-70">{pt.gender}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-1.5 py-0.5 bg-white text-[#141414] border border-[#141414] font-bold text-[10px]">
                        {pt.bloodGroup}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-sans text-[#141414]/80">
                      {pt.city}, <span className="font-mono font-bold opacity-70">{pt.state}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-1.5 py-0.5 border border-[#141414] font-bold text-[9px] uppercase ${
                        pt.category === 'Inpatient' ? 'bg-[#0033CC] text-white' :
                        pt.category === 'Outpatient' ? 'bg-[#00CC66]/20 text-[#141414]' :
                        'bg-[#CC6600]/20 text-[#141414]'
                      }`}>
                        {pt.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-sans text-[#141414]/80">
                      {pt.insuranceProvider}
                    </td>
                    <td className="px-5 py-3 text-[#141414]/60 font-mono text-[10px]">
                      {new Date(pt.registrationDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Console */}
        {totalPages > 1 && (
          <div className="p-4 bg-[#F0EFEC] border-t border-[#141414] flex items-center justify-between text-xs text-[#141414]">
            <span className="font-mono font-medium opacity-85">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of <span className="font-bold text-[#141414]">{total}</span> records
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="p-1.5 hover:bg-[#141414] hover:text-white border border-[#141414] bg-white disabled:opacity-30 transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 py-1 font-mono font-bold text-[#141414] bg-white border border-[#141414]">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="p-1.5 hover:bg-[#141414] hover:text-white border border-[#141414] bg-white disabled:opacity-30 transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
