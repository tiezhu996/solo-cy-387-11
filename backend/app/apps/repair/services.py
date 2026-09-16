"""报修工单与转派的领域服务。

并发约束：
- 所有状态变更都在单个事务内进行，并按固定顺序（工单 → 转派记录）加
  select_for_update 行锁，Postgres 下接受与拒绝同时到达会被行锁串行化。
- 决定性写入使用“带状态条件的 UPDATE”（compare-and-set）：
  仅当工单/转派仍处于预期状态时才生效，affected rows 为 0 即说明已被
  其他请求抢先处理，抛业务异常回滚。这样即便数据库不支持行锁（SQLite），
  接受与拒绝同时发生也只形成一个结果。
- 一张工单至多一条“待接受”转派：持锁期间判断 + 部分唯一约束兜底。
- 任何业务校验失败都抛 RepairBusinessError，事务回滚，
  处理人、状态、历史均不会被改动。
"""

from django.db import IntegrityError, transaction
from django.utils import timezone

from app.apps.repair.exceptions import RepairBusinessError
from app.apps.repair.models import RepairTicket, TransferRecord
from app.apps.users.models import Staff
from app.constants.enums import (
    REPAIR_STATUS_COMPLETED,
    REPAIR_STATUS_PROCESSING,
    REPAIR_STATUS_SUBMITTED,
    REPAIR_TYPES,
    TRANSFER_STATUS_ACCEPTED,
    TRANSFER_STATUS_PENDING,
    TRANSFER_STATUS_REJECTED,
)


def _validate_fault_type(fault_type):
    if fault_type not in REPAIR_TYPES:
        raise RepairBusinessError('REPAIR_FAULT_TYPE_INVALID')


def _validate_description(description):
    if not description or not description.strip():
        raise RepairBusinessError('REPAIR_DESCRIPTION_EMPTY')


def _get_staff(staff_id):
    if staff_id in (None, ''):
        raise RepairBusinessError('STAFF_REQUIRED', http_status=401)
    try:
        return Staff.objects.get(pk=staff_id)
    except (Staff.DoesNotExist, ValueError, TypeError):
        raise RepairBusinessError('STAFF_NOT_FOUND', http_status=404)


def _get_locked_ticket(ticket_id):
    """取出工单并（在支持的数据库上）持有行锁至事务结束。"""
    try:
        return (
            RepairTicket.objects
            .select_for_update()
            .select_related('handler')
            .get(pk=ticket_id)
        )
    except (RepairTicket.DoesNotExist, ValueError, TypeError):
        raise RepairBusinessError('REPAIR_NOT_FOUND', http_status=404)


def _get_locked_pending_transfer(transfer_id):
    """取出待决策的转派记录并按固定顺序加锁（先工单行，后转派记录行）。"""
    try:
        ticket_id = (
            TransferRecord.objects
            .filter(pk=transfer_id)
            .values_list('ticket_id', flat=True)
            .first()
        )
    except (ValueError, TypeError):
        raise RepairBusinessError('TRANSFER_NOT_FOUND', http_status=404)
    if ticket_id is None:
        raise RepairBusinessError('TRANSFER_NOT_FOUND', http_status=404)
    ticket = _get_locked_ticket(ticket_id)
    transfer = (
        TransferRecord.objects
        .select_for_update()
        .select_related('from_staff', 'to_staff')
        .get(pk=transfer_id)
    )
    transfer.ticket = ticket
    return ticket, transfer


@transaction.atomic
def submit_ticket(*, fault_type, description):
    """住户提交报修工单（保持原有入口可用）。"""
    _validate_fault_type(fault_type)
    _validate_description(description)
    return RepairTicket.objects.create(
        fault_type=fault_type,
        description=description.strip(),
        status=REPAIR_STATUS_SUBMITTED,
    )


@transaction.atomic
def accept_ticket(*, ticket_id, staff_id):
    """物业人员接单：仅“已提交”且无处理人的工单可接。"""
    staff = _get_staff(staff_id)
    ticket = _get_locked_ticket(ticket_id)
    # compare-and-set：并发接单只有一个请求能把无人处理的已提交工单更新掉
    updated = (
        RepairTicket.objects
        .filter(pk=ticket.id, status=REPAIR_STATUS_SUBMITTED, handler_id__isnull=True)
        .update(handler=staff, status=REPAIR_STATUS_PROCESSING, updated_at=timezone.now())
    )
    if updated == 0:
        raise RepairBusinessError('REPAIR_NOT_ACCEPTABLE')
    ticket.refresh_from_db()
    return ticket


