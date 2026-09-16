export interface PropertyItem {
  id: number;
  community: string;
  region: string;
  layout: string;
  area: number;
  rent: number;
  deposit: number;
  payment: string;
  facilities: string[];
  status: string;
  landlordPhone: string;
}

export interface Staff {
  id: number;
  name: string;
  phone: string;
}

export interface RepairTicket {
  id: number;
  faultType: string;
  description: string;
  status: string;
  handlerId: number | null;
  handlerName: string | null;
  hasPendingTransfer: boolean;
  pendingTransferId: number | null;
  pendingToStaffId: number | null;
  pendingToStaffName: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TransferStatus = '待接受' | '已接受' | '已拒绝';

export interface TransferRecord {
  id: number;
  ticketId: number;
  fromStaffId: number;
  fromStaffName: string;
  toStaffId: number;
  toStaffName: string;
  reason: string;
  status: TransferStatus;
  createdAt: string;
  decidedAt: string | null;
}
