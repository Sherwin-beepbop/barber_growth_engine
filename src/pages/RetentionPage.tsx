import { useEffect, useState } from 'react';
import { useBusiness } from '../contexts/BusinessContext';
import { supabase, Database } from '../lib/supabase';
import { Repeat, MessageSquare, Clock, Star, Target, Settings, Play, CheckCircle, AlertCircle } from 'lucide-react';

type RetentionFlow = Database['public']['Tables']['retention_flows']['Row'];

interface FlowResult {
  flowId: string;
  success: boolean;
  messagesCreated?: number;
  error?: string;
}

const flowConfigs = {
  winback: {
    icon: Target,
    title: 'Winback Flow',
    description: 'Re-engage customers who haven\'t visited in a while',
    defaultTemplate: 'Hi {customer_name}, we miss you at {business_name}! It\'s been a while since your last visit. Book your next appointment and get back to looking your best!'
  },
  freshness: {
    icon: Clock,
    title: 'Freshness Reminder',
    description: 'Remind customers when it\'s time for their next visit',
    defaultTemplate: 'Hey {customer_name}! It\'s about time for your next cut at {business_name}. Book now to keep that fresh look going!'
  },
  thank_you: {
    icon: Star,
    title: 'Thank You + Review',
    description: 'Send appreciation and request reviews after appointments',
    defaultTemplate: 'Thanks for visiting {business_name}, {customer_name}! We hope you love your new look. Mind leaving us a review? {review_link}'
  },
  gap_fill: {
    icon: MessageSquare,
    title: 'Quiet Day Gap-Fill',
    description: 'Fill low-occupancy days with special offers',
    defaultTemplate: 'Hey {customer_name}! We have some availability tomorrow at {business_name}. Book now and get 10% off!'
  }
};

