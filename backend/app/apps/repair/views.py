"""工单列表（登录物业）与报修提交（住户公开提交，保持可用）。"""

from rest_framework.response import Response

from app.apps.repair import selectors, services
from app.apps.repair.base import StaffAPIView
from app.apps.repair.serializers import RepairCreateSerializer, RepairTicketSerializer
from app.apps.users.permissions import IsStaff


class RepairTicketListView(StaffAPIView):
    # 提交报修面向住户，保持无需登录；列表仅对登录物业人员开放
    def get_permissions(self):
        if self.request.method == 'POST':
            return []
        return [IsStaff()]

    def get(self, request):
        tickets = list(selectors.ticket_queryset())
        serializer = RepairTicketSerializer(
            tickets,
            many=True,
            context=selectors.ticket_serializer_context(tickets),
        )
        return Response(serializer.data)

    def post(self, request):
        """住户提交报修：保持原入口与响应结构（id/faultType/description/status）。"""
        serializer = RepairCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = services.submit_ticket(
            fault_type=serializer.validated_data['faultType'],
            description=serializer.validated_data['description'],
        )
        return Response(RepairTicketSerializer(ticket).data, status=201)
