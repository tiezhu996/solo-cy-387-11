from rest_framework import serializers

from app.apps.repair.exceptions import RepairBusinessError
from app.apps.repair.models import RepairTicket, TransferRecord
from app.constants.enums import REPAIR_TYPES


class RepairTicketSerializer(serializers.ModelSerializer):
    faultType = serializers.CharField(source='fault_type')
    handlerId = serializers.IntegerField(source='handler_id', allow_null=True)
    handlerName = serializers.CharField(source='handler.name', default=None, allow_null=True)
    hasPendingTransfer = serializers.SerializerMethodField()
    pendingTransferId = serializers.SerializerMethodField()
    pendingToStaffId = serializers.SerializerMethodField()
    pendingToStaffName = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = RepairTicket
        fields = [
            'id', 'faultType', 'description', 'status',
            'handlerId', 'handlerName', 'hasPendingTransfer',
            'pendingTransferId', 'pendingToStaffId', 'pendingToStaffName',
            'createdAt', 'updatedAt',
        ]

    def _pending(self, obj):
        return self.context.get('pending_transfer_map', {}).get(obj.id)

    def get_hasPendingTransfer(self, obj):
        pending = self._pending(obj)
        if pending is not None:
            return True
        pending_ids = self.context.get('pending_transfer_ticket_ids')
        if pending_ids is not None:
            return obj.id in pending_ids
        return obj.has_pending_transfer()

    def get_pendingTransferId(self, obj):
        pending = self._pending(obj)
        return pending['id'] if pending else None

    def get_pendingToStaffId(self, obj):
        pending = self._pending(obj)
        return pending['toStaffId'] if pending else None

    def get_pendingToStaffName(self, obj):
        pending = self._pending(obj)
        return pending['toStaffName'] if pending else None


class RepairCreateSerializer(serializers.Serializer):
    faultType = serializers.CharField()
    description = serializers.CharField(allow_blank=True, trim_whitespace=False)

    def validate_faultType(self, value):
        if value not in REPAIR_TYPES:
            raise RepairBusinessError('REPAIR_FAULT_TYPE_INVALID')
        return value

    def validate_description(self, value):
        if not value or not value.strip():
            raise RepairBusinessError('REPAIR_DESCRIPTION_EMPTY')
        return value.strip()


class TransferRecordSerializer(serializers.ModelSerializer):
    ticketId = serializers.IntegerField(source='ticket_id')
    fromStaffId = serializers.IntegerField(source='from_staff_id')
    fromStaffName = serializers.CharField(source='from_staff.name', default=None)
    toStaffId = serializers.IntegerField(source='to_staff_id')
    toStaffName = serializers.CharField(source='to_staff.name', default=None)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    decidedAt = serializers.DateTimeField(source='decided_at', read_only=True, allow_null=True)

    class Meta:
        model = TransferRecord
        fields = [
            'id', 'ticketId',
            'fromStaffId', 'fromStaffName',
            'toStaffId', 'toStaffName',
            'reason', 'status', 'createdAt', 'decidedAt',
        ]


class TransferCreateSerializer(serializers.Serializer):
    # 只有目标人员编号来自请求；操作人身份取自登录会话，不接受请求里的 staffId
    targetStaffId = serializers.IntegerField()
    reason = serializers.CharField(allow_blank=True, trim_whitespace=False)

    def validate_reason(self, value):
        if not value or not value.strip():
            raise RepairBusinessError('TRANSFER_REASON_EMPTY')
        return value.strip()
