import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { acceptRepair, acceptTransfer, completeRepair, createTransfer, getCurrentStaff, listRepairs, listStaff, listTransfers, login, onUnauthorized, rejectTransfer, } from '../api/client';
import { clearSession, getCurrentStaff as cachedStaff, saveSession } from '../api/auth';
const staff = ref([]);
const tickets = ref([]);
const currentStaff = ref(null);
const loading = ref(false);
const busy = ref(null);
// ---------- 登录态 ----------
const loggingIn = ref(false);
const loginForm = ref({ username: '', password: '' });
onUnauthorized(() => {
    // 令牌失效/过期：清会话并回到登录卡片
    clearSession();
    currentStaff.value = null;
});
async function restoreSession() {
    if (!cachedStaff())
        return;
    try {
        currentStaff.value = await getCurrentStaff();
        await loadStaffList();
        await refresh();
    }
    catch {
        clearSession();
        currentStaff.value = null;
    }
}
async function onLogin() {
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
    }
    catch (error) {
        ElMessage.error(error.message || '登录失败');
    }
    finally {
        loggingIn.value = false;
    }
}
function onLogout() {
    clearSession();
    currentStaff.value = null;
    tickets.value = [];
}
async function loadStaffList() {
    staff.value = await listStaff();
}
onMounted(restoreSession);
// ---------- 数据 ----------
async function refresh() {
    if (!currentStaff.value)
        return; // 未登录（住户视角）不加载工单
    loading.value = true;
    try {
        tickets.value = await listRepairs();
        if (historyVisible.value && historyTicketId.value !== null) {
            await loadHistory(historyTicketId.value);
        }
    }
    catch (error) {
        ElMessage.error(error.message || '工单加载失败');
    }
    finally {
        loading.value = false;
    }
}
function statusTagType(status) {
    if (status === '已完成')
        return 'success';
    if (status === '处理中')
        return 'warning';
    return 'info';
}
function historyTagType(status) {
    if (status === '已接受')
        return 'success';
    if (status === '已拒绝')
        return 'danger';
    return 'warning';
}
function formatTime(r) {
    return r.decidedAt ? `${r.createdAt} 发起 · ${r.decidedAt} 决策` : `${r.createdAt} 发起`;
}
// ---------- 接单 / 完成（身份凭 token） ----------
async function onAccept(row) {
    busy.value = row.id;
    try {
        await acceptRepair(row.id);
        ElMessage.success(`已接单：工单 #${row.id}`);
        await refresh();
    }
    catch (error) {
        ElMessage.error(error.message);
    }
    finally {
        busy.value = null;
    }
}
async function onComplete(row) {
    busy.value = row.id;
    try {
        await completeRepair(row.id);
        ElMessage.success(`工单 #${row.id} 已完成`);
        await refresh();
    }
    catch (error) {
        ElMessage.error(error.message);
    }
    finally {
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
    targetStaffId: null,
    reason: '',
});
const transferTargets = computed(() => staff.value.filter((s) => s.id !== currentStaff.value?.id));
function openTransfer(row) {
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
    submitting.value = true;
    try {
        await createTransfer(transferForm.value.ticketId, {
            targetStaffId: transferForm.value.targetStaffId,
            reason: transferForm.value.reason.trim(),
        });
        ElMessage.success('转派已发起，等待对方接受');
        transferDialogVisible.value = false;
        await refresh();
    }
    catch (error) {
        ElMessage.error(error.message);
    }
    finally {
        submitting.value = false;
    }
}
// ---------- 接受 / 拒绝（仅目标本人，凭 token 判定） ----------
async function onAcceptTransfer(row) {
    if (!row.pendingTransferId)
        return;
    busy.value = row.id;
    try {
        await acceptTransfer(row.pendingTransferId);
        ElMessage.success(`已接受工单 #${row.id}，归属已切换到你名下`);
        await refresh();
    }
    catch (error) {
        ElMessage.error(error.message);
        await refresh(); // 可能已被并发先处理：回读真实归属
    }
    finally {
        busy.value = null;
    }
}
async function onRejectTransfer(row) {
    if (!row.pendingTransferId)
        return;
    busy.value = row.id;
    try {
        await rejectTransfer(row.pendingTransferId);
        ElMessage.info(`已拒绝工单 #${row.id}，工单回到原处理人`);
        await refresh();
    }
    catch (error) {
        ElMessage.error(error.message);
        await refresh();
    }
    finally {
        busy.value = null;
    }
}
// ---------- 转派记录 ----------
const historyVisible = ref(false);
const historyLoading = ref(false);
const historyTicketId = ref(null);
const historyRecords = ref([]);
async function loadHistory(ticketId) {
    historyLoading.value = true;
    try {
        historyRecords.value = await listTransfers(ticketId);
    }
    finally {
        historyLoading.value = false;
    }
}
async function openHistory(row) {
    historyTicketId.value = row.id;
    historyRecords.value = [];
    historyVisible.value = true;
    await loadHistory(row.id);
}
const __VLS_exposed = { refresh };
defineExpose(__VLS_exposed);
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "workbench" },
});
/** @type {__VLS_StyleScopedClasses['workbench']} */ ;
if (!__VLS_ctx.currentStaff) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "login-card" },
    });
    /** @type {__VLS_StyleScopedClasses['login-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    let __VLS_0;
    /** @ts-ignore @type { | typeof __VLS_components.elForm | typeof __VLS_components.ElForm | typeof __VLS_components['el-form'] | typeof __VLS_components.elForm | typeof __VLS_components.ElForm | typeof __VLS_components['el-form']} */
    elForm;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onSubmit': {} },
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onSubmit': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = {
        /** @type {typeof __VLS_5.submit} */
        onSubmit: () => { },
    };
    const { default: __VLS_7 } = __VLS_3.slots;
    let __VLS_8;
    /** @ts-ignore @type { | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item'] | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item']} */
    elFormItem;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent1(__VLS_8, new __VLS_8({}));
    const __VLS_10 = __VLS_9({}, ...__VLS_functionalComponentArgsRest(__VLS_9));
    const { default: __VLS_13 } = __VLS_11.slots;
    let __VLS_14;
    /** @ts-ignore @type { | typeof __VLS_components.elInput | typeof __VLS_components.ElInput | typeof __VLS_components['el-input']} */
    elInput;
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
        modelValue: (__VLS_ctx.loginForm.username),
        placeholder: "账号",
        size: "large",
    }));
    const __VLS_16 = __VLS_15({
        modelValue: (__VLS_ctx.loginForm.username),
        placeholder: "账号",
        size: "large",
    }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    // @ts-ignore
    [currentStaff, loginForm,];
    var __VLS_11;
    let __VLS_19;
    /** @ts-ignore @type { | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item'] | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item']} */
    elFormItem;
    // @ts-ignore
    const __VLS_20 = __VLS_asFunctionalComponent1(__VLS_19, new __VLS_19({}));
    const __VLS_21 = __VLS_20({}, ...__VLS_functionalComponentArgsRest(__VLS_20));
    const { default: __VLS_24 } = __VLS_22.slots;
    let __VLS_25;
    /** @ts-ignore @type { | typeof __VLS_components.elInput | typeof __VLS_components.ElInput | typeof __VLS_components['el-input']} */
    elInput;
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.loginForm.password),
        type: "password",
        placeholder: "密码",
        size: "large",
        showPassword: true,
    }));
    const __VLS_27 = __VLS_26({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.loginForm.password),
        type: "password",
        placeholder: "密码",
        size: "large",
        showPassword: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_26));
    let __VLS_30;
    const __VLS_31 = {
        /** @type {typeof __VLS_30.keyup} */
        onKeyup: (__VLS_ctx.onLogin),
    };
    var __VLS_28;
    var __VLS_29;
    // @ts-ignore
    [loginForm, onLogin,];
    var __VLS_22;
    let __VLS_32;
    /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
    elButton;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent1(__VLS_32, new __VLS_32({
        ...{ 'onClick': {} },
        type: "primary",
        size: "large",
        ...{ class: "full" },
        loading: (__VLS_ctx.loggingIn),
    }));
    const __VLS_34 = __VLS_33({
        ...{ 'onClick': {} },
        type: "primary",
        size: "large",
        ...{ class: "full" },
        loading: (__VLS_ctx.loggingIn),
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    let __VLS_37;
    const __VLS_38 = {
        /** @type {typeof __VLS_37.click} */
        onClick: (__VLS_ctx.onLogin),
    };
    /** @type {__VLS_StyleScopedClasses['full']} */ ;
    const { default: __VLS_39 } = __VLS_35.slots;
    // @ts-ignore
    [onLogin, loggingIn,];
    var __VLS_35;
    var __VLS_36;
    // @ts-ignore
    [];
    var __VLS_3;
    var __VLS_4;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "demo-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['demo-hint']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
        ...{ class: "workbench-head" },
    });
    /** @type {__VLS_StyleScopedClasses['workbench-head']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "workbench-tools" },
    });
    /** @type {__VLS_StyleScopedClasses['workbench-tools']} */ ;
    let __VLS_40;
    /** @ts-ignore @type { | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag'] | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag']} */
    elTag;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({
        size: "large",
        type: "success",
    }));
    const __VLS_42 = __VLS_41({
        size: "large",
        type: "success",
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    const { default: __VLS_45 } = __VLS_43.slots;
    (__VLS_ctx.currentStaff.name);
    // @ts-ignore
    [currentStaff,];
    var __VLS_43;
    let __VLS_46;
    /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
    elButton;
    // @ts-ignore
    const __VLS_47 = __VLS_asFunctionalComponent1(__VLS_46, new __VLS_46({
        ...{ 'onClick': {} },
        loading: (__VLS_ctx.loading),
    }));
    const __VLS_48 = __VLS_47({
        ...{ 'onClick': {} },
        loading: (__VLS_ctx.loading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_47));
    let __VLS_51;
    const __VLS_52 = {
        /** @type {typeof __VLS_51.click} */
        onClick: (__VLS_ctx.refresh),
    };
    const { default: __VLS_53 } = __VLS_49.slots;
    // @ts-ignore
    [loading, refresh,];
    var __VLS_49;
    var __VLS_50;
    let __VLS_54;
    /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
    elButton;
    // @ts-ignore
    const __VLS_55 = __VLS_asFunctionalComponent1(__VLS_54, new __VLS_54({
        ...{ 'onClick': {} },
    }));
    const __VLS_56 = __VLS_55({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_55));
    let __VLS_59;
    const __VLS_60 = {
        /** @type {typeof __VLS_59.click} */
        onClick: (__VLS_ctx.onLogout),
    };
    const { default: __VLS_61 } = __VLS_57.slots;
    // @ts-ignore
    [onLogout,];
    var __VLS_57;
    var __VLS_58;
    let __VLS_62;
    /** @ts-ignore @type { | typeof __VLS_components.elTable | typeof __VLS_components.ElTable | typeof __VLS_components['el-table'] | typeof __VLS_components.elTable | typeof __VLS_components.ElTable | typeof __VLS_components['el-table']} */
    elTable;
    // @ts-ignore
    const __VLS_63 = __VLS_asFunctionalComponent1(__VLS_62, new __VLS_62({
        data: (__VLS_ctx.tickets),
        border: true,
        size: "default",
    }));
    const __VLS_64 = __VLS_63({
        data: (__VLS_ctx.tickets),
        border: true,
        size: "default",
    }, ...__VLS_functionalComponentArgsRest(__VLS_63));
    __VLS_asFunctionalDirective(__VLS_directives.vLoading, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading), }, null, null);
    const { default: __VLS_67 } = __VLS_65.slots;
    let __VLS_68;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent1(__VLS_68, new __VLS_68({
        prop: "id",
        label: "工单号",
        width: "80",
    }));
    const __VLS_70 = __VLS_69({
        prop: "id",
        label: "工单号",
        width: "80",
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    let __VLS_73;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_74 = __VLS_asFunctionalComponent1(__VLS_73, new __VLS_73({
        prop: "faultType",
        label: "类型",
        width: "80",
    }));
    const __VLS_75 = __VLS_74({
        prop: "faultType",
        label: "类型",
        width: "80",
    }, ...__VLS_functionalComponentArgsRest(__VLS_74));
    let __VLS_78;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_79 = __VLS_asFunctionalComponent1(__VLS_78, new __VLS_78({
        prop: "description",
        label: "故障描述",
        minWidth: "180",
        showOverflowTooltip: true,
    }));
    const __VLS_80 = __VLS_79({
        prop: "description",
        label: "故障描述",
        minWidth: "180",
        showOverflowTooltip: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_79));
    let __VLS_83;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column'] | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_84 = __VLS_asFunctionalComponent1(__VLS_83, new __VLS_83({
        label: "状态",
        width: "100",
    }));
    const __VLS_85 = __VLS_84({
        label: "状态",
        width: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_84));
    const { default: __VLS_88 } = __VLS_86.slots;
    {
        const { default: __VLS_89 } = __VLS_86.slots;
        const [scope] = __VLS_vSlot(__VLS_89);
        let __VLS_90;
        /** @ts-ignore @type { | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag'] | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag']} */
        elTag;
        // @ts-ignore
        const __VLS_91 = __VLS_asFunctionalComponent1(__VLS_90, new __VLS_90({
            type: (__VLS_ctx.statusTagType(scope.row.status)),
        }));
        const __VLS_92 = __VLS_91({
            type: (__VLS_ctx.statusTagType(scope.row.status)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_91));
        const { default: __VLS_95 } = __VLS_93.slots;
        (scope.row.status);
        // @ts-ignore
        [loading, tickets, vLoading, statusTagType,];
        var __VLS_93;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_86;
    let __VLS_96;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column'] | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent1(__VLS_96, new __VLS_96({
        label: "当前处理人",
        width: "110",
    }));
    const __VLS_98 = __VLS_97({
        label: "当前处理人",
        width: "110",
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    const { default: __VLS_101 } = __VLS_99.slots;
    {
        const { default: __VLS_102 } = __VLS_99.slots;
        const [scope] = __VLS_vSlot(__VLS_102);
        (scope.row.handlerName ?? '—');
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_99;
    let __VLS_103;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column'] | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_104 = __VLS_asFunctionalComponent1(__VLS_103, new __VLS_103({
        label: "转派情况",
        minWidth: "200",
    }));
    const __VLS_105 = __VLS_104({
        label: "转派情况",
        minWidth: "200",
    }, ...__VLS_functionalComponentArgsRest(__VLS_104));
    const { default: __VLS_108 } = __VLS_106.slots;
    {
        const { default: __VLS_109 } = __VLS_106.slots;
        const [scope] = __VLS_vSlot(__VLS_109);
        if (scope.row.hasPendingTransfer) {
            let __VLS_110;
            /** @ts-ignore @type { | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag'] | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag']} */
            elTag;
            // @ts-ignore
            const __VLS_111 = __VLS_asFunctionalComponent1(__VLS_110, new __VLS_110({
                type: "warning",
                size: "small",
            }));
            const __VLS_112 = __VLS_111({
                type: "warning",
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_111));
            const { default: __VLS_115 } = __VLS_113.slots;
            // @ts-ignore
            [];
            var __VLS_113;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "transfer-line" },
            });
            /** @type {__VLS_StyleScopedClasses['transfer-line']} */ ;
            (scope.row.handlerName);
            (scope.row.pendingToStaffName);
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        }
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_106;
    let __VLS_116;
    /** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column'] | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
    elTableColumn;
    // @ts-ignore
    const __VLS_117 = __VLS_asFunctionalComponent1(__VLS_116, new __VLS_116({
        label: "操作",
        width: "320",
        fixed: "right",
    }));
    const __VLS_118 = __VLS_117({
        label: "操作",
        width: "320",
        fixed: "right",
    }, ...__VLS_functionalComponentArgsRest(__VLS_117));
    const { default: __VLS_121 } = __VLS_119.slots;
    {
        const { default: __VLS_122 } = __VLS_119.slots;
        const [scope] = __VLS_vSlot(__VLS_122);
        if (scope.row.status === '已提交' && !scope.row.handlerId) {
            let __VLS_123;
            /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
            elButton;
            // @ts-ignore
            const __VLS_124 = __VLS_asFunctionalComponent1(__VLS_123, new __VLS_123({
                ...{ 'onClick': {} },
                type: "primary",
                size: "small",
                loading: (__VLS_ctx.busy === scope.row.id),
            }));
            const __VLS_125 = __VLS_124({
                ...{ 'onClick': {} },
                type: "primary",
                size: "small",
                loading: (__VLS_ctx.busy === scope.row.id),
            }, ...__VLS_functionalComponentArgsRest(__VLS_124));
            let __VLS_128;
            const __VLS_129 = {
                /** @type {typeof __VLS_128.click} */
                onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.currentStaff))
                        throw 0;
                    if (!(scope.row.status === '已提交' && !scope.row.handlerId))
                        throw 0;
                    return (__VLS_ctx.onAccept(scope.row));
                    // @ts-ignore
                    [busy, onAccept,];
                },
            };
            const { default: __VLS_130 } = __VLS_126.slots;
            // @ts-ignore
            [];
            var __VLS_126;
            var __VLS_127;
        }
        if (scope.row.status === '处理中' && scope.row.hasPendingTransfer) {
            if (__VLS_ctx.currentStaff.id === scope.row.pendingToStaffId) {
                let __VLS_131;
                /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
                elButton;
                // @ts-ignore
                const __VLS_132 = __VLS_asFunctionalComponent1(__VLS_131, new __VLS_131({
                    ...{ 'onClick': {} },
                    type: "success",
                    size: "small",
                    loading: (__VLS_ctx.busy === scope.row.id),
                }));
                const __VLS_133 = __VLS_132({
                    ...{ 'onClick': {} },
                    type: "success",
                    size: "small",
                    loading: (__VLS_ctx.busy === scope.row.id),
                }, ...__VLS_functionalComponentArgsRest(__VLS_132));
                let __VLS_136;
                const __VLS_137 = {
                    /** @type {typeof __VLS_136.click} */
                    onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.currentStaff))
                            throw 0;
                        if (!(scope.row.status === '处理中' && scope.row.hasPendingTransfer))
                            throw 0;
                        if (!(__VLS_ctx.currentStaff.id === scope.row.pendingToStaffId))
                            throw 0;
                        return (__VLS_ctx.onAcceptTransfer(scope.row));
                        // @ts-ignore
                        [currentStaff, busy, onAcceptTransfer,];
                    },
                };
                const { default: __VLS_138 } = __VLS_134.slots;
                // @ts-ignore
                [];
                var __VLS_134;
                var __VLS_135;
                let __VLS_139;
                /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
                elButton;
                // @ts-ignore
                const __VLS_140 = __VLS_asFunctionalComponent1(__VLS_139, new __VLS_139({
                    ...{ 'onClick': {} },
                    type: "danger",
                    size: "small",
                    loading: (__VLS_ctx.busy === scope.row.id),
                }));
                const __VLS_141 = __VLS_140({
                    ...{ 'onClick': {} },
                    type: "danger",
                    size: "small",
                    loading: (__VLS_ctx.busy === scope.row.id),
                }, ...__VLS_functionalComponentArgsRest(__VLS_140));
                let __VLS_144;
                const __VLS_145 = {
                    /** @type {typeof __VLS_144.click} */
                    onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.currentStaff))
                            throw 0;
                        if (!(scope.row.status === '处理中' && scope.row.hasPendingTransfer))
                            throw 0;
                        if (!(__VLS_ctx.currentStaff.id === scope.row.pendingToStaffId))
                            throw 0;
                        return (__VLS_ctx.onRejectTransfer(scope.row));
                        // @ts-ignore
                        [busy, onRejectTransfer,];
                    },
                };
                const { default: __VLS_146 } = __VLS_142.slots;
                // @ts-ignore
                [];
                var __VLS_142;
                var __VLS_143;
            }
            else if (__VLS_ctx.currentStaff.id === scope.row.handlerId) {
                let __VLS_147;
                /** @ts-ignore @type { | typeof __VLS_components.elTooltip | typeof __VLS_components.ElTooltip | typeof __VLS_components['el-tooltip'] | typeof __VLS_components.elTooltip | typeof __VLS_components.ElTooltip | typeof __VLS_components['el-tooltip']} */
                elTooltip;
                // @ts-ignore
                const __VLS_148 = __VLS_asFunctionalComponent1(__VLS_147, new __VLS_147({
                    content: "转派待接受，期间不能处理或再次转派",
                    placement: "top",
                }));
                const __VLS_149 = __VLS_148({
                    content: "转派待接受，期间不能处理或再次转派",
                    placement: "top",
                }, ...__VLS_functionalComponentArgsRest(__VLS_148));
                const { default: __VLS_152 } = __VLS_150.slots;
                let __VLS_153;
                /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
                elButton;
                // @ts-ignore
                const __VLS_154 = __VLS_asFunctionalComponent1(__VLS_153, new __VLS_153({
                    size: "small",
                    disabled: true,
                }));
                const __VLS_155 = __VLS_154({
                    size: "small",
                    disabled: true,
                }, ...__VLS_functionalComponentArgsRest(__VLS_154));
                const { default: __VLS_158 } = __VLS_156.slots;
                // @ts-ignore
                [currentStaff,];
                var __VLS_156;
                // @ts-ignore
                [];
                var __VLS_150;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                (scope.row.pendingToStaffName);
            }
        }
        if (scope.row.status === '处理中' && !scope.row.hasPendingTransfer) {
            let __VLS_159;
            /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
            elButton;
            // @ts-ignore
            const __VLS_160 = __VLS_asFunctionalComponent1(__VLS_159, new __VLS_159({
                ...{ 'onClick': {} },
                type: "warning",
                size: "small",
                disabled: (__VLS_ctx.currentStaff.id !== scope.row.handlerId || __VLS_ctx.busy === scope.row.id),
            }));
            const __VLS_161 = __VLS_160({
                ...{ 'onClick': {} },
                type: "warning",
                size: "small",
                disabled: (__VLS_ctx.currentStaff.id !== scope.row.handlerId || __VLS_ctx.busy === scope.row.id),
            }, ...__VLS_functionalComponentArgsRest(__VLS_160));
            let __VLS_164;
            const __VLS_165 = {
                /** @type {typeof __VLS_164.click} */
                onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.currentStaff))
                        throw 0;
                    if (!(scope.row.status === '处理中' && !scope.row.hasPendingTransfer))
                        throw 0;
                    return (__VLS_ctx.openTransfer(scope.row));
                    // @ts-ignore
                    [currentStaff, busy, openTransfer,];
                },
            };
            const { default: __VLS_166 } = __VLS_162.slots;
            // @ts-ignore
            [];
            var __VLS_162;
            var __VLS_163;
            let __VLS_167;
            /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
            elButton;
            // @ts-ignore
            const __VLS_168 = __VLS_asFunctionalComponent1(__VLS_167, new __VLS_167({
                ...{ 'onClick': {} },
                type: "success",
                size: "small",
                disabled: (__VLS_ctx.currentStaff.id !== scope.row.handlerId || __VLS_ctx.busy === scope.row.id),
            }));
            const __VLS_169 = __VLS_168({
                ...{ 'onClick': {} },
                type: "success",
                size: "small",
                disabled: (__VLS_ctx.currentStaff.id !== scope.row.handlerId || __VLS_ctx.busy === scope.row.id),
            }, ...__VLS_functionalComponentArgsRest(__VLS_168));
            let __VLS_172;
            const __VLS_173 = {
                /** @type {typeof __VLS_172.click} */
                onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.currentStaff))
                        throw 0;
                    if (!(scope.row.status === '处理中' && !scope.row.hasPendingTransfer))
                        throw 0;
                    return (__VLS_ctx.onComplete(scope.row));
                    // @ts-ignore
                    [currentStaff, busy, onComplete,];
                },
            };
            const { default: __VLS_174 } = __VLS_170.slots;
            // @ts-ignore
            [];
            var __VLS_170;
            var __VLS_171;
        }
        if (scope.row.status === '已完成') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        }
        let __VLS_175;
        /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
        elButton;
        // @ts-ignore
        const __VLS_176 = __VLS_asFunctionalComponent1(__VLS_175, new __VLS_175({
            ...{ 'onClick': {} },
            link: true,
            type: "primary",
            size: "small",
        }));
        const __VLS_177 = __VLS_176({
            ...{ 'onClick': {} },
            link: true,
            type: "primary",
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_176));
        let __VLS_180;
        const __VLS_181 = {
            /** @type {typeof __VLS_180.click} */
            onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.currentStaff))
                    throw 0;
                return (__VLS_ctx.openHistory(scope.row));
                // @ts-ignore
                [openHistory,];
            },
        };
        const { default: __VLS_182 } = __VLS_178.slots;
        // @ts-ignore
        [];
        var __VLS_178;
        var __VLS_179;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_119;
    // @ts-ignore
    [];
    var __VLS_65;
}
let __VLS_183;
/** @ts-ignore @type { | typeof __VLS_components.elDialog | typeof __VLS_components.ElDialog | typeof __VLS_components['el-dialog'] | typeof __VLS_components.elDialog | typeof __VLS_components.ElDialog | typeof __VLS_components['el-dialog']} */
elDialog;
// @ts-ignore
const __VLS_184 = __VLS_asFunctionalComponent1(__VLS_183, new __VLS_183({
    modelValue: (__VLS_ctx.transferDialogVisible),
    title: "转派工单",
    width: "460px",
}));
const __VLS_185 = __VLS_184({
    modelValue: (__VLS_ctx.transferDialogVisible),
    title: "转派工单",
    width: "460px",
}, ...__VLS_functionalComponentArgsRest(__VLS_184));
const { default: __VLS_188 } = __VLS_186.slots;
let __VLS_189;
/** @ts-ignore @type { | typeof __VLS_components.elForm | typeof __VLS_components.ElForm | typeof __VLS_components['el-form'] | typeof __VLS_components.elForm | typeof __VLS_components.ElForm | typeof __VLS_components['el-form']} */
elForm;
// @ts-ignore
const __VLS_190 = __VLS_asFunctionalComponent1(__VLS_189, new __VLS_189({
    labelWidth: "92px",
}));
const __VLS_191 = __VLS_190({
    labelWidth: "92px",
}, ...__VLS_functionalComponentArgsRest(__VLS_190));
const { default: __VLS_194 } = __VLS_192.slots;
let __VLS_195;
/** @ts-ignore @type { | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item'] | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item']} */
elFormItem;
// @ts-ignore
const __VLS_196 = __VLS_asFunctionalComponent1(__VLS_195, new __VLS_195({
    label: "工单",
}));
const __VLS_197 = __VLS_196({
    label: "工单",
}, ...__VLS_functionalComponentArgsRest(__VLS_196));
const { default: __VLS_200 } = __VLS_198.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.transferForm.ticketId);
(__VLS_ctx.transferForm.faultType);
// @ts-ignore
[transferDialogVisible, transferForm, transferForm,];
var __VLS_198;
let __VLS_201;
/** @ts-ignore @type { | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item'] | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item']} */
elFormItem;
// @ts-ignore
const __VLS_202 = __VLS_asFunctionalComponent1(__VLS_201, new __VLS_201({
    label: "原处理人",
}));
const __VLS_203 = __VLS_202({
    label: "原处理人",
}, ...__VLS_functionalComponentArgsRest(__VLS_202));
const { default: __VLS_206 } = __VLS_204.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.transferForm.fromName);
// @ts-ignore
[transferForm,];
var __VLS_204;
let __VLS_207;
/** @ts-ignore @type { | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item'] | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item']} */
elFormItem;
// @ts-ignore
const __VLS_208 = __VLS_asFunctionalComponent1(__VLS_207, new __VLS_207({
    label: "转给",
    required: true,
}));
const __VLS_209 = __VLS_208({
    label: "转给",
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_208));
const { default: __VLS_212 } = __VLS_210.slots;
let __VLS_213;
/** @ts-ignore @type { | typeof __VLS_components.elSelect | typeof __VLS_components.ElSelect | typeof __VLS_components['el-select'] | typeof __VLS_components.elSelect | typeof __VLS_components.ElSelect | typeof __VLS_components['el-select']} */
elSelect;
// @ts-ignore
const __VLS_214 = __VLS_asFunctionalComponent1(__VLS_213, new __VLS_213({
    modelValue: (__VLS_ctx.transferForm.targetStaffId),
    placeholder: "选择物业人员",
    ...{ style: {} },
}));
const __VLS_215 = __VLS_214({
    modelValue: (__VLS_ctx.transferForm.targetStaffId),
    placeholder: "选择物业人员",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_214));
