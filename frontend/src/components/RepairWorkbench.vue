<template>
  <section class="workbench">
    <header class="workbench-head">
      <div>
        <h2>物业工单工作台</h2>
        <p>接单后可转派给其他物业人员；待接受期间原处理人不能处理或再次转派。</p>
      </div>
      <div class="workbench-tools">
        <el-select v-model="currentStaffId" placeholder="选择当前操作身份" style="width: 200px">
          <el-option v-for="s in staff" :key="s.id" :label="`${s.name}（${s.phone || '物业'}）`" :value="s.id" />
        </el-select>
        <el-button :loading="loading" @click="refresh">刷新</el-button>
      </div>
    </header>

    <el-alert
      v-if="!currentStaffId"
      type="info"
      :closable="false"
      title="请先在右上角选择当前登录的物业人员身份"
      style="margin-bottom: 12px"
    />

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
                     :disabled="!currentStaffId || busy === scope.row.id"
                     @click="onAccept(scope.row)">接单</el-button>

          <template v-if="scope.row.status === '处理中' && scope.row.hasPendingTransfer">
            <template v-if="currentStaffId === scope.row.pendingToStaffId">
              <el-button type="success" size="small" :loading="busy === scope.row.id"
                         @click="onAcceptTransfer(scope.row)">接受</el-button>
              <el-button type="danger" size="small" :loading="busy === scope.row.id"
                         @click="onRejectTransfer(scope.row)">拒绝</el-button>
            </template>
            <el-tooltip v-else-if="currentStaffId === scope.row.handlerId"
                        content="转派待接受，期间不能处理或再次转派" placement="top">
              <el-button size="small" disabled>待对方响应</el-button>
            </el-tooltip>
            <span v-else class="muted">等待 {{ scope.row.pendingToStaffName }} 响应</span>
          </template>

          <template v-if="scope.row.status === '处理中' && !scope.row.hasPendingTransfer">
            <el-button type="warning" size="small"
                       :disabled="currentStaffId !== scope.row.handlerId || busy === scope.row.id"
                       @click="openTransfer(scope.row)">转派</el-button>
            <el-button type="success" size="small"
                       :disabled="currentStaffId !== scope.row.handlerId || busy === scope.row.id"
                       @click="onComplete(scope.row)">完成</el-button>
          </template>

          <span v-if="scope.row.status === '已完成'" class="muted">工单已结束</span>

          <el-button link type="primary" size="small" @click="openHistory(scope.row)">转派记录</el-button>
        </template>
      </el-table-column>
    </el-table>

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
          :timestamp="r.decidedAt ? `${r.createdAt} 发起 · ${r.decidedAt} 决策` : `${r.createdAt} 发起`"
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
  listRepairs,
  listStaff,
  listTransfers,
  rejectTransfer,
} from '../api/client';
import type { RepairTicket, Staff, TransferRecord, TransferStatus } from '../types/domain';

const staff = ref<Staff[]>([]);
const tickets = ref<RepairTicket[]>([]);
const currentStaffId = ref<number | null>(null);
const loading = ref(false);
const busy = ref<number | null>(null);

async function loadStaff() {
  staff.value = await listStaff();
  if (!currentStaffId.value && staff.value.length) {
    currentStaffId.value = staff.value[0].id;
  }
}

async function refresh() {
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

onMounted(async () => {
  try {
    await loadStaff();
    await refresh();
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
});

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

// ---------- 接单 / 完成 ----------

async function onAccept(row: RepairTicket) {
  if (!currentStaffId.value) return;
  busy.value = row.id;
  try {
    await acceptRepair(row.id, currentStaffId.value);
    ElMessage.success(`已接单：工单 #${row.id}`);
    await refresh();
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    busy.value = null;
  }
}

async function onComplete(row: RepairTicket) {
  if (!currentStaffId.value) return;
  busy.value = row.id;
  try {
    await completeRepair(row.id, currentStaffId.value);
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
  staff.value.filter((s) => s.name !== transferForm.value.fromName),
);

function openTransfer(row: RepairTicket) {
  transferForm.value = {
    ticketId: row.id,
    faultType: row.faultType,
    fromName: row.handlerName ?? '',
    targetStaffId: null,
    reason: '',
  };
  transferDialogVisible.value = true;
}

async function onSubmitTransfer() {
  if (transferForm.value.targetStaffId === null) {
    ElMessage.warning('请选择转派目标人员');
    return;
  }
  if (!transferForm.value.reason.trim()) {
    ElMessage.warning('请填写转派原因');
    return;
  }
  if (!currentStaffId.value) return;
  submitting.value = true;
  try {
    await createTransfer(transferForm.value.ticketId, {
      staffId: currentStaffId.value,
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

// ---------- 接受 / 拒绝 ----------

async function onAcceptTransfer(row: RepairTicket) {
  if (!currentStaffId.value || !row.pendingTransferId) return;
  busy.value = row.id;
  try {
    await acceptTransfer(row.pendingTransferId, currentStaffId.value);
    ElMessage.success(`已接受工单 #${row.id}，归属已切换到你名下`);
    await refresh();
  } catch (error) {
    ElMessage.error((error as Error).message);
    await refresh(); // 可能已被对方先处理：刷新回读真实归属
  } finally {
    busy.value = null;
  }
}

async function onRejectTransfer(row: RepairTicket) {
  if (!currentStaffId.value || !row.pendingTransferId) return;
  busy.value = row.id;
  try {
    await rejectTransfer(row.pendingTransferId, currentStaffId.value);
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

async function loadHistory(ticketId: number) {
  historyLoading.value = true;
  try {
    historyRecords.value = await listTransfers(ticketId);
  } finally {
    historyLoading.value = false;
  }
}

async function openHistory(row: RepairTicket) {
  historyTicketId.value = row.id;
  historyRecords.value = [];
  historyVisible.value = true;
  await loadHistory(row.id);
}

defineExpose({ refresh });
</script>
