"""报修模块只读查询：列表/详情的组装与待接受转派标记。"""

from app.apps.repair.exceptions import RepairBusinessError
from app.apps.repair.models import RepairTicket, TransferRecord
from app.constants.enums import TRANSFER_STATUS_PENDING


def ticket_queryset():
    return RepairTicket.objects.select_related('handler').all()


def get_ticket_or_404(ticket_id):
    try:
        return ticket_queryset().get(pk=ticket_id)
    except (RepairTicket.DoesNotExist, ValueError, TypeError):
        raise RepairBusinessError('REPAIR_NOT_FOUND', http_status=404)


def pending_transfer_ticket_ids(ticket_ids):
    """一次查询取出这批工单中存在待接受转派的工单 ID 集合。"""
    if not ticket_ids:
        return set()
    return set(
        TransferRecord.objects
        .filter(ticket_id__in=ticket_ids, status=TRANSFER_STATUS_PENDING)
        .values_list('ticket_id', flat=True)
    )


def pending_transfer_map(ticket_ids):
    """工单 ID -> 待接受转派摘要（记录 ID、目标人员），供列表一次渲染操作按钮。"""
    if not ticket_ids:
        return {}
    rows = (
        TransferRecord.objects
        .filter(ticket_id__in=ticket_ids, status=TRANSFER_STATUS_PENDING)
        .select_related('to_staff')
    )
    return {
        row.ticket_id: {
            'id': row.id,
            'toStaffId': row.to_staff_id,
            'toStaffName': row.to_staff.name,
        }
        for row in rows
    }


def ticket_serializer_context(tickets):
    ticket_ids = [t.id for t in tickets]
    return {
        'pending_transfer_ticket_ids': pending_transfer_ticket_ids(ticket_ids),
        'pending_transfer_map': pending_transfer_map(ticket_ids),
    }


def transfer_queryset():
    return (
        TransferRecord.objects
        .select_related('from_staff', 'to_staff')
        .all()
    )
