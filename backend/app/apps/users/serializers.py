"""用户模块序列化器：登录令牌与物业人员信息。"""

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from app.apps.users.models import Staff


class StaffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Staff
        fields = ['id', 'name', 'phone']


class StaffLoginSerializer(TokenObtainPairSerializer):
    """校验账号密码并签发 JWT，返回中附带物业人员信息。"""

    def validate(self, attrs):
        data = super().validate(attrs)
        staff = Staff.objects.filter(user=self.user).first()
        if staff is None:
            raise serializers.ValidationError('该账号不是物业人员')
        data['staff'] = StaffSerializer(staff).data
        return data
