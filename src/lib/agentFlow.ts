// Boosty AI: CBB posts directly to Supabase REST — no agent flow trigger needed.
// File and pattern kept intact for future integration if required.

export type AgentStatus = 'bot' | 'Human_AccountExists' | 'Human_DepositMade' | 'Human_Trash';

export async function sendAgentFlowTrigger({
  contactId,
  agentStatus,
}: {
  contactId: string;
  agentStatus: AgentStatus;
}): Promise<unknown> {
  const trimmed = contactId.trim();
  if (!trimmed) throw new Error('Missing contactId');

  console.warn('[Agent Flow] trigger-agent-flow is disabled for Boosty AI. contactId:', trimmed, 'agentStatus:', agentStatus);
  return { success: false, disabled: true };

  /* Pattern reference — re-enable and update if agent flow is added:
  const { data, error } = await supabase.functions.invoke('trigger-agent-flow', {
    body: { contactId: trimmed, agentStatus },
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(`API failed: ${JSON.stringify(data)}`);
  return data;
  */
}
