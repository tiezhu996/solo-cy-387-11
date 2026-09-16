import type {
  PropertyItem,
  RepairTicket,
  Staff,
  TransferRecord,
} from '../types/domain';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    let payload: { error?: { message?: string } } = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
    throw new Error(payload.error?.message ?? `请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

export async function getProperties(): Promise<PropertyItem[]> {
  return request<PropertyItem[]>('/properties/');
}

// ---------- 报修 ----------

export async function createRepair(
  ticket: Pick<RepairTicket, 'faultType' | 'description'>,
): Promise<RepairTicket> {
  return request<RepairTicket>('/repairs/', {
    method: 'POST',
    body: JSON.stringify(ticket),
  });
}

export async function listRepairs(): Promise<RepairTicket[]> {
  return request<RepairTicket[]>('/repairs/');
}

export async function getRepair(id: number): Promise<RepairTicket> {
  return request<RepairTicket>(`/repairs/${id}/`);
}

export async function acceptRepair(id: number, staffId: number): Promise<RepairTicket> {
  return request<RepairTicket>(`/repairs/${id}/accept`, {
    method: 'POST',
    body: JSON.stringify({ staffId }),
  });
}

export async function completeRepair(id: number, staffId: number): Promise<RepairTicket> {
  return request<RepairTicket>(`/repairs/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ staffId }),
  });
}

// ---------- 转派 ----------

export async function listTransfers(ticketId: number): Promise<TransferRecord[]> {
  return request<TransferRecord[]>(`/repairs/${ticketId}/transfers/`);
}

export async function createTransfer(
  ticketId: number,
  payload: { staffId: number; targetStaffId: number; reason: string },
): Promise<TransferRecord> {
  return request<TransferRecord>(`/repairs/${ticketId}/transfers/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface TransferDecision {
  ticket: RepairTicket;
  transfer: TransferRecord;
}

export async function acceptTransfer(transferId: number, staffId: number): Promise<TransferDecision> {
  return request<TransferDecision>(`/transfers/${transferId}/accept`, {
    method: 'POST',
    body: JSON.stringify({ staffId }),
  });
}

export async function rejectTransfer(transferId: number, staffId: number): Promise<TransferDecision> {
  return request<TransferDecision>(`/transfers/${transferId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ staffId }),
  });
}

// ---------- 物业人员 ----------

export async function listStaff(): Promise<Staff[]> {
  return request<Staff[]>('/staff/');
}