@transaction.atomic
def complete_ticket(*, ticket_id, staff_id):
    """当前处理人完成工单；存在待接受转派时禁止处理。"""
    staff = _get_staff(staff_id)
    ticket = _get_locked_ticket(ticket_id)
    if ticket.handler_id != staff.id:
        raise RepairBusinessError('STAFF_FORBIDDEN', http_status=403)
    if ticket.status != REPAIR_STATUS_PROCESSING:
        raise RepairBusinessError('REPAIR_NOT_PROCESSABLE')
    if ticket.has_pending_transfer():
        raise RepairBusinessError('REPAIR_TRANSFER_PENDING')
    updated = (
        RepairTicket.objects
        .filter(pk=ticket.id, status=REPAIR_STATUS_PROCESSING, handler_id=staff.id)
        .update(status=REPAIR_STATUS_COMPLETED, updated_at=timezone.now())
    )
    if updated == 0:
        raise RepairBusinessError('REPAIR_NOT_PROCESSABLE')
    ticket.refresh_from_db()
    return ticket


@transaction.atomic
def create_transfer(*, ticket_id, staff_id, target_staff_id, reason):
    """当前处理人发起转派。待接受期间归属不变，也不能处理或再次转派。"""
    staff = _get_staff(staff_id)
    target = _get_staff(target_staff_id)
    if not reason or not reason.strip():
        raise RepairBusinessError('TRANSFER_REASON_EMPTY')
    if target.id == staff.id:
        raise RepairBusinessError('TRANSFER_TARGET_SAME_AS_HANDLER')
    ticket = _get_locked_ticket(ticket_id)
    if ticket.handler_id != staff.id:
        raise RepairBusinessError('STAFF_FORBIDDEN', http_status=403)
    if ticket.status != REPAIR_STATUS_PROCESSING:
        raise RepairBusinessError('REPAIR_NOT_PROCESSABLE')
    if ticket.has_pending_transfer():
        raise RepairBusinessError('REPAIR_TRANSFER_PENDING')
    try:
        return TransferRecord.objects.create(
            ticket=ticket,
            from_staff=staff,
            to_staff=target,
            reason=reason.strip(),
            status=TRANSFER_STATUS_PENDING,
        )
    except IntegrityError:
        # 部分唯一约束兜底：并发下已有待接受转派时，整个事务回滚，不留脏数据
        transaction.set_rollback(True)
        raise RepairBusinessError('REPAIR_TRANSFER_PENDING')


@transaction.atomic
def decide_transfer(*, transfer_id, staff_id, accepted):
    """目标人员接受/拒绝转派。并发的接受与拒绝经行锁/CAS 串行，只有一个生效。"""
    staff = _get_staff(staff_id)
    ticket, transfer = _get_locked_pending_transfer(transfer_id)
    if transfer.to_staff_id != staff.id:
        raise RepairBusinessError('STAFF_FORBIDDEN', http_status=403)

    new_status = TRANSFER_STATUS_ACCEPTED if accepted else TRANSFER_STATUS_REJECTED
    decided_at = timezone.now()
    # compare-and-set：仅“待接受”记录可被决策，第二个到达的请求 affected=0
    updated = (
        TransferRecord.objects
        .filter(pk=transfer.id, status=TRANSFER_STATUS_PENDING)
        .update(status=new_status, decided_at=decided_at)
    )
    if updated == 0:
        raise RepairBusinessError('TRANSFER_NOT_PENDING', http_status=409)

    if accepted:
        # 接受：归属才真正切换到目标人员，工单保持处理中
        RepairTicket.objects.filter(pk=ticket.id).update(
            handler=staff, updated_at=decided_at
        )
    # 拒绝：不写工单任何字段，归属保持在原处理人

    ticket.refresh_from_db()
    transfer.refresh_from_db()
    return ticket, transfer
