const API_BASE = '/api';
async function request(url, options) {
    const response = await fetch(`${API_BASE}${url}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!response.ok) {
        let payload = {};
        try {
            payload = await response.json();
        }
        catch {
            payload = {};
        }
        throw new Error(payload.error?.message ?? `请求失败（${response.status}）`);
    }
    return response.json();
}
export async function getProperties() {
    return request('/properties/');
}
// ---------- 报修 ----------
export async function createRepair(ticket) {
    return request('/repairs/', {
        method: 'POST',
        body: JSON.stringify(ticket),
    });
}
export async function listRepairs() {
    return request('/repairs/');
}
export async function getRepair(id) {
    return request(`/repairs/${id}/`);
}
export async function acceptRepair(id, staffId) {
    return request(`/repairs/${id}/accept`, {
        method: 'POST',
        body: JSON.stringify({ staffId }),
    });
}
export async function completeRepair(id, staffId) {
    return request(`/repairs/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ staffId }),
    });
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
export async function acceptTransfer(transferId, staffId) {
    return request(`/transfers/${transferId}/accept`, {
        method: 'POST',
        body: JSON.stringify({ staffId }),
    });
}
export async function rejectTransfer(transferId, staffId) {
    return request(`/transfers/${transferId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ staffId }),
    });
}
// ---------- 物业人员 ----------
export async function listStaff() {
    return request('/staff/');
}
