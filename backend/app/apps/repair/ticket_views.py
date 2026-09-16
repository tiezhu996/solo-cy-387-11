"""工单详情、接单、完成。身份一律取自登录会话。"""

from rest_framework.response import Response

from app.apps.repair import selectors, services
from app.apps.repair.base import StaffAPIView
from app.apps.repair.serializers import RepairTicketSerializer


class RepairTicketDetailView(StaffAPIView):
    def get(self, request, ticket_id):
        ticket = selectors.get_ticket_or_404(ticket_id)
        serializer = RepairTicketSerializer(
            ticket,
            context=selectors.ticket_serializer_context([ticket]),
        )
        return Response(serializer.data)


class RepairAcceptView(StaffAPIView):
    def post(self, request, ticket_id):
        ticket = services.accept_ticket(
            ticket_id=ticket_id,
            staff=self.current_staff(request),
        )
        return Response(RepairTicketSerializer(
            ticket,
            context=selectors.ticket_serializer_context([ticket]),
        ).data)


class RepairCompleteView(StaffAPIView):
    def post(self, request, ticket_id):
        ticket = services.complete_ticket(
            ticket_id=ticket_id,
            staff=self.current_staff(request),
        )
        return Response(RepairTicketSerializer(
            ticket,
            context=selectors.ticket_serializer_context([ticket]),
        ).data)
