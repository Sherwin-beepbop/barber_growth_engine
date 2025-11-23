import { useEffect, useState } from 'react';
import { Calendar, Clock, Coffee, Save, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusiness } from '../contexts/BusinessContext';

interface WeeklySchedule {
  id?: string;
  weekday: number;
  work_start_time: string;
  work_end_time: string;
  break_start_time: string | null;
  break_end_time: string | null;
  is_active: boolean;
}

interface Barber {
  id: string;
  name: string;
}

const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const DEFAULT_SCHEDULE: WeeklySchedule = {
  weekday: 1,
  work_start_time: '09:00',
  work_end_time: '17:00',
  break_start_time: null,
  break_end_time: null,
  is_active: false,
};

export default function BarberSchedulePage() {
  const { business } = useBusiness();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState<string>('');
  const [schedules, setSchedules] = useState<WeeklySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (business) {
      loadBarbers();
    }
  }, [business]);

  useEffect(() => {
    if (selectedBarberId) {
      loadSchedules();
    }
  }, [selectedBarberId]);

  const loadBarbers = async () => {
    if (!business) return;

    try {
      const { data, error } = await supabase
        .from('barbers')
        .select('id, name')
        .eq('business_id', business.id)
        .order('name');

      if (error) throw error;
      setBarbers(data || []);

      if (data && data.length > 0 && !selectedBarberId) {
        setSelectedBarberId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading barbers:', error);
      showMessage('error', 'Failed to load barbers');
    } finally {
      setLoading(false);
    }
  };

  const loadSchedules = async () => {
    if (!business || !selectedBarberId) return;

    try {
      const { data, error } = await supabase
        .from('barber_weekly_schedules')
        .select('*')
        .eq('business_id', business.id)
        .eq('barber_id', selectedBarberId)
        .order('weekday');

      if (error) throw error;

      const scheduleMap = new Map<number, WeeklySchedule>();
      (data || []).forEach((schedule) => {
        scheduleMap.set(schedule.weekday, {
          id: schedule.id,
          weekday: schedule.weekday,
          work_start_time: schedule.work_start_time,
          work_end_time: schedule.work_end_time,
          break_start_time: schedule.break_start_time,
          break_end_time: schedule.break_end_time,
          is_active: schedule.is_active,
        });
      });

      const allSchedules = WEEKDAYS.map((day) =>
        scheduleMap.get(day.value) || { ...DEFAULT_SCHEDULE, weekday: day.value }
      );

      setSchedules(allSchedules);
    } catch (error) {
      console.error('Error loading schedules:', error);
      showMessage('error', 'Failed to load schedules');
    }
  };

  const updateSchedule = (weekday: number, field: keyof WeeklySchedule, value: any) => {
    setSchedules((prev) =>
      prev.map((schedule) =>
        schedule.weekday === weekday ? { ...schedule, [field]: value } : schedule
      )
    );
  };

  const saveSchedules = async () => {
    if (!business || !selectedBarberId) return;

    setSaving(true);
    try {
      for (const schedule of schedules) {
        if (schedule.id) {
          const { error } = await supabase
            .from('barber_weekly_schedules')
            .update({
              work_start_time: schedule.work_start_time,
              work_end_time: schedule.work_end_time,
              break_start_time: schedule.break_start_time || null,
              break_end_time: schedule.break_end_time || null,
              is_active: schedule.is_active,
              updated_at: new Date().toISOString(),
            })
            .eq('id', schedule.id);

          if (error) throw error;
        } else if (schedule.is_active) {
          const { error } = await supabase
            .from('barber_weekly_schedules')
            .insert({
              business_id: business.id,
              barber_id: selectedBarberId,
              weekday: schedule.weekday,
              work_start_time: schedule.work_start_time,
              work_end_time: schedule.work_end_time,
              break_start_time: schedule.break_start_time || null,
              break_end_time: schedule.break_end_time || null,
              is_active: schedule.is_active,
            });

          if (error) throw error;
        }
      }

      showMessage('success', 'Schedules saved successfully');
      await loadSchedules();
    } catch (error) {
      console.error('Error saving schedules:', error);
      showMessage('error', 'Failed to save schedules');
    } finally {
      setSaving(false);
    }
  };

  const generateAvailability = async () => {
    if (!business) return;

    setSyncing(true);
    try {
      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + 30);

      const { data, error } = await supabase.rpc('sync_barber_schedules_to_availability', {
        p_business_id: business.id,
        p_start_date: today.toISOString().split('T')[0],
        p_end_date: endDate.toISOString().split('T')[0],
      });

      if (error) throw error;

      showMessage(
        'success',
        `Generated availability for next 30 days! Created ${data.blocks_created} blocks, skipped ${data.blocks_skipped} duplicates.`
      );
    } catch (error) {
      console.error('Error generating availability:', error);
      showMessage('error', 'Failed to generate availability');
    } finally {
      setSyncing(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (barbers.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-yellow-900 mb-2">No Barbers Found</h3>
        <p className="text-yellow-700">
          Please add barbers to your business before setting up schedules.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Barber Schedule</h1>
          <p className="text-gray-600 mt-1">Set up weekly recurring schedules for your barbers</p>
        </div>
        <Calendar className="w-8 h-8 text-blue-600" />
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Barber</label>
          <select
            value={selectedBarberId}
            onChange={(e) => setSelectedBarberId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {barbers.map((barber) => (
              <option key={barber.id} value={barber.id}>
                {barber.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          {WEEKDAYS.map((day, index) => {
            const schedule = schedules[index];
            if (!schedule) return null;

            return (
              <div
                key={day.value}
                className={`border rounded-lg p-4 ${
                  schedule.is_active ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-4 mb-3">
                  <input
                    type="checkbox"
                    checked={schedule.is_active}
                    onChange={(e) => updateSchedule(day.value, 'is_active', e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="font-medium text-gray-900 w-24">{day.label}</span>
                </div>

                {schedule.is_active && (
                  <div className="ml-9 space-y-3">
                    <div className="flex items-center gap-4">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700 w-16">Work:</label>
                        <input
                          type="time"
                          value={schedule.work_start_time}
                          onChange={(e) =>
                            updateSchedule(day.value, 'work_start_time', e.target.value)
                          }
                          className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <span className="text-gray-500">to</span>
                        <input
                          type="time"
                          value={schedule.work_end_time}
                          onChange={(e) =>
                            updateSchedule(day.value, 'work_end_time', e.target.value)
                          }
                          className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <Coffee className="w-4 h-4 text-gray-400" />
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700 w-16">Break:</label>
                        <input
                          type="time"
                          value={schedule.break_start_time || ''}
                          onChange={(e) =>
                            updateSchedule(day.value, 'break_start_time', e.target.value || null)
                          }
                          className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <span className="text-gray-500">to</span>
                        <input
                          type="time"
                          value={schedule.break_end_time || ''}
                          onChange={(e) =>
                            updateSchedule(day.value, 'break_end_time', e.target.value || null)
                          }
                          className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <span className="text-xs text-gray-500">(optional)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={saveSchedules}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Schedule'}
          </button>

          <button
            onClick={generateAvailability}
            disabled={syncing}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Zap className="w-4 h-4" />
            {syncing ? 'Generating...' : 'Generate Availability for Next 30 Days'}
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">How it works</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Set up a weekly schedule for each barber with work hours and optional breaks</li>
          <li>Click "Generate Availability" to create availability blocks for the next 30 days</li>
          <li>The system will skip any dates that already have matching availability blocks</li>
          <li>You can still manually add or edit individual availability blocks as needed</li>
        </ul>
      </div>
    </div>
  );
}
