import { getAccessToken } from './auth';
import type {
  LoginResult,
  PropertyItem,
  RepairTicket,
  Staff,
  TransferRecord,
} from '../types/domain';

const API_BASE = '/api';

/** 会话失效回调（401）：由工作台注册，回到登录卡片。 */
let unauthorizedHandler: (() => void) | null = null;

export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(url: string, options: RequestInit = {}, auth = true): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (auth) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${url}`, { ...options, headers });
  if (!response.ok) {
    let payload: { code?: string; error?: { message?: string; detail?: string }; detail?: string } = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
    const message = payload.error?.message ?? payload.error?.detail ?? payload.detail ?? `请求失败（${response.status}）`;
    if (response.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    throw new ApiError(response.status, message, payload.code);
  }
  return response.json() as Promise<T>;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  return request<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }, false);
}

export async function getCurrentStaff(): Promise<Staff> {
  return request<Staff>('/auth/me');
}

export async function getProperties(): Promise<PropertyItem[]> {
  return request<PropertyItem[]>('/properties/', {}, false);
}

// ---------- 报修 ----------

export async function createRepair(
  ticket: Pick<RepairTicket, 'faultType' | 'description'>,
): Promise<RepairTicket> {
  // 住户公开提交，无需登录
  return request<RepairTicket>('/repairs/', {
    method: 'POST',
    body: JSON.stringify(ticket),
  }, false);
}

export async function listRepairs(): Promise<RepairTicket[]> {
  return request<RepairTicket[]>('/repairs/');
}

export async function acceptRepair(id: number): Promise<RepairTicket> {
  // 身份来自 JWT，不传任何 staffId
  return request<RepairTicket>(`/repairs/${id}/accept`, { method: 'POST', body: '{}' });
}

export async function completeRepair(id: number): Promise<RepairTicket> {
  return request<RepairTicket>(`/repairs/${id}/complete`, { method: 'POST', body: '{}' });
}

// ---------- 转派 ----------

export async function listTransfers(ticketId: number): Promise<TransferRecord[]> {
  return request<TransferRecord[]>(`/repairs/${ticketId}/transfers/`);
}

export async function createTransfer(
  ticketId: number,
  payload: { targetStaffId: number; reason: string },
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

export async function acceptTransfer(transferId: number): Promise<TransferDecision> {
  return request<TransferDecision>(`/transfers/${transferId}/accept`, { method: 'POST', body: '{}' });
}

export async function rejectTransfer(transferId: number): Promise<TransferDecision> {
  return request<TransferDecision>(`/transfers/${transferId}/reject`, { method: 'POST', body: '{}' });
}

// ---------- 物业人员 ----------

export async function listStaff(): Promise<Staff[]> {
  return request<Staff[]>('/staff/');
}
