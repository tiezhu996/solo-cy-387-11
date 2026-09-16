"""工单详情、接单、完成。"""

from rest_framework.response import Response
from rest_framework.views import APIView

from app.apps.repair import selectors, services
from app.apps.repair.serializers import RepairTicketSerializer


class RepairTicketDetailView(APIView):
    def get(self, request, ticket_id):
        ticket = selectors.get_ticket_or_404(ticket_id)
        serializer = RepairTicketSerializer(
            ticket,
            context=selectors.ticket_serializer_context([ticket]),
        )
        return Response(serializer.data)


class RepairAcceptView(APIView):
    def post(self, request, ticket_id):
        ticket = services.accept_ticket(
            ticket_id=ticket_id,
            staff_id=request.data.get('staffId'),
        )
        return Response(RepairTicketSerializer(
            ticket,
            context=selectors.ticket_serializer_context([ticket]),
        ).data)


class RepairCompleteView(APIView):
    def post(self, request, ticket_id):
        ticket = services.complete_ticket(
            ticket_id=ticket_id,
            staff_id=request.data.get('staffId'),
        )
        return Response(RepairTicketSerializer(
            ticket,
            context=selectors.ticket_serializer_context([ticket]),
        ).data)
