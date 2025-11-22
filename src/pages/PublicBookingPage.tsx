import { useEffect, useState } from 'react';
import { supabase, Database } from '../lib/supabase';
import { normalizePhoneNumber } from '../lib/phoneUtils';
import { Scissors, Check, X, Phone, Users, Calendar, Clock, ChevronRight, ChevronLeft } from 'lucide-react';

type Business = Database['public']['Tables']['businesses']['Row'];
type Service = Database['public']['Tables']['services']['Row'];
type Barber = Database['public']['Tables']['barbers']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];
type AvailabilityBlock = Database['public']['Tables']['availability_blocks']['Row'];
type Appointment = Database['public']['Tables']['appointments']['Row'];

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(dateString: string, format: 'short' | 'long' = 'long'): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (format === 'short') {
    return date.toLocaleDateString('nl-NL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  }

  return date.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export default function PublicBookingPage() {
  const pathParts = window.location.pathname.split('/');
  const businessId = pathParts[pathParts.length - 1];

  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [currentStep, setCurrentStep] = useState(1);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerFirstName, setCustomerFirstName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchBusinessData();
  }, [businessId]);

  const fetchBusinessData = async () => {
    if (!businessId) {
      // No businessId in URL - cannot proceed
      setError('Invalid booking link');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Fetch business data
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .maybeSingle();

      // Handle Supabase errors
      if (businessError) {
        console.error('Error fetching business:', businessError);
        setError('Failed to load booking information');
        setLoading(false);
        return;
      }

      // Business not found
      if (!businessData) {
        setError('Business not found');
        setLoading(false);
        return;
      }

      // Business exists but online booking is disabled
      if (businessData.booking_mode === 'internal_only') {
        setError('Online booking is not available for this business');
        setLoading(false);
        return;
      }

      // Fetch services and barbers
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', businessId)
        .eq('active', true)
        .order('price');

      const { data: barbersData, error: barbersError } = await supabase
        .from('barbers')
        .select('*')
        .eq('business_id', businessId)
        .eq('active', true)
        .order('name');

      // Handle errors in fetching services/barbers
      if (servicesError || barbersError) {
        console.error('Error fetching services/barbers:', servicesError || barbersError);
        setError('Failed to load booking information');
        setLoading(false);
        return;
      }

      // Success: set all data
      setBusiness(businessData);
      setServices(servicesData || []);
      setBarbers(barbersData || []);
      setLoading(false);
    } catch (err) {
      // Catch any unexpected errors
      console.error('Unexpected error fetching booking data:', err);
      setError('Failed to load booking information');
      setLoading(false);
    }
  };

  // LOADING STATE: Show spinner only while fetching data
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-zinc-800 rounded-full mx-auto mb-4"></div>
          <div className="h-4 bg-zinc-800 rounded w-48"></div>
        </div>
      </div>
    );
  }

  // ERROR STATE: Show error message if something went wrong
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Booking Unavailable</h1>
          <p className="text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  // NO BUSINESS STATE: Should not happen if error handling is correct, but failsafe
  if (!business) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Booking Unavailable</h1>
          <p className="text-zinc-400">Business not found</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Booking Confirmed!</h1>
          <p className="text-zinc-400 mb-6">
            Your appointment has been scheduled. We'll see you on{' '}
            {formatDateForDisplay(selectedDate)} at {selectedTime}.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded-lg transition-colors"
          >
            Book Another Appointment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl mb-4">
            <Scissors className="w-8 h-8 text-zinc-950" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{business?.name}</h1>
          <p className="text-zinc-400">Book your next appointment</p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                  step === currentStep
                    ? 'bg-amber-500 text-zinc-950'
                    : step < currentStep
                    ? 'bg-emerald-500 text-white'
                    : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {step < currentStep ? <Check className="w-5 h-5" /> : step}
                </div>
                {step < 5 && (
                  <div className={`w-full h-1 mx-2 ${step < currentStep ? 'bg-emerald-500' : 'bg-zinc-800'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-zinc-500">
            <span>Phone</span>
            <span>Barber</span>
            <span>Date</span>
            <span>Time</span>
            <span>Confirm</span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          {currentStep === 1 && (
            <PhoneVerificationStep
              businessId={businessId}
              phoneNumber={phoneNumber}
              setPhoneNumber={setPhoneNumber}
              customerFirstName={customerFirstName}
              setCustomerFirstName={setCustomerFirstName}
              customerLastName={customerLastName}
              setCustomerLastName={setCustomerLastName}
              customerEmail={customerEmail}
              setCustomerEmail={setCustomerEmail}
              onNext={(cust) => {
                setCustomer(cust);
                setCurrentStep(2);
              }}
            />
          )}

          {currentStep === 2 && (
            <BarberSelectionStep
              barbers={barbers}
              businessId={businessId}
              selectedBarberId={selectedBarberId}
              setSelectedBarberId={setSelectedBarberId}
              onNext={() => setCurrentStep(3)}
              onBack={() => setCurrentStep(1)}
            />
          )}

          {currentStep === 3 && (
            <ServiceSelectionStep
              services={services}
              selectedService={selectedService}
              setSelectedService={setSelectedService}
              onNext={() => setCurrentStep(4)}
              onBack={() => setCurrentStep(2)}
            />
          )}

          {currentStep === 4 && (
            <DateTimeSelectionStep
              businessId={businessId}
              barberId={selectedBarberId}
              service={selectedService!}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              selectedTime={selectedTime}
              setSelectedTime={setSelectedTime}
              onNext={() => setCurrentStep(5)}
              onBack={() => setCurrentStep(3)}
            />
          )}

          {currentStep === 5 && (
            <ConfirmationStep
              business={business!}
              customer={customer!}
              barbers={barbers}
              selectedBarberId={selectedBarberId}
              selectedService={selectedService!}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              onBack={() => setCurrentStep(4)}
              onSuccess={() => setSuccess(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PhoneVerificationStep({
  businessId,
  phoneNumber,
  setPhoneNumber,
  customerFirstName,
  setCustomerFirstName,
  customerLastName,
  setCustomerLastName,
  customerEmail,
  setCustomerEmail,
  onNext
}: {
  businessId: string;
  phoneNumber: string;
  setPhoneNumber: (phone: string) => void;
  customerFirstName: string;
  setCustomerFirstName: (firstName: string) => void;
  customerLastName: string;
  setCustomerLastName: (lastName: string) => void;
  customerEmail: string;
  setCustomerEmail: (email: string) => void;
  onNext: (customer: Customer) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

  const handleVerifyPhone = async () => {
    setLoading(true);
    setError('');

    try {
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      setPhoneNumber(normalizedPhone);

      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', businessId)
        .eq('phone', normalizedPhone)
        .maybeSingle();

      if (existingCustomer) {
        onNext(existingCustomer);
      } else {
        setShowNameInput(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify phone number');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      const fullName = `${customerFirstName.trim()} ${customerLastName.trim()}`;

      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          business_id: businessId,
          name: fullName,
          phone: normalizedPhone,
          email: customerEmail || null,
          total_visits: 0,
          total_spent: 0
        })
        .select()
        .single();

      if (customerError) throw customerError;
      onNext(newCustomer);
    } catch (err: any) {
      setError(err.message || 'Failed to create customer profile');
    } finally {
      setLoading(false);
    }
  };

  if (showNameInput) {
    return (
      <form onSubmit={handleCreateCustomer} className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Phone className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-semibold text-white">Complete Your Profile</h2>
          </div>
          <p className="text-zinc-400 text-sm mb-4">
            We don't have your details yet. Please tell us your name to continue.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              First Name *
            </label>
            <input
              type="text"
              value={customerFirstName}
              onChange={(e) => setCustomerFirstName(e.target.value)}
              required
              placeholder="John"
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Last Name *
            </label>
            <input
              type="text"
              value={customerLastName}
              onChange={(e) => setCustomerLastName(e.target.value)}
              required
              placeholder="Doe"
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Email (Optional)
          </label>
          <input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="john@example.com"
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating Profile...' : 'Continue'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Phone className="w-5 h-5 text-amber-500" />
          <h2 className="text-xl font-semibold text-white">Enter Your Phone Number</h2>
        </div>
        <p className="text-zinc-400 text-sm">
          We'll use this to identify your booking and send you reminders.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Phone Number
        </label>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          required
          placeholder="+31 6 1234 5678"
          className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleVerifyPhone}
        disabled={loading || !phoneNumber}
        className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Verifying...' : 'Continue'}
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

function BarberSelectionStep({
  barbers,
  businessId,
  selectedBarberId,
  setSelectedBarberId,
  onNext,
  onBack
}: {
  barbers: Barber[];
  businessId: string;
  selectedBarberId: string | null;
  setSelectedBarberId: (id: string | null) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [hasAnyBarberSlots, setHasAnyBarberSlots] = useState(false);

  useEffect(() => {
    checkAnyBarberAvailability();
  }, [businessId]);

  const checkAnyBarberAvailability = async () => {
    const { data } = await supabase
      .from('availability_blocks')
      .select('id')
      .eq('business_id', businessId)
      .is('barber_id', null)
      .limit(1);

    setHasAnyBarberSlots((data?.length || 0) > 0);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-amber-500" />
          <h2 className="text-xl font-semibold text-white">Choose Your Barber</h2>
        </div>
        <p className="text-zinc-400 text-sm">
          Select a barber or choose "No preference" for the first available.
        </p>
      </div>

      <div className="space-y-3">
        {hasAnyBarberSlots && (
          <button
            type="button"
            onClick={() => setSelectedBarberId(null)}
            className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
              selectedBarberId === null
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
            }`}
          >
            <p className="text-white font-medium">No Preference</p>
            <p className="text-zinc-400 text-sm">Any available barber</p>
          </button>
        )}

        {barbers.map((barber) => (
          <button
            key={barber.id}
            type="button"
            onClick={() => setSelectedBarberId(barber.id)}
            className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
              selectedBarberId === barber.id
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
            }`}
          >
            <p className="text-white font-medium">{barber.name}</p>
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center justify-center gap-2 py-3 px-6 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <button
          onClick={onNext}
          disabled={selectedBarberId === undefined}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function ServiceSelectionStep({
  services,
  selectedService,
  setSelectedService,
  onNext,
  onBack
}: {
  services: Service[];
  selectedService: Service | null;
  setSelectedService: (service: Service) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Scissors className="w-5 h-5 text-amber-500" />
          <h2 className="text-xl font-semibold text-white">Select Service</h2>
        </div>
      </div>

      <div className="space-y-3">
        {services.map((service) => (
          <button
            key={service.id}
            type="button"
            onClick={() => setSelectedService(service)}
            className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
              selectedService?.id === service.id
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">{service.name}</p>
                <p className="text-zinc-400 text-sm">
                  {service.duration_minutes} minutes
                </p>
              </div>
              <p className="text-amber-500 font-bold">
                €{Number(service.price).toFixed(2)}
              </p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center justify-center gap-2 py-3 px-6 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!selectedService}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function DateTimeSelectionStep({
  businessId,
  barberId,
  service,
  selectedDate,
  setSelectedDate,
  selectedTime,
  setSelectedTime,
  onNext,
  onBack
}: {
  businessId: string;
  barberId: string | null;
  service: Service;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedTime: string;
  setSelectedTime: (time: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeSlotsError, setTimeSlotsError] = useState<string | null>(null);

  useEffect(() => {
    fetchAvailableDates();
  }, [businessId, barberId]);

  useEffect(() => {
    if (selectedDate) {
      fetchAvailableTimeSlots();
    }
  }, [selectedDate, businessId, barberId]);

  const fetchAvailableDates = async () => {
    setLoading(true);
    try {
      const today = getTodayDateString();
      let query = supabase
        .from('availability_blocks')
        .select('date')
        .eq('business_id', businessId)
        .gte('date', today);

      if (barberId) {
        query = query.eq('barber_id', barberId);
      } else {
        query = query.is('barber_id', null);
      }

      const { data } = await query;

      const uniqueDates = [...new Set(data?.map(block => block.date) || [])];
      setAvailableDates(uniqueDates.sort());
    } catch (err) {
      console.error('Error fetching dates:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTimeSlots = async () => {
    if (!barberId) {
      setAvailableTimeSlots([]);
      return;
    }

    setTimeSlotsError(null);

    try {
      const { data, error } = await supabase.rpc('generate_free_time_slots', {
        p_business_id: businessId,
        p_barber_id: barberId,
        p_date: selectedDate,
        p_service_duration: service.duration_minutes
      });

      if (error) {
        console.error('Error fetching time slots:', error);
        setTimeSlotsError(`Time slot error: ${error.message || 'Unknown error'}`);
        setAvailableTimeSlots([]);
        return;
      }

      setAvailableTimeSlots(data?.free_slots || []);
    } catch (err: any) {
      console.error('Error fetching time slots:', err);
      setTimeSlotsError(`Time slot error: ${err.message || 'Unknown error'}`);
      setAvailableTimeSlots([]);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800 rounded w-3/4"></div>
          <div className="h-32 bg-zinc-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-amber-500" />
          <h2 className="text-xl font-semibold text-white">Choose Date & Time</h2>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-3">
          Select Date
        </label>
        <div className="grid grid-cols-3 gap-2">
          {availableDates.map((date) => (
            <button
              key={date}
              type="button"
              onClick={() => {
                setSelectedDate(date);
                setSelectedTime('');
              }}
              className={`p-3 rounded-lg border-2 text-center transition-colors ${
                selectedDate === date
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
              }`}
            >
              <p className="text-white text-sm font-medium">
                {formatDateForDisplay(date, 'short')}
              </p>
            </button>
          ))}
        </div>
        {availableDates.length === 0 && (
          <p className="text-zinc-400 text-sm mt-2">
            No available dates. Please choose a different barber.
          </p>
        )}
      </div>

      {selectedDate && (
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-3">
            <Clock className="w-4 h-4 inline mr-1" />
            Select Time
          </label>
          <div className="grid grid-cols-4 gap-2">
            {availableTimeSlots.map((time) => (
              <button
                key={time}
                type="button"
                onClick={() => setSelectedTime(time)}
                className={`p-3 rounded-lg border-2 text-center transition-colors ${
                  selectedTime === time
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
                }`}
              >
                <p className="text-white text-sm font-medium">{time}</p>
              </button>
            ))}
          </div>
          {availableTimeSlots.length === 0 && (
            <p className="text-zinc-400 text-sm mt-2">
              No available times for this day.
            </p>
          )}
          {timeSlotsError && (
            <p className="mt-2 text-sm text-red-400">
              {timeSlotsError}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center justify-center gap-2 py-3 px-6 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!selectedDate || !selectedTime}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function ConfirmationStep({
  business,
  customer,
  barbers,
  selectedBarberId,
  selectedService,
  selectedDate,
  selectedTime,
  onBack,
  onSuccess
}: {
  business: Business;
  customer: Customer;
  barbers: Barber[];
  selectedBarberId: string | null;
  selectedService: Service;
  selectedDate: string;
  selectedTime: string;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const barberName = selectedBarberId
    ? barbers.find(b => b.id === selectedBarberId)?.name || 'Unknown'
    : 'Any available barber';

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');

    try {
      // Check for double booking: prevent same barber at same time
      const { data: existingAppointments, error: checkError } = await supabase
        .from('appointments')
        .select('id')
        .eq('business_id', business.id)
        .eq('appointment_date', selectedDate)
        .eq('appointment_time', selectedTime)
        .eq('status', 'scheduled')
        .eq('barber_id', selectedBarberId);

      if (checkError) {
        console.error('Error checking for double booking:', checkError);
        throw new Error('Failed to verify availability');
      }

      // If any scheduled appointment exists for this barber at this time, block the booking
      if (existingAppointments && existingAppointments.length > 0) {
        throw new Error('This time slot is no longer available. Please choose another time.');
      }

      // Proceed with booking if slot is available
      const { error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          business_id: business.id,
          customer_id: customer.id,
          barber_id: selectedBarberId,
          service_id: selectedService.id,
          appointment_date: selectedDate,
          appointment_time: selectedTime,
          duration_minutes: selectedService.duration_minutes,
          amount: selectedService.price,
          status: 'scheduled',
          source: 'online'
        });

      if (appointmentError) throw appointmentError;
      onSuccess();
    } catch (err: any) {
      console.error('Error creating appointment:', err);
      setError(err.message || 'Failed to create appointment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Check className="w-5 h-5 text-amber-500" />
          <h2 className="text-xl font-semibold text-white">Confirm Your Booking</h2>
        </div>
        <p className="text-zinc-400 text-sm">
          Please review your appointment details before confirming.
        </p>
      </div>

      <div className="bg-zinc-800 rounded-lg p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-zinc-400">Customer:</span>
          <span className="text-white font-medium">{customer.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Phone:</span>
          <span className="text-white font-medium">{customer.phone}</span>
        </div>
        <div className="border-t border-zinc-700 pt-3 mt-3"></div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Barber:</span>
          <span className="text-white font-medium">{barberName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Service:</span>
          <span className="text-white font-medium">{selectedService.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Date:</span>
          <span className="text-white font-medium">
            {formatDateForDisplay(selectedDate)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Time:</span>
          <span className="text-white font-medium">{selectedTime}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Duration:</span>
          <span className="text-white font-medium">{selectedService.duration_minutes} minutes</span>
        </div>
        <div className="border-t border-zinc-700 pt-3 mt-3"></div>
        <div className="flex justify-between">
          <span className="text-zinc-400 font-semibold">Total:</span>
          <span className="text-amber-500 font-bold text-lg">
            €{Number(selectedService.price).toFixed(2)}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={submitting}
          className="flex items-center justify-center gap-2 py-3 px-6 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={submitting}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {submitting ? 'Confirming...' : 'Confirm Booking'}
          <Check className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
