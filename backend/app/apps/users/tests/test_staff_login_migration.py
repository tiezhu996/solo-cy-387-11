"""登录账号补齐迁移（users.0003）的可重复测试。

覆盖冲突输入：手机号已被普通账号占用（启用/停用）、两名人员手机号相同、
手机号为空、首选名与停用账号冲突、连续后缀被占用，以及普通账号与物业
人员混排。验证：一人一号、既有账号不被顶替或误启用、冲突分配稳定、
重入不产生重复账号、升级失败整体回滚。

数据库无关：不写任何后端专有 DDL/SQL。旧结构构造用 Django Schema Editor
（PostgreSQL 走 ALTER TABLE DROP COLUMN，SQLite 自动表重建），旧表数据
用 0002 历史模型 ORM 写入，列结构用 Django 内省读取，参数绑定统一用
Django 的 %%s。SQLite 与 PostgreSQL 上同一套用例完成旧结构构造、升级
和失败回滚，不跳过回滚场景、也不为单一后端走专用路径。

每个用例都先把 users 应用回滚到旧结构（0002）并重置为干净旧基线，
再自行构造输入；用例结束后把应用迁回最新节点，数据随事务自动清理，
不依赖人工清空，可反复执行。人员主键显式指定，跨后端/用例稳定：
王敏=1 李磊=2 赵倩=3 孙水电=4 钱运维=5 周空号=6 冯同号A=7 陈同号B=8 楚停用=9
"""

from django.apps import apps as django_apps
from django.core.management import call_command
from django.db import connection
from django.test import TransactionTestCase

MIGRATION_OLD = '0002_seed_staff'
MIGRATION_NEW = '0003_staff_login_accounts'

# 既有普通账号（均不关联人员）：覆盖启用/停用占用与连续后缀预占
ORDINARY_USERS = [
    {'username': '13900001111', 'active': True},    # 占孙水电首选（启用）
    {'username': '13900002222', 'active': False},   # 占钱运维首选（停用）
    {'username': 'wangmin', 'active': False},       # 占王敏首选（停用）
    {'username': '13800000000', 'active': True},    # 占冯同号A/陈同号B首选（启用）
    {'username': '13800000000_1', 'active': False},  # 预占第一后缀（停用）
]

# 与物业人员混排的冲突人员（楚停用的停用冲突账号按其真实 id 单独构造）
CONFLICT_STAFF = [
    ('孙水电', '13900001111'),
    ('钱运维', '13900002222'),
    ('周空号', ''),
    ('冯同号A', '13800000000'),
    ('陈同号B', '13800000000'),
    ('楚停用', ''),
]

SEED_STAFF = [('王敏', '13900000001'), ('李磊', '13900000002'), ('赵倩', '13900000003')]


