import { useEffect, useState } from 'react';
import { useBusiness } from '../contexts/BusinessContext';
import { supabase, Database } from '../lib/supabase';
import { Calendar, Plus, ChevronLeft, ChevronRight, Clock, DollarSign, X, ChevronDown } from 'lucide-react';

type Appointment = Database['public']['Tables']['appointments']['Row'] & {
  customer: { name: string; phone: string } | null;
  service: { name: string } | null;
  barber: { name: string } | null;
};

type Service = Database['public']['Tables']['services']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];
type Barber = Database['public']['Tables']['barbers']['Row'];

export default function BookingsPage() {
  const { business } = useBusiness();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    if (business) {
      fetchData();
    }
  }, [business, selectedDate]);

  const fetchData = async () => {
    if (!business) return;

    try {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select(`
          *,
          customer:customers(name, phone),
          service:services(name),
          barber:barbers(name)
        `)
        .eq('business_id', business.id)
        .eq('appointment_date', dateStr)
        .order('appointment_time');

      const { data: servicesData } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', business.id)
        .eq('active', true);

      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', business.id)
        .order('name');

      const { data: barbersData } = await supabase
        .from('barbers')
        .select('*')
        .eq('business_id', business.id)
        .eq('active', true)
        .order('name');

      setAppointments((appointmentsData as Appointment[]) || []);
      setServices(servicesData || []);
      setCustomers(customersData || []);
      setBarbers(barbersData || []);
    } catch (error) {
      console.error('Error fetching bookings data:', error);
    } finally {
      setLoading(false);
    }
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'cancelled':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'no_show':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      default:
        return 'bg-zinc-700 text-zinc-400 border-zinc-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'Scheduled';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      case 'no_show':
        return 'No Show';
      default:
        return status;
    }
  };

  const updateAppointmentStatus = async (appointmentId: string, newStatus: string) => {
    setUpdatingStatus(appointmentId);
    setOpenDropdown(null);

    const oldAppointments = [...appointments];

    setAppointments(appointments.map(apt =>
      apt.id === appointmentId ? { ...apt, status: newStatus as any } : apt
    ));

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating appointment status:', error);
      setAppointments(oldAppointments);
      alert('Failed to update appointment status. Please try again.');
    } finally {
      setUpdatingStatus(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-zinc-800 rounded-xl"></div>
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
          <h1 className="text-3xl font-bold text-white mb-2">Bookings</h1>
          <p className="text-zinc-400">Manage your appointments</p>
        </div>
        <button
          onClick={() => setShowNewAppointment(true)}
          className="flex items-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Appointment
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => changeDate(-1)}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-zinc-400" />
          </button>

          <div className="text-center">
            <h2 className="text-xl font-semibold text-white">
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </h2>
          </div>

          <button
            onClick={() => changeDate(1)}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {appointments.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">No appointments for this day</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center gap-4 p-4 bg-zinc-800 rounded-lg hover:bg-zinc-750 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-[100px]">
                  <Clock className="w-4 h-4 text-zinc-500" />
                  <span className="text-white font-medium">
                    {appointment.appointment_time.slice(0, 5)}
                  </span>
                </div>

                <div className="flex-1">
                  <p className="text-white font-medium">{appointment.customer?.name}</p>
                  <p className="text-zinc-400 text-sm">
                    {appointment.service?.name}
                    {appointment.barber && (
                      <span className="ml-2 text-zinc-500">· {appointment.barber.name}</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <span className="text-white font-medium">€{Number(appointment.amount).toFixed(2)}</span>
                </div>

                <div className="relative">
                  <button
                    onClick={() => setOpenDropdown(openDropdown === appointment.id ? null : appointment.id)}
                    disabled={updatingStatus === appointment.id}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition-all ${getStatusColor(appointment.status)} ${updatingStatus === appointment.id ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-80 cursor-pointer'}`}
                  >
                    {updatingStatus === appointment.id ? (
                      <span className="animate-pulse">Updating...</span>
                    ) : (
                      <>
                        <span>{getStatusLabel(appointment.status)}</span>
                        <ChevronDown className="w-3 h-3" />
                      </>
                    )}
                  </button>

                  {openDropdown === appointment.id && updatingStatus !== appointment.id && (
                    <div className="absolute right-0 top-full mt-1 w-40 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-10 overflow-hidden">
                      {['scheduled', 'completed', 'cancelled', 'no_show'].map(status => (
                        <button
                          key={status}
                          onClick={() => updateAppointmentStatus(appointment.id, status)}
                          className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                            appointment.status === status
                              ? 'bg-zinc-700 text-white font-medium'
                              : 'text-zinc-300 hover:bg-zinc-700'
                          }`}
                        >
                          {getStatusLabel(status)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNewAppointment && (
        <NewAppointmentModal
          business={business!}
          services={services}
          customers={customers}
          barbers={barbers}
          selectedDate={selectedDate}
          onClose={() => setShowNewAppointment(false)}
          onSuccess={() => {
            setShowNewAppointment(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function NewAppointmentModal({
  business,
  services,
  customers,
  barbers,
  selectedDate,
  onClose,
  onSuccess
}: {
  business: any;
  services: Service[];
  customers: Customer[];
  barbers: Barber[];
  selectedDate: Date;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [customerId, setCustomerId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [barberId, setBarberId] = useState('');
  const [time, setTime] = useState('09:00');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedService = services.find(s => s.id === serviceId);

      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const { error } = await supabase
        .from('appointments')
        .insert({
          business_id: business.id,
          customer_id: customerId,
          service_id: serviceId,
          barber_id: barberId,
          appointment_date: dateStr,
          appointment_time: time,
          duration_minutes: selectedService?.duration_minutes || 30,
          amount: selectedService?.price || 0,
          status: 'scheduled'
        });

      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Error creating appointment:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">New Appointment</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Customer
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select customer</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} - {customer.phone}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Service
            </label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              required
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select service</option>
              {services.map(service => (
                <option key={service.id} value={service.id}>
                  {service.name} - €{Number(service.price).toFixed(2)} ({service.duration_minutes}min)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Barber
            </label>
            <select
              value={barberId}
              onChange={(e) => setBarberId(e.target.value)}
              required
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select barber</option>
              {barbers.map(barber => (
                <option key={barber.id} value={barber.id}>
                  {barber.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
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
