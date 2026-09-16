<template>
  <section class="workbench">
    <!-- 未登录：登录卡片 -->
    <div v-if="!currentStaff" class="login-card">
      <h2>物业工单工作台</h2>
      <p>请使用物业账号登录，身份以登录会话为准，不能由请求参数指定。</p>
      <el-form @submit.prevent>
        <el-form-item>
          <el-input v-model="loginForm.username" placeholder="账号" size="large" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="loginForm.password" type="password" placeholder="密码" size="large"
                    show-password @keyup.enter="onLogin" />
        </el-form-item>
        <el-button type="primary" size="large" class="full" :loading="loggingIn" @click="onLogin">
          登录
        </el-button>
      </el-form>
      <p class="demo-hint">
        演示账号：wangmin / lilei / zhaoqian，密码统一 rentfind123
      </p>
    </div>

    <!-- 已登录：工作台 -->
    <template v-else>
      <header class="workbench-head">
        <div>
          <h2>物业工单工作台</h2>
          <p>接单后可转派给其他物业人员；待接受期间原处理人不能处理或再次转派。</p>
        </div>
        <div class="workbench-tools">
          <el-tag size="large" type="success">当前身份：{{ currentStaff.name }}</el-tag>
          <el-button :loading="loading" @click="refresh">刷新</el-button>
          <el-button @click="onLogout">退出登录</el-button>
        </div>
      </header>

      <el-table :data="tickets" v-loading="loading" border size="default">
        <el-table-column prop="id" label="工单号" width="80" />
        <el-table-column prop="faultType" label="类型" width="80" />
        <el-table-column prop="description" label="故障描述" min-width="180" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="statusTagType(scope.row.status)">{{ scope.row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="当前处理人" width="110">
          <template #default="scope">{{ scope.row.handlerName ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="转派情况" min-width="200">
          <template #default="scope">
            <template v-if="scope.row.hasPendingTransfer">
              <el-tag type="warning" size="small">待接受</el-tag>
              <span class="transfer-line">
                {{ scope.row.handlerName }} → {{ scope.row.pendingToStaffName }}
              </span>
            </template>
            <span v-else class="muted">无待处理转派</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="scope">
            <el-button v-if="scope.row.status === '已提交' && !scope.row.handlerId"
                       type="primary" size="small"
                       :loading="busy === scope.row.id"
                       @click="onAccept(scope.row)">接单</el-button>

            <template v-if="scope.row.status === '处理中' && scope.row.hasPendingTransfer">
              <template v-if="currentStaff.id === scope.row.pendingToStaffId">
                <el-button type="success" size="small" :loading="busy === scope.row.id"
                           @click="onAcceptTransfer(scope.row)">接受</el-button>
                <el-button type="danger" size="small" :loading="busy === scope.row.id"
                           @click="onRejectTransfer(scope.row)">拒绝</el-button>
              </template>
              <el-tooltip v-else-if="currentStaff.id === scope.row.handlerId"
                          content="转派待接受，期间不能处理或再次转派" placement="top">
                <el-button size="small" disabled>待对方响应</el-button>
              </el-tooltip>
              <span v-else class="muted">等待 {{ scope.row.pendingToStaffName }} 响应</span>
            </template>

            <template v-if="scope.row.status === '处理中' && !scope.row.hasPendingTransfer">
              <el-button type="warning" size="small"
                         :disabled="currentStaff.id !== scope.row.handlerId || busy === scope.row.id"
                         @click="openTransfer(scope.row)">转派</el-button>
              <el-button type="success" size="small"
                         :disabled="currentStaff.id !== scope.row.handlerId || busy === scope.row.id"
                         @click="onComplete(scope.row)">完成</el-button>
            </template>

            <span v-if="scope.row.status === '已完成'" class="muted">工单已结束</span>

            <el-button link type="primary" size="small" @click="openHistory(scope.row)">转派记录</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>

    <!-- 发起转派 -->
    <el-dialog v-model="transferDialogVisible" title="转派工单" width="460px">
      <el-form label-width="92px">
        <el-form-item label="工单">
          <span>#{{ transferForm.ticketId }} {{ transferForm.faultType }}</span>
        </el-form-item>
        <el-form-item label="原处理人">
          <span>{{ transferForm.fromName }}</span>
        </el-form-item>
        <el-form-item label="转给" required>
          <el-select v-model="transferForm.targetStaffId" placeholder="选择物业人员" style="width: 100%">
            <el-option
              v-for="s in transferTargets"
              :key="s.id"
              :label="s.name"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="转派原因" required>
          <el-input v-model="transferForm.reason" type="textarea" :rows="3"
                    placeholder="请写明转派原因" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="transferDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmitTransfer">确认转派</el-button>
      </template>
    </el-dialog>

    <!-- 转派记录 -->
    <el-dialog v-model="historyVisible" title="转派记录" width="520px">
      <el-timeline v-if="historyRecords.length" v-loading="historyLoading">
        <el-timeline-item
          v-for="r in historyRecords"
          :key="r.id"
          :timestamp="formatTime(r)"
          placement="top"
          :type="r.status === '已接受' ? 'success' : r.status === '已拒绝' ? 'danger' : 'warning'"
        >
          <div class="history-item">
            <el-tag :type="historyTagType(r.status)" size="small">{{ r.status }}</el-tag>
            <strong>{{ r.fromStaffName }}</strong> → <strong>{{ r.toStaffName }}</strong>
          </div>
          <p class="history-reason">原因：{{ r.reason }}</p>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else-if="!historyLoading" description="该工单暂无转派记录" />
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  acceptRepair,
  acceptTransfer,
  completeRepair,
  createTransfer,
  getCurrentStaff,
  listRepairs,
  listStaff,
  listTransfers,
  login,
  onUnauthorized,
  rejectTransfer,
} from '../api/client';
import { clearSession, getCurrentStaff as cachedStaff, saveSession } from '../api/auth';
import type { RepairTicket, Staff, TransferRecord, TransferStatus } from '../types/domain';

const staff = ref<Staff[]>([]);
const tickets = ref<RepairTicket[]>([]);
const currentStaff = ref<Staff | null>(null);
const loading = ref(false);
const busy = ref<number | null>(null);

// ---------- 登录态 ----------

const loggingIn = ref(false);
const loginForm = ref({ username: '', password: '' });

onUnauthorized(() => {
  // 令牌失效/过期：清会话并回到登录卡片
  clearSession();
  currentStaff.value = null;
});

async function restoreSession(): Promise<void> {
  if (!cachedStaff()) return;
  try {
    currentStaff.value = await getCurrentStaff();
    await loadStaffList();
    await refresh();
  } catch {
    clearSession();
    currentStaff.value = null;
  }
}

async function onLogin(): Promise<void> {
  if (!loginForm.value.username.trim() || !loginForm.value.password) {
    ElMessage.warning('请输入账号和密码');
    return;
  }
  loggingIn.value = true;
  try {
    const result = await login(loginForm.value.username.trim(), loginForm.value.password);
    saveSession(result);
    currentStaff.value = result.staff;
    ElMessage.success(`欢迎，${result.staff.name}`);
    loginForm.value.password = '';
    await loadStaffList();
    await refresh();
  } catch (error) {
    ElMessage.error((error as Error).message || '登录失败');
  } finally {
    loggingIn.value = false;
  }
}

function onLogout(): void {
  clearSession();
  currentStaff.value = null;
  tickets.value = [];
}

async function loadStaffList(): Promise<void> {
  staff.value = await listStaff();
}

onMounted(restoreSession);

// ---------- 数据 ----------

async function refresh(): Promise<void> {
  if (!currentStaff.value) return; // 未登录（住户视角）不加载工单
  loading.value = true;
  try {
    tickets.value = await listRepairs();
    if (historyVisible.value && historyTicketId.value !== null) {
      await loadHistory(historyTicketId.value);
    }
  } catch (error) {
    ElMessage.error((error as Error).message || '工单加载失败');
  } finally {
    loading.value = false;
  }
}

function statusTagType(status: string): 'info' | 'warning' | 'success' {
  if (status === '已完成') return 'success';
  if (status === '处理中') return 'warning';
  return 'info';
}

function historyTagType(status: TransferStatus): 'warning' | 'success' | 'danger' {
  if (status === '已接受') return 'success';
  if (status === '已拒绝') return 'danger';
  return 'warning';
}

function formatTime(r: TransferRecord): string {
  return r.decidedAt ? `${r.createdAt} 发起 · ${r.decidedAt} 决策` : `${r.createdAt} 发起`;
}

// ---------- 接单 / 完成（身份凭 token） ----------

async function onAccept(row: RepairTicket): Promise<void> {
  busy.value = row.id;
  try {
    await acceptRepair(row.id);
    ElMessage.success(`已接单：工单 #${row.id}`);
    await refresh();
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    busy.value = null;
  }
}

async function onComplete(row: RepairTicket): Promise<void> {
  busy.value = row.id;
  try {
    await completeRepair(row.id);
    ElMessage.success(`工单 #${row.id} 已完成`);
    await refresh();
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    busy.value = null;
  }
}

// ---------- 发起转派 ----------

const transferDialogVisible = ref(false);
const submitting = ref(false);
const transferForm = ref({
  ticketId: 0,
  faultType: '',
  fromName: '',
  targetStaffId: null as number | null,
  reason: '',
});

const transferTargets = computed(() =>
  staff.value.filter((s) => s.id !== currentStaff.value?.id),
);

function openTransfer(row: RepairTicket): void {
  transferForm.value = {
    ticketId: row.id,
    faultType: row.faultType,
    fromName: row.handlerName ?? '',
    targetStaffId: null,
    reason: '',
  };
  transferDialogVisible.value = true;
}

async function onSubmitTransfer(): Promise<void> {
  if (transferForm.value.targetStaffId === null) {
    ElMessage.warning('请选择转派目标人员');
    return;
  }
  if (!transferForm.value.reason.trim()) {
    ElMessage.warning('请填写转派原因');
    return;
  }
  submitting.value = true;
  try {
    await createTransfer(transferForm.value.ticketId, {
      targetStaffId: transferForm.value.targetStaffId,
      reason: transferForm.value.reason.trim(),
    });
    ElMessage.success('转派已发起，等待对方接受');
    transferDialogVisible.value = false;
    await refresh();
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    submitting.value = false;
  }
}

// ---------- 接受 / 拒绝（仅目标本人，凭 token 判定） ----------

async function onAcceptTransfer(row: RepairTicket): Promise<void> {
  if (!row.pendingTransferId) return;
  busy.value = row.id;
  try {
    await acceptTransfer(row.pendingTransferId);
    ElMessage.success(`已接受工单 #${row.id}，归属已切换到你名下`);
    await refresh();
  } catch (error) {
    ElMessage.error((error as Error).message);
    await refresh(); // 可能已被并发先处理：回读真实归属
  } finally {
    busy.value = null;
  }
}

async function onRejectTransfer(row: RepairTicket): Promise<void> {
  if (!row.pendingTransferId) return;
  busy.value = row.id;
  try {
    await rejectTransfer(row.pendingTransferId);
    ElMessage.info(`已拒绝工单 #${row.id}，工单回到原处理人`);
    await refresh();
  } catch (error) {
    ElMessage.error((error as Error).message);
    await refresh();
  } finally {
    busy.value = null;
  }
}

// ---------- 转派记录 ----------

const historyVisible = ref(false);
const historyLoading = ref(false);
const historyTicketId = ref<number | null>(null);
const historyRecords = ref<TransferRecord[]>([]);

async function loadHistory(ticketId: number): Promise<void> {
  historyLoading.value = true;
  try {
    historyRecords.value = await listTransfers(ticketId);
  } finally {
    historyLoading.value = false;
  }
}

async function openHistory(row: RepairTicket): Promise<void> {
  historyTicketId.value = row.id;
  historyRecords.value = [];
  historyVisible.value = true;
  await loadHistory(row.id);
}

defineExpose({ refresh });
</script>
