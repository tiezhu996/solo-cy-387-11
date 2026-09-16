from django.db import models

from app.apps.users.models import Staff
from app.constants.enums import (
    REPAIR_STATUS_SUBMITTED,
    REPAIR_STATUS,
    REPAIR_TYPES,
    TRANSFER_STATUS_PENDING,
    TRANSFER_STATUS,
)


class RepairTicket(models.Model):
    """报修工单。handler 为当前归属：未接单时为空。"""

    FAULT_TYPE_CHOICES = [(item, item) for item in REPAIR_TYPES]
    STATUS_CHOICES = [(item, item) for item in REPAIR_STATUS]

    fault_type = models.CharField(max_length=10, choices=FAULT_TYPE_CHOICES)
    description = models.TextField()
    status = models.CharField(max_length=10, default=REPAIR_STATUS_SUBMITTED)
    handler = models.ForeignKey(
        Staff,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='handled_tickets',
        verbose_name='当前处理人',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'repair_ticket'
        ordering = ['-created_at', '-id']

    def has_pending_transfer(self):
        return self.transfers.filter(status=TRANSFER_STATUS_PENDING).exists()


class TransferRecord(models.Model):
    """工单转派记录。待接受期间归属不变，接受后才切换 handler。"""

    STATUS_CHOICES = [(item, item) for item in TRANSFER_STATUS]

    ticket = models.ForeignKey(
        RepairTicket,
        on_delete=models.CASCADE,
        related_name='transfers',
        verbose_name='关联工单',
    )
    from_staff = models.ForeignKey(
        Staff,
        on_delete=models.PROTECT,
        related_name='sent_transfers',
        verbose_name='原处理人',
    )
    to_staff = models.ForeignKey(
        Staff,
        on_delete=models.PROTECT,
        related_name='received_transfers',
        verbose_name='目标人员',
    )
    reason = models.TextField(verbose_name='转派原因')
    status = models.CharField(max_length=10, default=TRANSFER_STATUS_PENDING)
    decided_at = models.DateTimeField(null=True, blank=True, verbose_name='接受/拒绝时间')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'repair_transfer_record'
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(fields=['ticket', 'status']),
        ]
        constraints = [
            # 一张工单同一时刻至多一条待接受转派：数据库兜底并发下的“不能再次转派”
            models.UniqueConstraint(
                fields=['ticket'],
                condition=models.Q(status=TRANSFER_STATUS_PENDING),
                name='uniq_pending_transfer_per_ticket',
            ),
        ]
