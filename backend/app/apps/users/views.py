"""物业人员名单：登录后供前端选择转派目标。"""

from rest_framework.response import Response

from app.apps.repair.base import StaffAPIView
from app.apps.users.models import Staff
from app.apps.users.serializers import StaffSerializer


class StaffListView(StaffAPIView):
    def get(self, request):
        return Response(StaffSerializer(Staff.objects.all(), many=True).data)