class StaffLoginAccountUpgradeTests(TransactionTestCase):
    """旧 -> 新升级路径测试。"""

    # ---------- 环境构造 ----------

    @staticmethod
    def model_at(app_label, model_name):
        """取当前迁移状态下的历史模型。"""
        return django_apps.get_model(app_label, model_name)

    @staticmethod
    def stage_check(stage, condition, *, conflict, detail):
        """失败时指出冲突输入、处理阶段与残留关系。"""
        if not condition:
            raise AssertionError(
                f'[升级测试失败] 阶段={stage}；冲突输入={conflict}；残留/明细={detail}'
            )

    @staticmethod
    def _column_names(table):
        """跨后端返回表的列名集合（Django 内省，不用任何后端专有 SQL）。"""
        with connection.cursor() as cursor:
            description = connection.introspection.get_table_description(cursor, table)
        return {column.name for column in description}

    @staticmethod
    def _old_state_apps():
        """users 停在 0002 时的历史应用注册表（Staff 尚不含 user 字段）。"""
        from django.db.migrations.executor import MigrationExecutor

        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        return executor.loader.project_state([('users', MIGRATION_OLD)]).apps

    def _drop_user_column(self):
        """用 Django Schema Editor 物理移除 users_staff.user_id 列。

        同一份代码在两种后端上都成立：PostgreSQL 走 ALTER TABLE DROP COLUMN，
        SQLite 由其 schema editor 自动执行“建新表-拷数据-换名”重建
        （该列带唯一/FK 约束，SQLite 不允许直接 DROP）。重建时以“当前模型
        字段减去 user 列”生成新表，恰好等于旧的四列结构。不写任何后端专有
        DDL，也不是跳过回滚的假路径。
        """
        current_staff = self.model_at('users', 'Staff')
        user_field = current_staff._meta.get_field('user')
        with connection.schema_editor() as schema_editor:
            schema_editor.remove_field(current_staff, user_field)

    def reset_to_old_baseline(self, physically_old=False):
        """回滚到旧结构并构造干净基线：3 个无账号播种人员。

        physically_old=True 时连 user_id 列都用 Schema Editor 物理移除
        （模拟从未升级过的库）。两种后端走同一套 Django API；
        人员主键显式指定，不依赖序列重置，跨后端/跨用例 ID 稳定。
        """
        # repair 种子数据以 PROTECT 外键引用 Staff，回滚 users 前先清数据
        try:
            self.model_at('repair', 'TransferRecord').objects.all().delete()
            self.model_at('repair', 'RepairTicket').objects.all().delete()
        except LookupError:
            pass
        call_command('migrate', 'users', MIGRATION_OLD, verbosity=0, interactive=False)

        if physically_old:
            # 列尚在时用当前模型清空；auth_user 表不受删列影响，始终用当前 User
            self.model_at('users', 'Staff').objects.all().delete()
            self.model_at('auth', 'User').objects.all().delete()
            self._drop_user_column()
            # 删除后 users_staff 只能用 0002 历史模型（不含 user 字段）访问
            old_staff = self._old_state_apps().get_model('users', 'Staff')
            OldUser = self.model_at('auth', 'User')
            for index, (name, phone) in enumerate(SEED_STAFF, start=1):
                old_staff.objects.create(id=index, name=name, phone=phone)
            return old_staff, OldUser

        OldStaff = self.model_at('users', 'Staff')
        OldUser = self.model_at('auth', 'User')
        OldStaff.objects.all().delete()
        OldUser.objects.all().delete()
        # 显式主键播种：王敏=1 李磊=2 赵倩=3（可空 user 列留空即可）
        for index, (name, phone) in enumerate(SEED_STAFF, start=1):
            OldStaff.objects.create(id=index, name=name, phone=phone)
        return OldStaff, OldUser

    def create_conflict_data(self, OldStaff, OldUser):
        """造普通账号 + 冲突人员，返回 (普通账号快照 dict, 人员 by_name)。"""
        ordinary = {}
        for item in ORDINARY_USERS:
            u = OldUser.objects.create(
                username=item['username'], password='unusable-hash',
                is_active=item['active'], is_staff=False,
            )
            ordinary[item['username']] = (u.id, item['active'])

        by_name = {}
        # 显式主键 4..9：跨后端、跨用例稳定，无需依赖序列重置
        for index, (name, phone) in enumerate(CONFLICT_STAFF, start=4):
            by_name[name] = OldStaff.objects.create(id=index, name=name, phone=phone)

        # 楚停用：空手机号回退名 staff{id} 恰好被一个停用普通账号占用
        chu = by_name['楚停用']
        collide = OldUser.objects.create(
            username=f'staff{chu.id}', password='unusable-hash',
            is_active=False, is_staff=False,
        )
        ordinary[collide.username] = (collide.id, False)
        return ordinary, by_name

    @staticmethod
    def expected_usernames(by_name):
        """按与服务端相同的规则独立推导期望分配。"""
        return {
            '王敏': 'wangmin_1',                          # wangmin 被停用账号占用
            '李磊': 'lilei',
            '赵倩': 'zhaoqian',
            '孙水电': '13900001111_1',                    # 首选被启用账号占用
            '钱运维': '13900002222_1',                    # 首选被停用账号占用
            '周空号': f'staff{by_name["周空号"].id}',      # 空手机号回退
            '冯同号A': '13800000000_2',                    # 首选与 _1 都被占
            '陈同号B': '13800000000_3',                    # 首选、_1、_2（冯新建）都被占
            '楚停用': f'staff{by_name["楚停用"].id}_1',    # 回退名被停用账号占用
        }

    # ---------- 用例 ----------

    def test_conflict_inputs_bind_one_account_each_and_preserve_existing(self):
        OldStaff, OldUser = self.reset_to_old_baseline()
        ordinary_before, by_name = self.create_conflict_data(OldStaff, OldUser)
        conflict_input = {'ordinary_users': ORDINARY_USERS + [{'username': 'staff9', 'active': False}],
                          'staff': CONFLICT_STAFF}

        call_command('migrate', 'users', verbosity=0, interactive=False)

        Staff = self.model_at('users', 'Staff')
        User = self.model_at('auth', 'User')
        total_staff = len(SEED_STAFF) + len(CONFLICT_STAFF)

        # 1) 每名人员恰好绑定一个账号；账号互不相同
        linked = Staff.objects.exclude(user__isnull=True).count()
        distinct = Staff.objects.values('user_id').distinct().count()
        self.stage_check('升级后-绑定完整性', Staff.objects.count() == total_staff and linked == total_staff,
                         conflict=conflict_input, detail={'staff': Staff.objects.count(), 'linked': linked})
        self.stage_check('升级后-一人一号', distinct == total_staff,
                         conflict=conflict_input, detail={'distinct_users': distinct, 'total': total_staff})

        # 2) 期望分配逐一命中（稳定后缀）
        expected = self.expected_usernames(by_name)
        actual = {s.name: s.user.username for s in Staff.objects.select_related('user')}
        for name, want in expected.items():
            self.stage_check(f'账号分配-{name}', actual.get(name) == want,
                             conflict={'staff': name}, detail={'expected': want, 'actual': actual.get(name)})

        # 3) 既有普通账号：id 不变、不被顶替、不被误启用、不被关联
        for username, (old_id, old_active) in ordinary_before.items():
            u = User.objects.get(username=username)
            linked_staff = Staff.objects.filter(user_id=u.id).first()
            self.stage_check(
                f'既有账号保持-{username}',
                u.id == old_id and u.is_active == old_active and linked_staff is None,
                conflict={'username': username, 'was_active': old_active},
                detail={'id': (u.id, old_id), 'active': (u.is_active, old_active),
                        'linked_to_staff': linked_staff.name if linked_staff else None},
            )

        # 4) 新建物业账号均激活、is_staff=True
        for name, want in expected.items():
            u = User.objects.get(username=want)
            self.stage_check(
                f'新账号状态-{name}',
                u.is_active is True and u.is_staff is True and u.check_password('rentfind123'),
                conflict={'staff': name},
                detail={'username': want, 'active': u.is_active, 'is_staff': u.is_staff},
            )

        # 5) 账号总数恰好 = 既有普通账号 + 人员数（无重复/多余）
        total_users = User.objects.count()
        self.stage_check('升级后-账号总数', total_users == len(ordinary_before) + total_staff,
                         conflict=conflict_input,
                         detail={'users': total_users, 'expected': len(ordinary_before) + total_staff})

    def test_assignment_is_stable_across_runs(self):
        """同样的旧库状态分别升级两次，staff_id -> username 映射完全一致。"""
        def build_and_upgrade():
            OldStaff, OldUser = self.reset_to_old_baseline()
            self.create_conflict_data(OldStaff, OldUser)
            call_command('migrate', 'users', verbosity=0, interactive=False)
            Staff = self.model_at('users', 'Staff')
            return {s.id: s.user.username for s in Staff.objects.select_related('user').order_by('id')}

        first, second = build_and_upgrade(), build_and_upgrade()
        self.stage_check('分配稳定性', first == second,
                         conflict='相同冲突输入重复升级', detail={'run1': first, 'run2': second})

    def test_backfill_is_reentrant_no_duplicate_accounts(self):
        """升级完成后再次执行回填，不应写入任何账号或关系。"""
        OldStaff, OldUser = self.reset_to_old_baseline()
        self.create_conflict_data(OldStaff, OldUser)
        call_command('migrate', 'users', verbosity=0, interactive=False)
        User = self.model_at('auth', 'User')
        Staff = self.model_at('users', 'Staff')
        users_after = User.objects.count()

        from importlib import util as importlib_util
        from pathlib import Path
        mig_path = Path(__file__).resolve().parents[1] / 'migrations' / f'{MIGRATION_NEW}.py'
        spec = importlib_util.spec_from_file_location('users_0003_reentrant', mig_path)
        mod = importlib_util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.backfill_accounts(django_apps, None)
        mod.backfill_accounts(django_apps, None)

        self.stage_check('重入-无重复账号', User.objects.count() == users_after,
                         conflict='升级后重入 backfill_accounts 两次',
                         detail={'before': users_after, 'after': User.objects.count()})
        self.stage_check('重入-全员仍唯一关联',
                         Staff.objects.exclude(user__isnull=True).count() == Staff.objects.count()
                         and Staff.objects.values('user_id').distinct().count() == Staff.objects.count(),
                         conflict='重入 backfill', detail={})

    def test_failed_upgrade_rolls_back_entirely(self):
        """回填后抛错：列随 DDL 事务回滚消失、账号无残留、迁移未记录，且可重试成功。

        全程使用 Django 跨后端 API（Schema Editor 删列、内省读列、ORM/标准
        COUNT SQL），SQLite 与 PostgreSQL 走同一套代码，不跳过回滚场景。
        """
        # 真正“从未有 user_id 列”的物理旧表；用 0002 历史模型构造旧数据
        OldStaff, OldUser = self.reset_to_old_baseline(physically_old=True)
        ordinary_before, _ = self.create_conflict_data(OldStaff, OldUser)
        users_before = OldUser.objects.count()
        staff_before = OldStaff.objects.count()

        self.stage_check(
            '升级前-旧表无 user_id 列',
            'user_id' not in self._column_names('users_staff'),
            conflict='物理旧表（含启用/停用普通账号、同号与空号人员混排）',
            detail={'columns': sorted(self._column_names('users_staff'))},
        )

        from django.db import connections
        from django.db.migrations.executor import MigrationExecutor

        executor = MigrationExecutor(connections['default'])
        executor.loader.build_graph()
        node = executor.loader.get_migration('users', MIGRATION_NEW)
        run_python = [op for op in node.operations if op.__class__.__name__ == 'RunPython'][0]
        real_code = run_python.code

        def failing(apps, schema_editor):
            real_code(apps, schema_editor)
            raise RuntimeError('simulated failure after backfill')

        run_python.code = failing
        try:
            with self.assertRaises(RuntimeError):
                executor.migrate([('users', MIGRATION_NEW)])
        finally:
            run_python.code = real_code

        # 跨后端内省读列；计数用标准 SQL，参数绑定统一用 Django 的 %s（两种后端通用）
        col_names = self._column_names('users_staff')
        with connection.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM django_migrations WHERE app='users' AND name=%s",
                [MIGRATION_NEW],
            )
            recorded = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM auth_user")
            users_now = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM users_staff")
            staff_now = cur.fetchone()[0]

        self.stage_check('回滚-user_id 列随 DDL 事务消失', 'user_id' not in col_names,
                         conflict='回填后注入失败', detail={'columns': sorted(col_names)})
        self.stage_check('回滚-迁移未记录', recorded == 0,
                         conflict='回填后注入失败', detail={'recorded': recorded})
        self.stage_check('回滚-无新增账号残留', users_now == users_before,
                         conflict='回填后注入失败', detail={'before': users_before, 'after': users_now})
        self.stage_check('回滚-人员数量不变', staff_now == staff_before,
                         conflict='回填后注入失败', detail={'before': staff_before, 'after': staff_now})

        # 库处于可重试原状：正式升级必须成功并全员关联（此时列已重建，可用当前 ORM）
        call_command('migrate', 'users', verbosity=0, interactive=False)
        Staff = self.model_at('users', 'Staff')
        self.stage_check('失败后重试-全员关联成功',
                         Staff.objects.exclude(user__isnull=True).count() == Staff.objects.count(),
                         conflict='失败后重新升级', detail={})
        # 既有普通账号在失败+成功后仍保持原 id/启停状态，未被顶替或误启用
        User = self.model_at('auth', 'User')
        for username, (old_id, old_active) in ordinary_before.items():
            u = User.objects.get(username=username)
            self.stage_check(f'失败重试后既有账号保持-{username}',
                             u.id == old_id and u.is_active == old_active,
                             conflict={'username': username},
                             detail={'id': (u.id, old_id), 'active': (u.is_active, old_active)})

    def tearDown(self):
        # 每个用例结束把 users 迁回最新节点，保证事务可正常清理
        call_command('migrate', 'users', verbosity=0, interactive=False)
        super().tearDown()
