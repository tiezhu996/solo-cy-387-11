"""转派的发起、记录查询与接受/拒绝。操作人身份一律取自登录会话。"""

from rest_framework.response import Response

from app.apps.repair import selectors, services
from app.apps.repair.base import StaffAPIView
from app.apps.repair.exceptions import RepairBusinessError
from app.apps.repair.models import TransferRecord
from app.apps.repair.serializers import (
    RepairTicketSerializer,
    TransferCreateSerializer,
    TransferRecordSerializer,
)


class TransferListCreateView(StaffAPIView):
    def get(self, request, ticket_id):
        """回读某工单的全部转派记录（含待接受/已接受/已拒绝）。"""
        ticket = selectors.get_ticket_or_404(ticket_id)
        records = list(selectors.transfer_queryset().filter(ticket=ticket))
        return Response(TransferRecordSerializer(records, many=True).data)

    def post(self, request, ticket_id):
        """当前登录处理人发起转派：目标人员 + 原因。不能指定他人身份。"""
        serializer = TransferCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        transfer = services.create_transfer(
            ticket_id=ticket_id,
            staff=self.current_staff(request),
            target_staff_id=serializer.validated_data['targetStaffId'],
            reason=serializer.validated_data['reason'],
        )
        return Response(TransferRecordSerializer(transfer).data, status=201)


class TransferDetailView(StaffAPIView):
    def get(self, request, transfer_id):
        try:
            transfer = selectors.transfer_queryset().get(pk=transfer_id)
        except (TransferRecord.DoesNotExist, ValueError, TypeError):
            raise RepairBusinessError('TRANSFER_NOT_FOUND', http_status=404)
        return Response(TransferRecordSerializer(transfer).data)


class TransferDecisionView(StaffAPIView):
    """接受或拒绝。仅转派目标人员本人可调用；两种请求并发到达时只形成一个结果。"""

    accepted = True

    def post(self, request, transfer_id):
        ticket, transfer = services.decide_transfer(
            transfer_id=transfer_id,
            staff=self.current_staff(request),
            accepted=self.accepted,
        )
        return Response({
            'ticket': RepairTicketSerializer(
                ticket,
                context=selectors.ticket_serializer_context([ticket]),
            ).data,
            'transfer': TransferRecordSerializer(transfer).data,
        })


class TransferAcceptView(TransferDecisionView):
    accepted = True


class TransferRejectView(TransferDecisionView):
    accepted = False
