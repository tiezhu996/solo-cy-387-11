"""物业人员名单：前端选择接单身份与转派目标。"""

from rest_framework.response import Response
from rest_framework.views import APIView

from app.apps.users.models import Staff
from app.apps.users.serializers import StaffSerializer


class StaffListView(APIView):
    def get(self, request):
        return Response(StaffSerializer(Staff.objects.all(), many=True).data)