const { default: __VLS_218 } = __VLS_216.slots;
for (const [s] of __VLS_vFor((__VLS_ctx.transferTargets))) {
    let __VLS_219;
    /** @ts-ignore @type { | typeof __VLS_components.elOption | typeof __VLS_components.ElOption | typeof __VLS_components['el-option']} */
    elOption;
    // @ts-ignore
    const __VLS_220 = __VLS_asFunctionalComponent1(__VLS_219, new __VLS_219({
        key: (s.id),
        label: (s.name),
        value: (s.id),
    }));
    const __VLS_221 = __VLS_220({
        key: (s.id),
        label: (s.name),
        value: (s.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_220));
    // @ts-ignore
    [transferForm, transferTargets,];
}
// @ts-ignore
[];
var __VLS_216;
// @ts-ignore
[];
var __VLS_210;
let __VLS_224;
/** @ts-ignore @type { | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item'] | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item']} */
elFormItem;
// @ts-ignore
const __VLS_225 = __VLS_asFunctionalComponent1(__VLS_224, new __VLS_224({
    label: "转派原因",
    required: true,
}));
const __VLS_226 = __VLS_225({
    label: "转派原因",
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_225));
const { default: __VLS_229 } = __VLS_227.slots;
let __VLS_230;
/** @ts-ignore @type { | typeof __VLS_components.elInput | typeof __VLS_components.ElInput | typeof __VLS_components['el-input']} */
elInput;
// @ts-ignore
const __VLS_231 = __VLS_asFunctionalComponent1(__VLS_230, new __VLS_230({
    modelValue: (__VLS_ctx.transferForm.reason),
    type: "textarea",
    rows: (3),
    placeholder: "请写明转派原因",
    maxlength: "200",
    showWordLimit: true,
}));
const __VLS_232 = __VLS_231({
    modelValue: (__VLS_ctx.transferForm.reason),
    type: "textarea",
    rows: (3),
    placeholder: "请写明转派原因",
    maxlength: "200",
    showWordLimit: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_231));
// @ts-ignore
[transferForm,];
var __VLS_227;
// @ts-ignore
[];
var __VLS_192;
{
    const { footer: __VLS_235 } = __VLS_186.slots;
    let __VLS_236;
    /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
    elButton;
    // @ts-ignore
    const __VLS_237 = __VLS_asFunctionalComponent1(__VLS_236, new __VLS_236({
        ...{ 'onClick': {} },
    }));
    const __VLS_238 = __VLS_237({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_237));
    let __VLS_241;
    const __VLS_242 = {
        /** @type {typeof __VLS_241.click} */
        onClick: (...[$event]) => {
            return (__VLS_ctx.transferDialogVisible = false);
            // @ts-ignore
            [transferDialogVisible,];
        },
    };
    const { default: __VLS_243 } = __VLS_239.slots;
    // @ts-ignore
    [];
    var __VLS_239;
    var __VLS_240;
    let __VLS_244;
    /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
    elButton;
    // @ts-ignore
    const __VLS_245 = __VLS_asFunctionalComponent1(__VLS_244, new __VLS_244({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.submitting),
    }));
    const __VLS_246 = __VLS_245({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.submitting),
    }, ...__VLS_functionalComponentArgsRest(__VLS_245));
    let __VLS_249;
    const __VLS_250 = {
        /** @type {typeof __VLS_249.click} */
        onClick: (__VLS_ctx.onSubmitTransfer),
    };
    const { default: __VLS_251 } = __VLS_247.slots;
    // @ts-ignore
    [submitting, onSubmitTransfer,];
    var __VLS_247;
    var __VLS_248;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_186;
