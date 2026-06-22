import React, { useState, useEffect } from 'react';
import { Shield, Sparkles, Activity, Clock, ThumbsUp, Star, Award, UserCheck } from 'lucide-react';
import { motion } from 'motion/react';

interface DoctorsProps {
  token: string;
}

export default function DoctorsPanel({ token }: DoctorsProps) {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/doctors', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data && data.data) {
        setDoctors(data.data);
      }
    } catch (err) {
      console.error('Error fetching doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, [token]);

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h2 className="text-xl font-black tracking-tighter text-[#141414] uppercase">SYNTHETIC INGRESS REGISTER: MEDICAL Staff Nodes</h2>
        <p className="text-[10px] font-mono text-[#141414]/60 uppercase mt-0.5">
          Staff roster tracking active clinical physicians, board specialties, and capacity booking metrics.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[#141414]/60 font-mono text-xs">Querying clinician roster partitions...</div>
      ) : doctors.length === 0 ? (
        <div className="text-center py-20 text-[#141414]/65 text-xs font-mono">No physicians database details available.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {doctors.map((doc) => {
            // Simulated satisfaction rating based on doc ID hash
            const rating = 4.3 + (parseInt(doc.id.replace('DR', '')) % 8) * 0.1;
            
            return (
              <div 
                key={doc.id} 
                className="bg-white rounded-none p-5 border border-[#141414] flex flex-col justify-between hover:bg-[#F0EFEC]/20 transition-all border-l-4 border-l-[#0066FF]"
              >
                <div className="space-y-4">
                  
                  {/* Doctor Card header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] font-mono font-bold text-white bg-[#141414] px-1.5 py-0.5 rounded-none uppercase">
                        NODE_{doc.id}
                      </span>
                      <h3 className="text-base font-black text-[#141414] tracking-tight mt-1.5 px-0 uppercase font-sans">{doc.name}</h3>
                      <span className="text-[10px] text-[#141414]/60 uppercase font-mono block">{doc.department} Division</span>
                    </div>
                    
                    {/* Badge */}
                    <div className="p-2 bg-[#F0EFEC] border border-[#141414] rounded-none shrink-0">
                      <UserCheck className="h-4 w-4 text-[#141414]" />
                    </div>
                  </div>
 
                  {/* Attributes */}
                  <div className="space-y-2 pt-3 border-t border-[#141414]/15">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#141414]/70 flex items-center gap-1 font-mono uppercase text-[10px]">
                        <Award className="h-3.5 w-3.5 text-[#141414]" />
                        XP_DURATION:
                      </span>
                      <span className="font-bold text-[#141414] font-mono">{doc.experience} Years</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#141414]/70 flex items-center gap-1 font-mono uppercase text-[10px]">
                        <Star className="h-3.5 w-3.5 text-[#141414]" />
                        SAT_METRIC:
                      </span>
                      <span className="font-bold text-[#141414] font-mono">{rating.toFixed(1)} / 5.0</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#141414]/70 flex items-center gap-1 font-mono uppercase text-[10px]">
                        <Clock className="h-3.5 w-3.5 text-[#141414] shrink-0" />
                        UTIL_RATIO:
                      </span>
                      <span className="font-bold text-[#141414] font-mono">{doc.utilization}% CAPACITY</span>
                    </div>
                  </div>

                  {/* Utilization Bar */}
                  <div className="space-y-1">
                    <div className="h-2.5 w-full bg-[#F0EFEC] border border-[#141414]/30 overflow-hidden">
                      <div 
                        className={`h-full ${
                          doc.utilization > 85 ? 'bg-[#CC6600]' :
                          'bg-[#0066FF]'
                        }`}
                        style={{ width: `${doc.utilization}%` }}
                      />
                    </div>
                  </div>

                </div>

                <div className="flex items-center justify-between border-t border-[#141414]/15 pt-3 mt-4 text-[10px] font-mono">
                  <span className="text-[#141414]/50 uppercase">Rate Base Unit:</span>
                  <span className="font-black text-[#141414]">${doc.consultationFee} / CYCLE</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
