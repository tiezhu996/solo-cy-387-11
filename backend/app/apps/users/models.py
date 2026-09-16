from django.db import models


class Staff(models.Model):
    """物业人员：可接单、转派、接受/拒绝转派。"""

    name = models.CharField(max_length=40, unique=True)
    phone = models.CharField(max_length=30, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'users_staff'
        ordering = ['id']

    def __str__(self):
        return self.name
