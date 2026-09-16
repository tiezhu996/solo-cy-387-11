"""播种物业人员，供接单/转派演示。幂等：同名不重复创建。"""

from django.db import migrations


SEED_STAFF = [
    {'name': '王敏', 'phone': '13900000001'},
    {'name': '李磊', 'phone': '13900000002'},
    {'name': '赵倩', 'phone': '13900000003'},
]


def seed_staff(apps, schema_editor):
    Staff = apps.get_model('users', 'Staff')
    existing = set(Staff.objects.values_list('name', flat=True))
    Staff.objects.bulk_create(
        [Staff(**item) for item in SEED_STAFF if item['name'] not in existing]
    )


def remove_staff(apps, schema_editor):
    Staff = apps.get_model('users', 'Staff')
    Staff.objects.filter(name__in=[item['name'] for item in SEED_STAFF]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_staff, remove_staff),
    ]
