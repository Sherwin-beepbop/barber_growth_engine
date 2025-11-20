import { useEffect, useState } from 'react';
import { useBusiness } from '../contexts/BusinessContext';
import { supabase, Database } from '../lib/supabase';
import { Users, Search, Plus, X, Phone, Mail, Calendar, DollarSign, TrendingUp, Edit2, Check } from 'lucide-react';

type Customer = Database['public']['Tables']['customers']['Row'];
type Appointment = Database['public']['Tables']['appointments']['Row'] & {
  service: { name: string } | null;
};

export default function CustomersPage() {
  const { business } = useBusiness();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'valuable' | 'inactive'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (business) {
      fetchCustomers();
    }
  }, [business]);

  useEffect(() => {
    applyFilters();
  }, [customers, searchQuery, filterType]);

  const fetchCustomers = async () => {
    if (!business) return;

    try {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', business.id)
        .order('total_spent', { ascending: false });

      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...customers];

    if (searchQuery) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
      );
    }

    if (filterType === 'valuable') {
      filtered = filtered.sort((a, b) => b.total_spent - a.total_spent).slice(0, 10);
    } else if (filterType === 'inactive') {
      const threeWeeksAgo = new Date();
      threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
      filtered = filtered.filter(c =>
        c.last_visit_date && new Date(c.last_visit_date) < threeWeeksAgo
      );
    }

    setFilteredCustomers(filtered);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-zinc-800 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Customers</h1>
          <p className="text-zinc-400">Manage your client relationships</p>
        </div>
        <button
          onClick={() => setShowNewCustomer(true)}
          className="flex items-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Customer
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('valuable')}
              className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                filterType === 'valuable'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              Top 10
            </button>
            <button
              onClick={() => setFilterType('inactive')}
              className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                filterType === 'inactive'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              Inactive
            </button>
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">No customers found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => setSelectedCustomer(customer.id)}
                className="flex items-center gap-4 p-4 bg-zinc-800 hover:bg-zinc-750 rounded-lg transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center">
                  <span className="text-zinc-950 font-semibold">
                    {customer.name.charAt(0).toUpperCase()}
                  </span>
                </div>

                <div className="flex-1">
                  <p className="text-white font-medium">{customer.name}</p>
                  <p className="text-zinc-400 text-sm">{customer.phone}</p>
                </div>

                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-zinc-400">Visits</p>
                    <p className="text-white font-semibold">{customer.total_visits}</p>
                  </div>

                  <div className="text-center">
                    <p className="text-zinc-400">Spent</p>
                    <p className="text-emerald-400 font-semibold">€{Number(customer.total_spent).toFixed(0)}</p>
                  </div>

                  <div className="text-center">
                    <p className="text-zinc-400">Last Visit</p>
                    <p className="text-white font-semibold">
                      {customer.last_visit_date
                        ? new Date(customer.last_visit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : 'Never'}
                    </p>
                  </div>
                </div>

                {customer.label && (
                  <span className="px-3 py-1 bg-amber-500/10 text-amber-500 text-xs font-medium rounded-full border border-amber-500/20">
                    {customer.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedCustomer && (
        <CustomerDetailModal
          customerId={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}

      {showNewCustomer && (
        <NewCustomerModal
          businessId={business!.id}
          onClose={() => setShowNewCustomer(false)}
          onSuccess={() => {
            setShowNewCustomer(false);
            fetchCustomers();
          }}
        />
      )}
    </div>
  );
}

function CustomerDetailModal({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingInterval, setEditingInterval] = useState(false);
  const [intervalValue, setIntervalValue] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCustomerDetails();
  }, [customerId]);

  const fetchCustomerDetails = async () => {
    try {
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select(`
          *,
          service:services(name)
        `)
        .eq('customer_id', customerId)
        .order('appointment_date', { ascending: false })
        .limit(10);

      setCustomer(customerData);
      setIntervalValue(customerData?.average_interval_weeks || null);
      setAppointments((appointmentsData as Appointment[]) || []);
    } catch (error) {
      console.error('Error fetching customer details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInterval = async () => {
    if (!customer) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          average_interval_weeks: intervalValue || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id);

      if (error) throw error;

      setCustomer({
        ...customer,
        average_interval_weeks: intervalValue || null
      });
      setEditingInterval(false);
    } catch (error) {
      console.error('Error updating interval:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !customer) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-2xl">
          <div className="animate-pulse">
            <div className="h-6 bg-zinc-800 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-zinc-800 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-white">{customer.name}</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-zinc-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-4 h-4 text-zinc-500" />
              <p className="text-zinc-400 text-sm">Phone</p>
            </div>
            <p className="text-white font-medium">{customer.phone}</p>
          </div>

          {customer.email && (
            <div className="p-4 bg-zinc-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-zinc-500" />
                <p className="text-zinc-400 text-sm">Email</p>
              </div>
              <p className="text-white font-medium">{customer.email}</p>
            </div>
          )}

          <div className="p-4 bg-zinc-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-zinc-500" />
              <p className="text-zinc-400 text-sm">Total Visits</p>
            </div>
            <p className="text-white font-medium text-xl">{customer.total_visits}</p>
          </div>

          <div className="p-4 bg-zinc-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-zinc-500" />
              <p className="text-zinc-400 text-sm">Total Spent</p>
            </div>
            <p className="text-emerald-400 font-medium text-xl">€{Number(customer.total_spent).toFixed(2)}</p>
          </div>

          <div className="p-4 bg-zinc-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-zinc-500" />
              <p className="text-zinc-400 text-sm">Last Visit</p>
            </div>
            <p className="text-white font-medium">
              {customer.last_visit_date
                ? new Date(customer.last_visit_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })
                : 'Never'}
            </p>
          </div>

          <div className="p-4 bg-zinc-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-zinc-500" />
                <p className="text-zinc-400 text-sm">Avg Interval</p>
              </div>
              {!editingInterval ? (
                <button
                  onClick={() => setEditingInterval(true)}
                  className="p-1 hover:bg-zinc-700 rounded transition-colors"
                  title="Edit interval"
                >
                  <Edit2 className="w-4 h-4 text-amber-500" />
                </button>
              ) : (
                <button
                  onClick={handleSaveInterval}
                  disabled={saving}
                  className="p-1 hover:bg-zinc-700 rounded transition-colors disabled:opacity-50"
                  title="Save interval"
                >
                  <Check className="w-4 h-4 text-emerald-500" />
                </button>
              )}
            </div>
            {editingInterval ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={intervalValue || ''}
                  onChange={(e) => setIntervalValue(e.target.value ? parseInt(e.target.value) : null)}
                  min={1}
                  max={52}
                  placeholder="Auto"
                  className="w-20 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-white text-sm">weeks</span>
              </div>
            ) : (
              <p className="text-white font-medium">
                {customer.average_interval_weeks ? `${customer.average_interval_weeks} weeks` : 'Auto'}
              </p>
            )}
            {editingInterval && (
              <p className="text-xs text-zinc-500 mt-1">Leave empty to use business default</p>
            )}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Visit History</h3>
          {appointments.length === 0 ? (
            <p className="text-zinc-400 text-center py-8">No appointments yet</p>
          ) : (
            <div className="space-y-2">
              {appointments.map((appointment) => (
                <div key={appointment.id} className="flex items-center gap-4 p-3 bg-zinc-800 rounded-lg">
                  <div className="text-sm text-zinc-400 min-w-[100px]">
                    {new Date(appointment.appointment_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                  <div className="flex-1">
                    <p className="text-white">{appointment.service?.name}</p>
                  </div>
                  <div className="text-emerald-400 font-medium">
                    €{Number(appointment.amount).toFixed(2)}
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${
                    appointment.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                    appointment.status === 'scheduled' ? 'bg-blue-500/10 text-blue-500' :
                    'bg-red-500/10 text-red-500'
                  }`}>
                    {appointment.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewCustomerModal({
  businessId,
  onClose,
  onSuccess
}: {
  businessId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('customers')
        .insert({
          business_id: businessId,
          name,
          phone,
          email: email || null,
          total_visits: 0,
          total_spent: 0
        });

      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Error creating customer:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">New Customer</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="+31 6 1234 5678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="john@example.com"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
