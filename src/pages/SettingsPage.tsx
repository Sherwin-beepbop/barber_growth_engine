import { useEffect, useState } from 'react';
import { useBusiness } from '../contexts/BusinessContext';
import { supabase, Database } from '../lib/supabase';
import { Save, Plus, Trash2, Globe, Link as LinkIcon } from 'lucide-react';

type Service = Database['public']['Tables']['services']['Row'];

export default function SettingsPage() {
  const { business, refreshBusiness } = useBusiness();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bookingMode, setBookingMode] = useState<'online' | 'internal_only'>('internal_only');
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [reminderInterval, setReminderInterval] = useState(3);
  const [services, setServices] = useState<Service[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (business) {
      setName(business.name);
      setEmail(business.email || '');
      setPhone(business.phone || '');
      setBookingMode(business.booking_mode);
      setGoogleReviewUrl(business.google_review_url || '');
      setReminderInterval(business.default_reminder_interval_weeks);
      fetchServices();
    }
  }, [business]);

  const fetchServices = async () => {
    if (!business) return;

    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at');

    setServices(data || []);
  };

  const handleSaveBasicInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          name,
          email,
          phone,
          booking_mode: bookingMode,
          google_review_url: googleReviewUrl,
          default_reminder_interval_weeks: reminderInterval,
          updated_at: new Date().toISOString()
        })
        .eq('id', business.id);

      if (error) throw error;
      await refreshBusiness();
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const addService = async () => {
    if (!business) return;

    const { error } = await supabase
      .from('services')
      .insert({
        business_id: business.id,
        name: 'New Service',
        duration_minutes: 30,
        price: 25,
        active: true
      });

    if (!error) {
      fetchServices();
    }
  };

  const updateService = async (service: Service) => {
    const { error } = await supabase
      .from('services')
      .update({
        name: service.name,
        duration_minutes: service.duration_minutes,
        price: service.price,
        active: service.active
      })
      .eq('id', service.id);

    if (!error) {
      fetchServices();
    }
  };

  const deleteService = async (serviceId: string) => {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', serviceId);

    if (!error) {
      fetchServices();
    }
  };

  const bookingUrl = business && bookingMode === 'online'
    ? `${window.location.origin}/book/${business.id}`
    : null;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-zinc-400">Configure your business details</p>
      </div>

      <div className="space-y-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Basic Information</h2>

          <form onSubmit={handleSaveBasicInfo} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Default Reminder Interval (weeks)
                </label>
                <input
                  type="number"
                  value={reminderInterval}
                  onChange={(e) => setReminderInterval(parseInt(e.target.value))}
                  min={1}
                  max={12}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Google Review URL
              </label>
              <input
                type="url"
                value={googleReviewUrl}
                onChange={(e) => setGoogleReviewUrl(e.target.value)}
                placeholder="https://g.page/..."
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Booking Mode</h2>

          <div className="space-y-4">
            <div
              onClick={() => setBookingMode('internal_only')}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                bookingMode === 'internal_only'
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                  bookingMode === 'internal_only' ? 'border-amber-500' : 'border-zinc-600'
                }`}>
                  {bookingMode === 'internal_only' && (
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-medium mb-1">Internal Only</h3>
                  <p className="text-zinc-400 text-sm">
                    Only you can create appointments. No public booking link.
                  </p>
                </div>
              </div>
            </div>

            <div
              onClick={() => setBookingMode('online')}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                bookingMode === 'online'
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                  bookingMode === 'online' ? 'border-amber-500' : 'border-zinc-600'
                }`}>
                  {bookingMode === 'online' && (
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-medium mb-1 flex items-center gap-2">
                    Online Booking
                    <Globe className="w-4 h-4 text-amber-500" />
                  </h3>
                  <p className="text-zinc-400 text-sm mb-3">
                    Customers can book appointments online via a public link.
                  </p>
                  {bookingUrl && (
                    <div className="flex items-center gap-2 p-2 bg-zinc-900 rounded border border-zinc-700">
                      <LinkIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                      <input
                        type="text"
                        value={bookingUrl}
                        readOnly
                        className="flex-1 bg-transparent text-zinc-300 text-sm focus:outline-none"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(bookingUrl);
                        }}
                        className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Services</h2>
            <button
              onClick={addService}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Service
            </button>
          </div>

          <div className="space-y-3">
            {services.map((service) => (
              <ServiceItem
                key={service.id}
                service={service}
                onUpdate={updateService}
                onDelete={deleteService}
              />
            ))}

            {services.length === 0 && (
              <p className="text-center text-zinc-400 py-8">
                No services yet. Add your first service to get started.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceItem({
  service,
  onUpdate,
  onDelete
}: {
  service: Service;
  onUpdate: (service: Service) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(service.name);
  const [duration, setDuration] = useState(service.duration_minutes);
  const [price, setPrice] = useState(Number(service.price));

  const handleSave = () => {
    onUpdate({
      ...service,
      name,
      duration_minutes: duration,
      price
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="p-4 bg-zinc-800 rounded-lg space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Service name"
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            placeholder="Duration (min)"
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(parseFloat(e.target.value))}
            placeholder="Price"
            step="0.01"
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-medium rounded text-sm transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-zinc-800 rounded-lg">
      <div className="flex-1">
        <p className="text-white font-medium">{service.name}</p>
        <p className="text-zinc-400 text-sm">
          {service.duration_minutes} min · €{Number(service.price).toFixed(2)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setEditing(true)}
          className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium rounded transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(service.id)}
          className="p-1.5 hover:bg-red-500/10 rounded transition-colors"
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      </div>
    </div>
  );
}