export default function RetentionPage() {
  const { business } = useBusiness();
  const [flows, setFlows] = useState<RetentionFlow[]>([]);
  const [editingFlow, setEditingFlow] = useState<RetentionFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningFlows, setRunningFlows] = useState<Set<string>>(new Set());
  const [flowResults, setFlowResults] = useState<Map<string, FlowResult>>(new Map());

  useEffect(() => {
    if (business) {
      fetchFlows();
    }
  }, [business]);

  const fetchFlows = async () => {
    if (!business) return;

    try {
      const { data } = await supabase
        .from('retention_flows')
        .select('*')
        .eq('business_id', business.id);

      const flowsMap = new Map((data || []).map(f => [f.flow_type, f]));

      const allFlows = Object.keys(flowConfigs).map(flowType => {
        if (flowsMap.has(flowType)) {
          return flowsMap.get(flowType)!;
        }
        return {
          id: '',
          business_id: business.id,
          flow_type: flowType as any,
          enabled: false,
          channel: 'whatsapp' as const,
          trigger_condition: {},
          message_template: flowConfigs[flowType as keyof typeof flowConfigs].defaultTemplate,
          follow_up_enabled: false,
          follow_up_days: null,
          follow_up_template: null,
          created_at: '',
          updated_at: ''
        };
      });

      setFlows(allFlows);
    } catch (error) {
      console.error('Error fetching retention flows:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFlow = async (flow: RetentionFlow) => {
    try {
      if (flow.id) {
        const { error } = await supabase
          .from('retention_flows')
          .update({ enabled: !flow.enabled })
          .eq('id', flow.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('retention_flows')
          .insert({
            business_id: business!.id,
            flow_type: flow.flow_type,
            enabled: true,
            channel: flow.channel,
            message_template: flow.message_template,
            trigger_condition: {},
            follow_up_enabled: false
          });

        if (error) throw error;
      }

      fetchFlows();
    } catch (error) {
      console.error('Error toggling flow:', error);
    }
  };

  const runFlow = async (flow: RetentionFlow) => {
    if (!flow.id || !flow.enabled || !business) return;

    setRunningFlows(prev => new Set(prev).add(flow.id));

    const newResults = new Map(flowResults);
    newResults.delete(flow.id);
    setFlowResults(newResults);

    try {
      let result: any;

      if (flow.flow_type === 'thank_you') {
        setFlowResults(prev => new Map(prev).set(flow.id, {
          flowId: flow.id,
          success: false,
          error: 'Thank You flow runs automatically when appointments are completed'
        }));
        return;
      }

      const functionName = flow.flow_type === 'gap_fill'
        ? 'run_quiet_day_flow'
        : `run_${flow.flow_type}_flow`;

      const { data, error } = await supabase.rpc(functionName, {
        p_business_id: business.id,
        p_flow_id: flow.id
      });

      if (error) throw error;

      result = data as { success: boolean; messages_created: number; error?: string };

      setFlowResults(prev => new Map(prev).set(flow.id, {
        flowId: flow.id,
        success: result.success,
        messagesCreated: result.messages_created,
        error: result.error
      }));

      setTimeout(() => {
        setFlowResults(prev => {
          const updated = new Map(prev);
          updated.delete(flow.id);
          return updated;
        });
      }, 10000);

    } catch (error: any) {
      console.error('Error running flow:', error);
      setFlowResults(prev => new Map(prev).set(flow.id, {
        flowId: flow.id,
        success: false,
        error: error.message || 'Failed to run flow'
      }));
    } finally {
      setRunningFlows(prev => {
        const updated = new Set(prev);
        updated.delete(flow.id);
        return updated;
      });
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
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
        <h1 className="text-3xl font-bold text-white mb-2">Retention Engine</h1>
        <p className="text-zinc-400">Automated customer engagement flows</p>
      </div>

      <div className="space-y-4">
        {flows.map((flow) => {
          const config = flowConfigs[flow.flow_type as keyof typeof flowConfigs];
          const Icon = config.icon;
          const isRunning = runningFlows.has(flow.id);
          const result = flowResults.get(flow.id);

          return (
            <div
              key={flow.flow_type}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-amber-500" />
                  </div>

                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white mb-1">{config.title}</h3>
                    <p className="text-zinc-400 text-sm mb-4">{config.description}</p>

                    {flow.enabled && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400 text-sm">Channel:</span>
                          <span className="px-2 py-1 bg-zinc-800 text-zinc-300 text-sm rounded">
                            {flow.channel.toUpperCase()}
                          </span>
                        </div>

                        <div className="p-3 bg-zinc-800 rounded-lg">
                          <p className="text-zinc-300 text-sm">{flow.message_template}</p>
                        </div>

                        {flow.follow_up_enabled && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-zinc-500" />
                            <span className="text-zinc-400">
                              Follow-up after {flow.follow_up_days} days
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {result && (
                      <div className={`mt-3 p-3 rounded-lg flex items-start gap-2 ${
                        result.success
                          ? 'bg-emerald-500/10 border border-emerald-500/20'
                          : 'bg-red-500/10 border border-red-500/20'
                      }`}>
                        {result.success ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className={`font-medium ${result.success ? 'text-emerald-500' : 'text-red-500'}`}>
                            {result.success
                              ? `Success! ${result.messagesCreated} message${result.messagesCreated !== 1 ? 's' : ''} created`
                              : 'Failed to run flow'}
                          </p>
                          {result.error && (
                            <p className="text-zinc-400 text-sm mt-1">{result.error}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {flow.enabled && flow.id && (
                    <button
                      onClick={() => runFlow(flow)}
                      disabled={isRunning || !flow.enabled}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                    >
                      <Play className={`w-4 h-4 ${isRunning ? 'animate-pulse' : ''}`} />
                      {isRunning ? 'Running...' : 'Run Flow Now'}
                    </button>
                  )}

                  <button
                    onClick={() => setEditingFlow(flow)}
                    className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <Settings className="w-5 h-5 text-zinc-400" />
                  </button>

                  <button
                    onClick={() => toggleFlow(flow)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      flow.enabled ? 'bg-amber-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        flow.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editingFlow && (
        <FlowSettingsModal
          flow={editingFlow}
          onClose={() => setEditingFlow(null)}
          onSuccess={() => {
            setEditingFlow(null);
            fetchFlows();
          }}
        />
      )}
    </div>
  );
}

function FlowSettingsModal({
  flow,
  onClose,
  onSuccess
}: {
  flow: RetentionFlow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [channel, setChannel] = useState<'whatsapp' | 'sms' | 'email'>(flow.channel);
  const [messageTemplate, setMessageTemplate] = useState(flow.message_template || '');
  const [followUpEnabled, setFollowUpEnabled] = useState(flow.follow_up_enabled);
  const [followUpDays, setFollowUpDays] = useState(flow.follow_up_days || 3);
  const [followUpTemplate, setFollowUpTemplate] = useState(flow.follow_up_template || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        channel,
        message_template: messageTemplate,
        follow_up_enabled: followUpEnabled,
        follow_up_days: followUpEnabled ? followUpDays : null,
        follow_up_template: followUpEnabled ? followUpTemplate : null
      };

      if (flow.id) {
        const { error } = await supabase
          .from('retention_flows')
          .update(data)
          .eq('id', flow.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('retention_flows')
          .insert({
            business_id: flow.business_id,
            flow_type: flow.flow_type,
            enabled: false,
            trigger_condition: {},
            ...data
          });

        if (error) throw error;
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving flow settings:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            Configure {flowConfigs[flow.flow_type as keyof typeof flowConfigs].title}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded">
            <span className="text-zinc-400 text-2xl">&times;</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Channel</label>
            <div className="flex gap-2">
              {(['whatsapp', 'sms', 'email'] as const).map(ch => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannel(ch)}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    channel === ch
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {ch.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Message Template
            </label>
            <textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={4}
              required
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Your message template..."
            />
            <p className="text-zinc-500 text-xs mt-2">
              Available variables: {'{customer_name}'}, {'{business_name}'}, {'{review_link}'}
            </p>
          </div>

          <div className="border-t border-zinc-800 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-medium">Follow-up Message</h3>
                <p className="text-zinc-400 text-sm">Send a second message if no response</p>
              </div>
              <button
                type="button"
                onClick={() => setFollowUpEnabled(!followUpEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  followUpEnabled ? 'bg-amber-500' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    followUpEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {followUpEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Days until follow-up
                  </label>
                  <input
                    type="number"
                    value={followUpDays}
                    onChange={(e) => setFollowUpDays(parseInt(e.target.value))}
                    min={1}
                    max={30}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Follow-up Template
                  </label>
                  <textarea
                    value={followUpTemplate}
                    onChange={(e) => setFollowUpTemplate(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Follow-up message..."
                  />
                </div>
              </div>
            )}
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
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
