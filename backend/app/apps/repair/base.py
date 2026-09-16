"""报修视图共享基类：从登录会话解析当前物业人员。"""

from rest_framework.views import APIView

from app.apps.users.models import Staff
from app.apps.users.permissions import IsStaff


class StaffAPIView(APIView):
    """所有物业写操作的基类：必须是登录物业人员，身份只取会话。"""

    permission_classes = [IsStaff]

    def current_staff(self, request):
        # IsStaff 已保证 staff_profile 存在；反向 OneToOne 描述符取出本人档案。
        # 这里刻意不读取请求体中的任何“人员编号”，使身份无法被伪造。
        return Staff.objects.get(user=request.user)
