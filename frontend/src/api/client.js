import { getAccessToken } from './auth';
const API_BASE = '/api';
/** 会话失效回调（401）：由工作台注册，回到登录卡片。 */
let unauthorizedHandler = null;
export function onUnauthorized(handler) {
    unauthorizedHandler = handler;
}
export class ApiError extends Error {
    constructor(status, message, code) {
        super(message);
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.status = status;
        this.code = code;
    }
}
async function request(url, options = {}, auth = true) {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (auth) {
        const token = getAccessToken();
        if (token)
            headers.set('Authorization', `Bearer ${token}`);
    }
    const response = await fetch(`${API_BASE}${url}`, { ...options, headers });
    if (!response.ok) {
        let payload = {};
        try {
            payload = await response.json();
        }
        catch {
            payload = {};
        }
        const message = payload.error?.message ?? payload.error?.detail ?? payload.detail ?? `请求失败（${response.status}）`;
        if (response.status === 401 && unauthorizedHandler) {
            unauthorizedHandler();
        }
        throw new ApiError(response.status, message, payload.code);
    }
    return response.json();
}
export async function login(username, password) {
    return request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    }, false);
}
export async function getCurrentStaff() {
    return request('/auth/me');
}
export async function getProperties() {
    return request('/properties/', {}, false);
}
// ---------- 报修 ----------
export async function createRepair(ticket) {
    // 住户公开提交，无需登录
    return request('/repairs/', {
        method: 'POST',
        body: JSON.stringify(ticket),
    }, false);
}
export async function listRepairs() {
    return request('/repairs/');
}
export async function acceptRepair(id) {
    // 身份来自 JWT，不传任何 staffId
    return request(`/repairs/${id}/accept`, { method: 'POST', body: '{}' });
}
export async function completeRepair(id) {
    return request(`/repairs/${id}/complete`, { method: 'POST', body: '{}' });
}
// ---------- 转派 ----------
export async function listTransfers(ticketId) {
    return request(`/repairs/${ticketId}/transfers/`);
}
export async function createTransfer(ticketId, payload) {
    return request(`/repairs/${ticketId}/transfers/`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}
export async function acceptTransfer(transferId) {
    return request(`/transfers/${transferId}/accept`, { method: 'POST', body: '{}' });
}
export async function rejectTransfer(transferId) {
    return request(`/transfers/${transferId}/reject`, { method: 'POST', body: '{}' });
}
// ---------- 物业人员 ----------
export async function listStaff() {
    return request('/staff/');
}
