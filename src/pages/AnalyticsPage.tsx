import { useEffect, useState } from 'react';
import { useBusiness } from '../contexts/BusinessContext';
import { supabase } from '../lib/supabase';
import { TrendingUp, Users, DollarSign, Calendar, ArrowUp, ArrowDown } from 'lucide-react';

interface AnalyticsData {
  dailyRevenue: { date: string; amount: number }[];
  customerStats: {
    total: number;
    new: number;
    returning: number;
    retentionRate: number;
  };
  topCustomers: {
    name: string;
    totalSpent: number;
    visits: number;
  }[];
  weeklyComparison: {
    thisWeek: number;
    lastWeek: number;
    change: number;
  };
}

export default function AnalyticsPage() {
  const { business } = useBusiness();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    dailyRevenue: [],
    customerStats: { total: 0, new: 0, returning: 0, retentionRate: 0 },
    topCustomers: [],
    weeklyComparison: { thisWeek: 0, lastWeek: 0, change: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');

  useEffect(() => {
    if (business) {
      fetchAnalytics();
    }
  }, [business, timeRange]);

  const fetchAnalytics = async () => {
    if (!business) return;

    try {
      const today = new Date();
      const daysBack = timeRange === 'week' ? 7 : 30;
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - daysBack);

      const { data: appointments } = await supabase
        .from('appointments')
        .select('appointment_date, amount, customer_id')
        .eq('business_id', business.id)
        .eq('status', 'completed')
        .gte('appointment_date', startDate.toISOString().split('T')[0])
        .order('appointment_date');

      const revenueByDate = new Map<string, number>();
      appointments?.forEach(apt => {
        const date = apt.appointment_date;
        revenueByDate.set(date, (revenueByDate.get(date) || 0) + Number(apt.amount));
      });

      const dailyRevenue = Array.from(revenueByDate.entries()).map(([date, amount]) => ({
        date,
        amount
      }));

      const { data: allCustomers } = await supabase
        .from('customers')
        .select('id, name, total_spent, total_visits, created_at')
        .eq('business_id', business.id);

      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const newCustomers = allCustomers?.filter(
        c => new Date(c.created_at) > thirtyDaysAgo
      ).length || 0;
      const returningCustomers = allCustomers?.filter(c => c.total_visits > 1).length || 0;
      const totalCustomers = allCustomers?.length || 0;
      const retentionRate = totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;

      const topCustomers = (allCustomers || [])
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, 10)
        .map(c => ({
          name: c.name,
          totalSpent: Number(c.total_spent),
          visits: c.total_visits
        }));

      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const twoWeeksAgo = new Date(today);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const { data: thisWeekAppts } = await supabase
        .from('appointments')
        .select('amount')
        .eq('business_id', business.id)
        .eq('status', 'completed')
        .gte('appointment_date', weekAgo.toISOString().split('T')[0]);

      const { data: lastWeekAppts } = await supabase
        .from('appointments')
        .select('amount')
        .eq('business_id', business.id)
        .eq('status', 'completed')
        .gte('appointment_date', twoWeeksAgo.toISOString().split('T')[0])
        .lt('appointment_date', weekAgo.toISOString().split('T')[0]);

      const thisWeekRevenue = thisWeekAppts?.reduce((sum, a) => sum + Number(a.amount), 0) || 0;
      const lastWeekRevenue = lastWeekAppts?.reduce((sum, a) => sum + Number(a.amount), 0) || 0;
      const change = lastWeekRevenue > 0
        ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100
        : 0;

      setAnalytics({
        dailyRevenue,
        customerStats: {
          total: totalCustomers,
          new: newCustomers,
          returning: returningCustomers,
          retentionRate: Math.round(retentionRate)
        },
        topCustomers,
        weeklyComparison: {
          thisWeek: thisWeekRevenue,
          lastWeek: lastWeekRevenue,
          change: Math.round(change)
        }
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-2 gap-6 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-zinc-800 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const maxRevenue = Math.max(...analytics.dailyRevenue.map(d => d.amount), 1);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Growth Analytics</h1>
          <p className="text-zinc-400">Detailed business insights and metrics</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setTimeRange('week')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeRange === 'week'
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeRange === 'month'
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Last 30 Days
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            {analytics.weeklyComparison.change !== 0 && (
              <div className={`flex items-center gap-1 text-sm ${
                analytics.weeklyComparison.change > 0 ? 'text-emerald-500' : 'text-red-500'
              }`}>
                {analytics.weeklyComparison.change > 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                {Math.abs(analytics.weeklyComparison.change)}%
              </div>
            )}
          </div>
          <p className="text-zinc-400 text-sm mb-1">This Week Revenue</p>
          <p className="text-3xl font-bold text-white">€{analytics.weeklyComparison.thisWeek.toFixed(2)}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
          </div>
          <p className="text-zinc-400 text-sm mb-1">Total Customers</p>
          <p className="text-3xl font-bold text-white">{analytics.customerStats.total}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-500" />
            </div>
          </div>
          <p className="text-zinc-400 text-sm mb-1">New Customers (30d)</p>
          <p className="text-3xl font-bold text-white">{analytics.customerStats.new}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-amber-500" />
            </div>
          </div>
          <p className="text-zinc-400 text-sm mb-1">Retention Rate</p>
          <p className="text-3xl font-bold text-white">{analytics.customerStats.retentionRate}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Revenue Over Time</h2>

          {analytics.dailyRevenue.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400">No revenue data yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {analytics.dailyRevenue.map((day) => (
                <div key={day.date} className="flex items-center gap-3">
                  <div className="w-24 text-sm text-zinc-400">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="flex-1 h-8 bg-zinc-800 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg flex items-center justify-end pr-2"
                      style={{ width: `${(day.amount / maxRevenue) * 100}%` }}
                    >
                      <span className="text-xs font-semibold text-zinc-950">
                        €{day.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Customer Distribution</h2>

          <div className="space-y-4">
            <div className="p-4 bg-zinc-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-300">New Customers</span>
                <span className="text-white font-semibold">{analytics.customerStats.new}</span>
              </div>
              <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${analytics.customerStats.total > 0
                      ? (analytics.customerStats.new / analytics.customerStats.total) * 100
                      : 0}%`
                  }}
                />
              </div>
            </div>

            <div className="p-4 bg-zinc-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-300">Returning Customers</span>
                <span className="text-white font-semibold">{analytics.customerStats.returning}</span>
              </div>
              <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${analytics.customerStats.total > 0
                      ? (analytics.customerStats.returning / analytics.customerStats.total) * 100
                      : 0}%`
                  }}
                />
              </div>
            </div>

            <div className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/10 border border-amber-500/20 rounded-lg">
              <p className="text-zinc-300 text-sm mb-1">Overall Retention</p>
              <p className="text-3xl font-bold text-amber-500">{analytics.customerStats.retentionRate}%</p>
              <p className="text-zinc-400 text-xs mt-1">
                of customers return for multiple visits
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Top Customers</h2>

        {analytics.topCustomers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">No customer data yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {analytics.topCustomers.map((customer, index) => (
              <div
                key={customer.name}
                className="flex items-center gap-4 p-4 bg-zinc-800 rounded-lg"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-zinc-950 font-bold text-sm">{index + 1}</span>
                </div>

                <div className="flex-1">
                  <p className="text-white font-medium">{customer.name}</p>
                  <p className="text-zinc-400 text-sm">{customer.visits} visits</p>
                </div>

                <div className="text-right">
                  <p className="text-emerald-400 font-bold">€{customer.totalSpent.toFixed(2)}</p>
                  <p className="text-zinc-500 text-xs">total spent</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
