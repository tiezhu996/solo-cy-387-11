"""播种示例报修工单与一条已拒绝的转派历史。幂等：按描述去重。"""

from django.db import migrations
from django.utils import timezone


SEED_TICKETS = [
    {
        'fault_type': '水电',
        'description': '厨房插座跳闸，合不上闸。',
        'status': '已提交',
        'handler': None,
    },
    {
        'fault_type': '门锁',
        'description': '入户门智能锁电量耗尽，机械钥匙也打不开。',
        'status': '处理中',
        'handler': '王敏',
    },
    {
        'fault_type': '管道',
        'description': '卫生间地漏反水，已处理完毕。',
        'status': '已完成',
        'handler': '李磊',
    },
]


def seed_repairs(apps, schema_editor):
    Staff = apps.get_model('users', 'Staff')
    RepairTicket = apps.get_model('repair', 'RepairTicket')
    TransferRecord = apps.get_model('repair', 'TransferRecord')

    staff_by_name = {name: Staff.objects.get(name=name)
                     for name in Staff.objects.values_list('name', flat=True)}

    created = {}
    for item in SEED_TICKETS:
        ticket, was_created = RepairTicket.objects.get_or_create(
            description=item['description'],
            defaults={
                'fault_type': item['fault_type'],
                'status': item['status'],
                'handler': staff_by_name.get(item['handler']) if item['handler'] else None,
            },
        )
        if was_created:
            created[item['description']] = ticket

    lock_ticket = created.get(SEED_TICKETS[1]['description'])
    if lock_ticket is not None:
        TransferRecord.objects.create(
            ticket=lock_ticket,
            from_staff=staff_by_name['王敏'],
            to_staff=staff_by_name['李磊'],
            reason='专长为水电维修，门锁问题建议李磊跟进。',
            status='已拒绝',
            decided_at=timezone.now(),
        )


def remove_repairs(apps, schema_editor):
    RepairTicket = apps.get_model('repair', 'RepairTicket')
    RepairTicket.objects.filter(
        description__in=[item['description'] for item in SEED_TICKETS]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('repair', '0001_initial'),
        ('users', '0002_seed_staff'),
    ]

    operations = [
        migrations.RunPython(seed_repairs, remove_repairs),
    ]
