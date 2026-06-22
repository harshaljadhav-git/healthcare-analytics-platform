import React, { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, ChevronLeft, ChevronRight, CreditCard, Landmark, DollarSign, Receipt } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell, PieChart, Pie } from 'recharts';
import { motion } from 'motion/react';

interface FinanceProps {
  token: string;
}

export default function FinanceReportPanel({ token }: FinanceProps) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selectedType, setSelectedType] = useState('');
  const [selectedPayment, setSelectedPayment] = useState('');
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);

  // Colors for Pie Charts
  const COLORS = ['#0066FF', '#00CC66', '#CC6600', '#141414', '#141414'];

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const url = new URL('/api/transactions', window.location.origin);
      url.searchParams.set('page', page.toString());
      url.searchParams.set('limit', limit.toString());
      if (selectedType) url.searchParams.set('type', selectedType);
      if (selectedPayment) url.searchParams.set('paymentType', selectedPayment);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data && data.data) {
        setTransactions(data.data);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics/medallion', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data && data.goldAggregations) {
        setAnalytics(data.goldAggregations);
      }
    } catch (err) {
      console.error('Error fetching financial analytics:', err);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [page, limit, selectedType, selectedPayment, token]);

  useEffect(() => {
    fetchAnalytics();
  }, [token]);

  const totalPages = Math.ceil(total / limit) || 1;

  // Compute stats from analytics
  const totalRevenue = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const totalInsurancePayout = transactions.reduce((sum, tx) => sum + tx.insuranceCoverage, 0);

  return (
    <div className="space-y-6">
      
      {/* Header and Counters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tighter text-[#141414] uppercase font-sans">HOSPITAL BILLING & INSURANCE CLAIMS</h2>
          <p className="text-[10px] font-mono text-[#141414]/60 uppercase mt-0.5">
            Analysing clinical transaction lifecycles, insurer write-offs, and department sales metrics.
          </p>
        </div>
        
        {/* Quick summary totals */}
        <div className="flex items-center gap-3">
          <div className="bg-white shadow-none border border-[#141414] rounded-none px-4 py-2 flex items-center gap-3">
            <div className="p-2 bg-[#F0EFEC] border border-[#141414] text-[#141414] font-mono font-bold">
              <DollarSign className="h-4 w-4 shrink-0" />
            </div>
            <div>
              <span className="text-[9px] text-[#141414]/50 font-mono block uppercase">Insurer Claims Paid</span>
              <span className="text-sm font-black font-mono text-[#141414]">
                {analytics?.insuranceUtilization ? (
                  `$${analytics.insuranceUtilization.reduce((sum: number, u: any) => sum + u.totalRevenue, 0).toLocaleString()}`
                ) : '-'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Financial analytical models */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Insurance utilization pie */}
        <div className="bg-white rounded-none p-5 border border-[#141414] shadow-none space-y-4">
          <div>
            <span className="text-[9px] font-bold font-mono text-white bg-[#141414] px-1.5 py-0.5 rounded-none uppercase">gold_insurance_marketshare</span>
            <h3 className="text-xs font-bold text-[#141414] tracking-wider uppercase mt-3">Insurance Provider Allocation</h3>
            <p className="text-[9px] font-mono text-[#141414]/60 uppercase">Insured coverage amounts vs client self payroll ratios</p>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            {analytics?.insuranceUtilization && analytics.insuranceUtilization.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.insuranceUtilization}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="totalRevenue"
                    nameKey="provider"
                  >
                    {analytics.insuranceUtilization.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '0px', background: '#141414', border: '1px solid #141414', color: '#fff', fontSize: '10px', fontFamily: 'monospace' }}
                    formatter={(value) => `$${value.toLocaleString()}`} 
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-xs text-[#141414]/50 font-mono uppercase">Loading charts data...</span>
            )}
          </div>

          {/* Table under pie */}
          <div className="space-y-1.5 pt-3 border-t border-[#141414]/15">
            {analytics?.insuranceUtilization?.map((item: any, idx: number) => (
              <div key={item.provider} className="flex items-center justify-between text-[11px] font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-none shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-[#141414]/85 font-sans font-bold uppercase text-[10px]">{item.provider}</span>
                </div>
                <span className="font-bold text-[#141414]">${item.totalRevenue.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Monthly dynamic revenue trends (Gold dimension) */}
        <div className="bg-white rounded-none p-5 border border-[#141414] shadow-none lg:col-span-2 space-y-4">
          <div>
            <span className="text-[9px] font-bold font-mono text-white bg-[#141414] px-1.5 py-0.5 rounded-none uppercase font-semibold">gold_monthly_revenue_split</span>
            <h3 className="text-xs font-bold text-[#141414] tracking-wider uppercase mt-3">Segmented Sales Development Trend</h3>
            <p className="text-[9px] font-mono text-[#141414]/60 uppercase">Accumulated monthly gross splits including pharmacy items and ward consultations</p>
          </div>

          <div className="h-80 w-full text-[9px] font-mono">
            {analytics?.monthlyRevenueTrend && analytics.monthlyRevenueTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.monthlyRevenueTrend}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#141414" strokeOpacity={0.1} vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    stroke="#141414" 
                    fontSize={9} 
                    fontFamily="monospace"
                    tickLine={true}
                    axisLine={true}
                    tickFormatter={(m) => m.split('-')[1] + '/' + m.split('-')[0].substring(2)}
                  />
                  <YAxis 
                    stroke="#141414" 
                    fontSize={9} 
                    fontFamily="monospace"
                    tickLine={true}
                    axisLine={true}
                    tickFormatter={(val) => `$${val/1000}k`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '0px', background: '#141414', border: '1px solid #141414', color: '#fff', fontSize: '10px', fontFamily: 'monospace' }}
                    formatter={(val) => `$${val.toLocaleString()}`} 
                  />
                  <Legend wrapperStyle={{ fontSize: '9px', fontFamily: 'monospace' }} />
                  <Bar dataKey="consultation" name="CONSULTATIONS" fill="#3b82f6" stackId="a" />
                  <Bar dataKey="pharmacy" name="PHARMACY" fill="#10b981" stackId="a" />
                  <Bar dataKey="lab" name="LABS" fill="#f59e0b" stackId="a" />
                  <Bar dataKey="emergency" name="EMERGENCY" fill="#8b5cf6" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-xs text-[#141414]/50 font-mono uppercase">Awaiting financial charts parsing...</span>
            )}
          </div>
        </div>

      </div>

      {/* Query Filters */}
      <div className="bg-white p-4 rounded-none border border-[#141414] shadow-none flex flex-wrap gap-2.5 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Services types selector */}
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white border border-[#141414] rounded-none text-xs text-[#141414] focus:outline-none focus:ring-1 focus:ring-[#141414] font-mono"
          >
            <option value="">All Services Items</option>
            <option value="Consultation">Consultation Charges</option>
            <option value="Lab Fee">Laboratory / Scans</option>
            <option value="Pharmacy">Pharmacy Dispensations</option>
            <option value="Emergency Services">Emergency Procedures</option>
          </select>

          {/* Payment Method */}
          <select
            value={selectedPayment}
            onChange={(e) => {
              setSelectedPayment(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white border border-[#141414] rounded-none text-xs text-[#141414] focus:outline-none focus:ring-1 focus:ring-[#141414] font-mono"
          >
            <option value="">All Payment Types</option>
            <option value="Insurance">Insurance Provider Plan</option>
            <option value="Cash">Cash Payments</option>
            <option value="Credit Card">Credit Card Payments</option>
            <option value="Debit Card">Debit Card Payments</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedType('');
            setSelectedPayment('');
            setPage(1);
          }}
          className="px-3.5 py-1.5 bg-[#F0EFEC] hover:bg-[#141414] hover:text-white border border-[#141414] rounded-none text-[#141414] transition-colors cursor-pointer text-xs font-bold uppercase font-mono flex items-center gap-1.5"
          title="Clear filters"
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
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Transaction ID</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Patient ID</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Service Division</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Gross Charge</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Insurance Co-Pay</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">User Out-of-pocket</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Settlement</th>
                <th className="px-5 py-3 text-[10px] font-bold font-serif italic text-[#141414] uppercase tracking-wider">Billing Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141414]/15 text-[#141414] text-xs font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-[#141414]/60">
                    Executing Ingress Transaction Query...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-[#141414]/65">
                    No active synthetic database tuples match your filtration rules.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const outOfPocket = tx.amount - tx.insuranceCoverage;
                  return (
                    <tr key={tx.id} className="hover:bg-[#F0EFEC] transition-all border-b border-[#141414]/10">
                      <td className="px-5 py-3 text-[#141414] font-bold text-xs">{tx.id}</td>
                      <td className="px-5 py-3 text-[#0066FF] font-bold underline cursor-pointer">{tx.patientId}</td>
                      <td className="px-5 py-3">
                        <span className={`px-1.5 py-0.5 border border-[#141414] font-black text-[9px] uppercase ${
                          tx.type === 'Consultation' ? 'bg-[#0033CC] text-white' :
                          tx.type === 'Lab Fee' ? 'bg-[#CC6600]/20 text-[#141414]' :
                          tx.type === 'Pharmacy' ? 'bg-[#00CC66]/20 text-[#141414]' :
                          'bg-[#141414] text-white'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[#141414] font-black">${tx.amount}</td>
                      <td className="px-5 py-3 text-[#00CC66] font-bold">${tx.insuranceCoverage}</td>
                      <td className="px-5 py-3 text-[#FF3300] font-bold">${outOfPocket}</td>
                      <td className="px-5 py-3 font-sans font-bold text-[#141414]/80 uppercase text-[10px]">{tx.paymentType}</td>
                      <td className="px-5 py-3 text-[#141414]/60 text-[10px]">
                        {new Date(tx.date).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })
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