let __VLS_252;
/** @ts-ignore @type { | typeof __VLS_components.elDialog | typeof __VLS_components.ElDialog | typeof __VLS_components['el-dialog'] | typeof __VLS_components.elDialog | typeof __VLS_components.ElDialog | typeof __VLS_components['el-dialog']} */
elDialog;
// @ts-ignore
const __VLS_253 = __VLS_asFunctionalComponent1(__VLS_252, new __VLS_252({
    modelValue: (__VLS_ctx.historyVisible),
    title: "转派记录",
    width: "520px",
}));
const __VLS_254 = __VLS_253({
    modelValue: (__VLS_ctx.historyVisible),
    title: "转派记录",
    width: "520px",
}, ...__VLS_functionalComponentArgsRest(__VLS_253));
const { default: __VLS_257 } = __VLS_255.slots;
if (__VLS_ctx.historyRecords.length) {
    let __VLS_258;
    /** @ts-ignore @type { | typeof __VLS_components.elTimeline | typeof __VLS_components.ElTimeline | typeof __VLS_components['el-timeline'] | typeof __VLS_components.elTimeline | typeof __VLS_components.ElTimeline | typeof __VLS_components['el-timeline']} */
    elTimeline;
    // @ts-ignore
    const __VLS_259 = __VLS_asFunctionalComponent1(__VLS_258, new __VLS_258({}));
    const __VLS_260 = __VLS_259({}, ...__VLS_functionalComponentArgsRest(__VLS_259));
    __VLS_asFunctionalDirective(__VLS_directives.vLoading, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.historyLoading), }, null, null);
    const { default: __VLS_263 } = __VLS_261.slots;
    for (const [r] of __VLS_vFor((__VLS_ctx.historyRecords))) {
        let __VLS_264;
        /** @ts-ignore @type { | typeof __VLS_components.elTimelineItem | typeof __VLS_components.ElTimelineItem | typeof __VLS_components['el-timeline-item'] | typeof __VLS_components.elTimelineItem | typeof __VLS_components.ElTimelineItem | typeof __VLS_components['el-timeline-item']} */
        elTimelineItem;
        // @ts-ignore
        const __VLS_265 = __VLS_asFunctionalComponent1(__VLS_264, new __VLS_264({
            key: (r.id),
            timestamp: (__VLS_ctx.formatTime(r)),
            placement: "top",
            type: (r.status === '已接受' ? 'success' : r.status === '已拒绝' ? 'danger' : 'warning'),
        }));
        const __VLS_266 = __VLS_265({
            key: (r.id),
            timestamp: (__VLS_ctx.formatTime(r)),
            placement: "top",
            type: (r.status === '已接受' ? 'success' : r.status === '已拒绝' ? 'danger' : 'warning'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_265));
        const { default: __VLS_269 } = __VLS_267.slots;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "history-item" },
        });
        /** @type {__VLS_StyleScopedClasses['history-item']} */ ;
        let __VLS_270;
        /** @ts-ignore @type { | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag'] | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag']} */
        elTag;
        // @ts-ignore
        const __VLS_271 = __VLS_asFunctionalComponent1(__VLS_270, new __VLS_270({
            type: (__VLS_ctx.historyTagType(r.status)),
            size: "small",
        }));
        const __VLS_272 = __VLS_271({
            type: (__VLS_ctx.historyTagType(r.status)),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_271));
        const { default: __VLS_275 } = __VLS_273.slots;
        (r.status);
        // @ts-ignore
        [vLoading, historyVisible, historyRecords, historyRecords, historyLoading, formatTime, historyTagType,];
        var __VLS_273;
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (r.fromStaffName);
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (r.toStaffName);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "history-reason" },
        });
        /** @type {__VLS_StyleScopedClasses['history-reason']} */ ;
        (r.reason);
        // @ts-ignore
        [];
        var __VLS_267;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_261;
}
else if (!__VLS_ctx.historyLoading) {
    let __VLS_276;
    /** @ts-ignore @type { | typeof __VLS_components.elEmpty | typeof __VLS_components.ElEmpty | typeof __VLS_components['el-empty']} */
    elEmpty;
    // @ts-ignore
    const __VLS_277 = __VLS_asFunctionalComponent1(__VLS_276, new __VLS_276({
        description: "该工单暂无转派记录",
    }));
    const __VLS_278 = __VLS_277({
        description: "该工单暂无转派记录",
    }, ...__VLS_functionalComponentArgsRest(__VLS_277));
}
// @ts-ignore
[historyLoading,];
var __VLS_255;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    setup: () => __VLS_exposed,
});
export default {};
