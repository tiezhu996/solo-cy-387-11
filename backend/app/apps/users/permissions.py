"""物业接口权限：必须登录且账号关联物业人员档案。"""

from rest_framework.permissions import BasePermission

from app.apps.users.models import Staff


class IsStaff(BasePermission):
    message = '仅物业人员可操作'

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return Staff.objects.filter(user=request.user).exists()
