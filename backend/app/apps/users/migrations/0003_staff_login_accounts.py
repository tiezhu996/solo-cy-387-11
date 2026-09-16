"""为旧环境补齐物业登录账号及账号关联（升级迁移，不清空数据）。

兼容三类环境，升级后得到同一终态：
1. 按旧结构运行过的库：Staff 没有 user 列、没有账号 -> 加列、补账号关联、收紧非空；
2. 全新安装：0001/0002/0003 顺序执行，一次性到位；
3. 曾短暂跑过“user 列直接内置在 0001”中间版本的库：列与账号已存在，
   0003 自动跳过已有 DDL，只做状态对齐，不报错、不重建。

原子性：本迁移默认 atomic，任一环节失败整体回滚、库保持原状。

账号补齐规则（幂等，重复执行不重复建号）：
- 播种人员使用固定演示账号 wangmin/lilei/zhaoqian；
- 其他人员优先用手机号，其次 staff{id}，冲突则追加后缀直到唯一；
- 初始密码统一 rentfind123，生产应在首次登录后修改。
"""

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.db import migrations, models
import django.db.models.deletion

DEFAULT_PASSWORD = 'rentfind123'

# name -> 固定登录账号；旧环境的播种人员升级后仍使用这些账号登录
SEED_USERNAMES = {
    '王敏': 'wangmin',
    '李磊': 'lilei',
    '赵倩': 'zhaoqian',
}


def _column_info(schema_editor, table, column):
    """返回某列的内省信息；列不存在时返回 None。"""
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        for info in connection.introspection.get_table_description(cursor, table):
            if info.name == column:
                return info
    return None


class AddFieldIfMissing(migrations.AddField):
    """仅当数据库中缺少该列时执行 DDL；状态推进照常进行（幂等兼容中间版本）。"""

    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        model = from_state.apps.get_model(app_label, self.model_name)
        column = f'{self.name}_id' if self.field.is_relation else self.name
        if _column_info(schema_editor, model._meta.db_table, column) is None:
            super().database_forwards(app_label, schema_editor, from_state, to_state)

    def database_backwards(self, app_label, schema_editor, from_state, to_state):
        # 条件加列的逆操作不删列：该列可能本就存在（中间版本）或仍承载数据，
        # RunPython 的 detach_accounts 已解绑关系；保留可空列不影响 0002 模型。
        return


class SetNotNullIfNullable(migrations.AlterField):
    """仅当列当前允许 NULL 时才收紧为 NOT NULL；已经是非空则仅对齐状态。"""

    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        model = from_state.apps.get_model(app_label, self.model_name)
        column = f'{self.name}_id' if self.field.is_relation else self.name
        info = _column_info(schema_editor, model._meta.db_table, column)
        # null_ok 未知（个别后端不提供）时保守执行真正的 ALTER
        if info is None or getattr(info, 'null_ok', True):
            super().database_forwards(app_label, schema_editor, from_state, to_state)

    def database_backwards(self, app_label, schema_editor, from_state, to_state):
        # 回滚时框架已交换状态：from_state 为非空（当前）、to_state 为可空（迁移前）。
        # 不能复用 forwards 的“看当前列是否可空”判断（当前是非空会被错误跳过），
        # 直接把字段从当前非空改回迁移前的可空定义，无条件恢复列可空，
        # 随后 RunPython 的 detach_accounts 才能把 user 置空。
        to_model = to_state.apps.get_model(app_label, self.model_name)
        if self.allow_migrate_model(schema_editor.connection.alias, to_model):
            from_model = from_state.apps.get_model(app_label, self.model_name)
            schema_editor.alter_field(
                from_model,
                from_model._meta.get_field(self.name),
                to_model._meta.get_field(self.name),
            )


def _unique_username(taken, candidate):
    username = candidate
    suffix = 1
    while username in taken:
        username = f'{candidate}_{suffix}'
        suffix += 1
    taken.add(username)
    return username


def backfill_accounts(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    Staff = apps.get_model('users', 'Staff')

    # 仅处理尚未关联账号的人员；已关联（重复执行 / 中间版本）一律不动
    pending = Staff.objects.filter(user__isnull=True).order_by('id')
    if not pending.exists():
        return

    taken = set(User.objects.values_list('username', flat=True))
    for staff in pending:
        preferred = SEED_USERNAMES.get(staff.name) or (staff.phone or None) or f'staff{staff.id}'
        username = _unique_username(taken, preferred)
        user = User.objects.create(
            username=username,
            password=make_password(DEFAULT_PASSWORD),
            is_staff=True,
            is_active=True,
        )
        staff.user = user
        staff.save(update_fields=['user'])


def detach_accounts(apps, schema_editor):
    # 回滚迁移只解除关联，不删除登录账号，避免误删可能已改过密码的账号
    Staff = apps.get_model('users', 'Staff')
    Staff.objects.all().update(user=None)


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('users', '0002_seed_staff'),
    ]

    operations = [
        # 第一步：可空加列（已存在则跳过），便于在同迁移内回填
        AddFieldIfMissing(
            model_name='staff',
            name='user',
            field=models.OneToOneField(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='staff_profile',
                to=settings.AUTH_USER_MODEL,
                verbose_name='登录账号',
            ),
        ),
        # 第二步：补齐账号与关联（幂等）
        migrations.RunPython(backfill_accounts, detach_accounts),
        # 第三步：全部关联完成后收紧为非空（已是不非空则仅对齐状态）
        SetNotNullIfNullable(
            model_name='staff',
            name='user',
            field=models.OneToOneField(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='staff_profile',
                to=settings.AUTH_USER_MODEL,
                verbose_name='登录账号',
            ),
        ),
    ]
