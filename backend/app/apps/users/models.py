from django.contrib.auth.models import User
from django.db import models


class Staff(models.Model):
    """物业人员：与登录账号一一对应。身份只能来自登录会话，不能由请求参数指定。"""

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='staff_profile',
        verbose_name='登录账号',
    )
    name = models.CharField(max_length=40, unique=True)
    phone = models.CharField(max_length=30, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'users_staff'
        ordering = ['id']

    def __str__(self):
        return self.name
