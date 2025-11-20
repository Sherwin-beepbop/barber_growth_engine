import { useEffect, useState } from 'react';
import { useBusiness } from '../contexts/BusinessContext';
import { supabase } from '../lib/supabase';
import { TrendingUp, Calendar, Users, AlertCircle, MessageSquare, Target } from 'lucide-react';

interface DashboardStats {
  weekRevenue: number;
  weekAppointments: number;
  returningCustomersPercent: number;
  inactiveCustomers: number;
  lowOccupancyDays: number;
}

export default function DashboardPage() {
  const { business } = useBusiness();
  const [stats, setStats] = useState<DashboardStats>({
    weekRevenue: 0,
    weekAppointments: 0,
    returningCustomersPercent: 0,
    inactiveCustomers: 0,
    lowOccupancyDays: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (business) {
      fetchDashboardStats();
    }
  }, [business]);

  const fetchDashboardStats = async () => {
    if (!business) return;

    try {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: weekAppointments } = await supabase
        .from('appointments')
        .select('amount, customer_id')
        .eq('business_id', business.id)
        .gte('appointment_date', weekAgo.toISOString().split('T')[0])
        .eq('status', 'completed');

      const { data: allCustomers } = await supabase
        .from('customers')
        .select('total_visits')
        .eq('business_id', business.id);

      const weekRevenue = weekAppointments?.reduce((sum, apt) => sum + Number(apt.amount), 0) || 0;
      const weekAppointmentsCount = weekAppointments?.length || 0;

      const returningCustomers = allCustomers?.filter(c => c.total_visits > 1).length || 0;
      const totalCustomers = allCustomers?.length || 1;
      const returningPercent = Math.round((returningCustomers / totalCustomers) * 100);

      const threeWeeksAgo = new Date(today);
      threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);

      const { data: inactiveCustomers } = await supabase
        .from('customers')
        .select('id')
        .eq('business_id', business.id)
        .lt('last_visit_date', threeWeeksAgo.toISOString().split('T')[0]);

      setStats({
        weekRevenue,
        weekAppointments: weekAppointmentsCount,
        returningCustomersPercent: returningPercent,
        inactiveCustomers: inactiveCustomers?.length || 0,
        lowOccupancyDays: 0
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800 rounded w-1/4"></div>
          <div className="grid grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-zinc-800 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-zinc-400">Your business at a glance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <p className="text-zinc-400 text-sm mb-1">Revenue This Week</p>
          <p className="text-3xl font-bold text-white">€{stats.weekRevenue.toFixed(2)}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
          </div>
          <p className="text-zinc-400 text-sm mb-1">Appointments This Week</p>
          <p className="text-3xl font-bold text-white">{stats.weekAppointments}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-500" />
            </div>
          </div>
          <p className="text-zinc-400 text-sm mb-1">Returning Customers</p>
          <p className="text-3xl font-bold text-white">{stats.returningCustomersPercent}%</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          Alerts
        </h2>
        <div className="space-y-3">
          {stats.inactiveCustomers > 0 ? (
            <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-white font-medium">Inactive Customers</p>
                <p className="text-zinc-400 text-sm">
                  {stats.inactiveCustomers} customers haven't visited in over 3 weeks
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 bg-zinc-800 rounded-lg">
              <Target className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-white font-medium">All Good!</p>
                <p className="text-zinc-400 text-sm">No alerts at the moment</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button className="flex items-center gap-3 p-4 bg-zinc-800 hover:bg-zinc-750 rounded-lg transition-colors text-left">
            <MessageSquare className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-white font-medium">Start Winback Campaign</p>
              <p className="text-zinc-400 text-sm">Re-engage inactive customers</p>
            </div>
          </button>

          <button className="flex items-center gap-3 p-4 bg-zinc-800 hover:bg-zinc-750 rounded-lg transition-colors text-left">
            <Calendar className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-white font-medium">Send Reminders</p>
              <p className="text-zinc-400 text-sm">Notify customers due for visit</p>
            </div>
          </button>

          <button className="flex items-center gap-3 p-4 bg-zinc-800 hover:bg-zinc-750 rounded-lg transition-colors text-left">
            <Users className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-white font-medium">View Top Customers</p>
              <p className="text-zinc-400 text-sm">See your most valuable clients</p>
            </div>
          </button>

          <button className="flex items-center gap-3 p-4 bg-zinc-800 hover:bg-zinc-750 rounded-lg transition-colors text-left">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-white font-medium">View Analytics</p>
              <p className="text-zinc-400 text-sm">Detailed business insights</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
