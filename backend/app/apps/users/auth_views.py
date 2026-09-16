"""认证视图：物业人员登录、当前会话信息。"""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from app.apps.users.models import Staff
from app.apps.users.serializers import StaffLoginSerializer, StaffSerializer


class StaffLoginView(TokenObtainPairView):
    """账号密码登录，返回 access/refresh JWT 与物业人员信息。"""

    serializer_class = StaffLoginSerializer


class CurrentStaffView(APIView):
    """依据 Authorization 头里的 JWT 返回当前登录物业人员，供刷新页面后回读身份。"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        staff = Staff.objects.filter(user=request.user).first()
        if staff is None:
            return Response({'detail': '该账号不是物业人员'}, status=403)
        return Response(StaffSerializer(staff).data)
