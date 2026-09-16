"""播种 3 个可登录物业账号及其物业人员档案。

账号：wangmin / lilei / zhaoqian，密码统一 rentfind123（仅演示用）。
幂等：按用户名 get_or_create，重复执行不会报错或重复建号。
"""

from django.contrib.auth.hashers import make_password
from django.db import migrations


SEED_ACCOUNTS = [
    {'username': 'wangmin', 'name': '王敏', 'phone': '13900000001'},
    {'username': 'lilei', 'name': '李磊', 'phone': '13900000002'},
    {'username': 'zhaoqian', 'name': '赵倩', 'phone': '13900000003'},
]
SEED_PASSWORD = 'rentfind123'


def seed_accounts(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    Staff = apps.get_model('users', 'Staff')
    for item in SEED_ACCOUNTS:
        user, _ = User.objects.get_or_create(
            username=item['username'],
            defaults={
                'is_staff': True,
                'password': make_password(SEED_PASSWORD),
            },
        )
        Staff.objects.get_or_create(
            user=user,
            defaults={'name': item['name'], 'phone': item['phone']},
        )


def remove_accounts(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    User.objects.filter(
        username__in=[a['username'] for a in SEED_ACCOUNTS]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_accounts, remove_accounts),
    ]
