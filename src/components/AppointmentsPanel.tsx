import React, { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, ChevronLeft, ChevronRight, CheckCircle, Calendar, XCircle, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

interface AppointmentsPanelProps {
  token: string;
  userRole: string;
}

export default function AppointmentsPanel({ token, userRole }: AppointmentsPanelProps) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [loading, setLoading] = useState(false);

  const departments = [
    'Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Emergency', 'Oncology', 'Dermatology', 'Radiology'
  ];

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const url = new URL('/api/appointments', window.location.origin);
      url.searchParams.set('page', page.toString());
      url.searchParams.set('limit', limit.toString());
      if (selectedStatus) url.searchParams.set('status', selectedStatus);
      if (selectedDepartment) url.searchParams.set('department', selectedDepartment);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data && data.data) {
        setAppointments(data.data);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Error fetching appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [page, limit, selectedStatus, selectedDepartment, token]);

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      
      {/* Header and Counters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tighter text-[#141414] uppercase">SYNTHETIC INGRESS REGISTER: APPOINTMENTS</h2>
          <p className="text-[10px] font-mono text-[#141414]/60 uppercase mt-0.5">
            Real-time appointment schedule, consultation durations, and checkin completions.
          </p>
        </div>
        
        {/* Total appointments */}
        <div className="bg-white shrink-0 shadow-none border border-[#141414] rounded-none px-4 py-2 flex items-center gap-3">
          <div className="p-2 bg-[#F0EFEC] border border-[#141414] text-[#141414] font-mono font-bold">
            <Calendar className="h-4 w-4 shrink-0 text-[#141414]" />
          </div>
          <div>
            <span className="text-[9px] text-[#141414]/50 font-mono block uppercase">Total Lake Size</span>
            <span className="text-sm font-black font-mono text-[#141414]">{total.toLocaleString()} RECORDS</span>
          </div>
        </div>
      </div>

      {/* Query Filters */}
      <div className="bg-white p-4 rounded-none border border-[#141414] shadow-none flex flex-wrap gap-2.5 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white border border-[#141414] rounded-none text-xs text-[#141414] focus:outline-none focus:ring-1 focus:ring-[#141414] font-mono"
          >
            <option value="">All Appointment Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Rescheduled">Rescheduled</option>
          </select>

          {/* Department Selection */}
          <select
            value={selectedDepartment}
            onChange={(e) => {
              setSelectedDepartment(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white border border-[#141414] rounded-none text-xs text-[#141414] focus:outline-none focus:ring-1 focus:ring-[#141414] font-mono"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedStatus('');
            setSelectedDepartment('');
            setPage(1);
          }}
          className="px-3.5 py-1.5 bg-[#F0EFEC] hover:bg-[#141414] hover:text-white border border-[#141414] rounded-none text-[#141414] transition-colors cursor-pointer text-xs font-bold uppercase font-mono flex items-center gap-1.5"
          title="Clear configuration filters"
        >
          <RefreshCw className="h-3.5 w-3.5 shrink-0" />
          RESET_FILTERS
        </button>
      </div>

      {/* Grid Table */}
      <div className="bg-white rounded-none border border-[#141414] shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F0EFEC] border-b border-[#141414]">
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Appointment ID</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Patient ID</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Doctor ID</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Clinical Ward</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Consultation Fee</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Duration</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Registration Date</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Schedule Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141414]/15 text-[#141414] text-xs font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-[#141414]/60">
                    Executing Ingress Schedule Query...
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-[#141414]/65">
                    No active synthetic database tuples match your filtration rules.
                  </td>
                </tr>
              ) : (
                appointments.map((ap) => (
                  <tr key={ap.id} className="hover:bg-[#F0EFEC] transition-all border-b border-[#141414]/10">
                    <td className="px-5 py-3 text-[#141414] font-bold text-xs">{ap.id}</td>
                    <td className="px-5 py-3 font-bold text-[#0066FF] underline cursor-pointer">{ap.patientId}</td>
                    <td className="px-5 py-3 font-bold text-[#141414]">{ap.doctorId}</td>
                    <td className="px-5 py-3 font-sans font-bold text-[#141414]/85">{ap.department}</td>
                    <td className="px-5 py-3 text-[#141414] font-black">
                      {ap.revenueGenerated > 0 ? `$${ap.revenueGenerated}` : '$0 (UNPAID)'}
                    </td>
                    <td className="px-5 py-3 text-[#141414]/80">{ap.duration} Mins</td>
                    <td className="px-5 py-3 text-[#141414]/60 text-[10px]">
                      {new Date(ap.appointmentDate).toLocaleDateString()} / {new Date(ap.appointmentDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-1.5 py-0.5 border border-[#141414] font-black text-[9px] uppercase flex items-center w-fit gap-1 rounded-none ${
                        ap.status === 'Completed' ? 'bg-[#00CC66]/20 text-[#141414]' :
                        ap.status === 'Scheduled' ? 'bg-[#0033CC] text-white' :
                        ap.status === 'Cancelled' ? 'bg-[#FF3300]/20 text-[#141414]' :
                        'bg-[#CC6600]/20 text-[#141414]'
                      }`}>
                        {ap.status === 'Completed' && <CheckCircle className="h-3 w-3 shrink-0" />}
                        {ap.status === 'Scheduled' && <Calendar className="h-3 w-3 shrink-0" />}
                        {ap.status === 'Cancelled' && <XCircle className="h-3 w-3 shrink-0" />}
                        {ap.status === 'Rescheduled' && <AlertTriangle className="h-3 w-3 shrink-0" />}
                        {ap.status}
                      </span>
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
