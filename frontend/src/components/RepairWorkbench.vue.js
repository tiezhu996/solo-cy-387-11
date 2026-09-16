import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { acceptRepair, acceptTransfer, completeRepair, createTransfer, listRepairs, listStaff, listTransfers, rejectTransfer, } from '../api/client';
const staff = ref([]);
const tickets = ref([]);
const currentStaffId = ref(null);
const loading = ref(false);
const busy = ref(null);
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
    }
    catch (error) {
        ElMessage.error(error.message || '工单加载失败');
    }
    finally {
        loading.value = false;
    }
}
onMounted(async () => {
    try {
        await loadStaff();
        await refresh();
    }
    catch (error) {
        ElMessage.error(error.message);
    }
});
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
// ---------- 接单 / 完成 ----------
async function onAccept(row) {
    if (!currentStaffId.value)
        return;
    busy.value = row.id;
    try {
        await acceptRepair(row.id, currentStaffId.value);
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
    if (!currentStaffId.value)
        return;
    busy.value = row.id;
    try {
        await completeRepair(row.id, currentStaffId.value);
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
const transferTargets = computed(() => staff.value.filter((s) => s.name !== transferForm.value.fromName));
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
    if (!currentStaffId.value)
        return;
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
    }
    catch (error) {
        ElMessage.error(error.message);
    }
    finally {
        submitting.value = false;
    }
}
// ---------- 接受 / 拒绝 ----------
async function onAcceptTransfer(row) {
    if (!currentStaffId.value || !row.pendingTransferId)
        return;
    busy.value = row.id;
    try {
        await acceptTransfer(row.pendingTransferId, currentStaffId.value);
        ElMessage.success(`已接受工单 #${row.id}，归属已切换到你名下`);
        await refresh();
    }
    catch (error) {
        ElMessage.error(error.message);
        await refresh(); // 可能已被对方先处理：刷新回读真实归属
    }
    finally {
        busy.value = null;
    }
}
async function onRejectTransfer(row) {
    if (!currentStaffId.value || !row.pendingTransferId)
        return;
    busy.value = row.id;
    try {
        await rejectTransfer(row.pendingTransferId, currentStaffId.value);
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
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.elSelect | typeof __VLS_components.ElSelect | typeof __VLS_components['el-select'] | typeof __VLS_components.elSelect | typeof __VLS_components.ElSelect | typeof __VLS_components['el-select']} */
elSelect;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.currentStaffId),
    placeholder: "选择当前操作身份",
    ...{ style: {} },
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.currentStaffId),
    placeholder: "选择当前操作身份",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
for (const [s] of __VLS_vFor((__VLS_ctx.staff))) {
    let __VLS_6;
    /** @ts-ignore @type { | typeof __VLS_components.elOption | typeof __VLS_components.ElOption | typeof __VLS_components['el-option']} */
    elOption;
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
        key: (s.id),
        label: (`${s.name}（${s.phone || '物业'}）`),
        value: (s.id),
    }));
    const __VLS_8 = __VLS_7({
        key: (s.id),
        label: (`${s.name}（${s.phone || '物业'}）`),
        value: (s.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_7));
    // @ts-ignore
    [currentStaffId, staff,];
}
// @ts-ignore
[];
var __VLS_3;
let __VLS_11;
/** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
elButton;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent1(__VLS_11, new __VLS_11({
    ...{ 'onClick': {} },
    loading: (__VLS_ctx.loading),
}));
const __VLS_13 = __VLS_12({
    ...{ 'onClick': {} },
    loading: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
let __VLS_16;
const __VLS_17 = {
    /** @type {typeof __VLS_16.click} */
    onClick: (__VLS_ctx.refresh),
};
const { default: __VLS_18 } = __VLS_14.slots;
// @ts-ignore
[loading, refresh,];
var __VLS_14;
var __VLS_15;
if (!__VLS_ctx.currentStaffId) {
    let __VLS_19;
    /** @ts-ignore @type { | typeof __VLS_components.elAlert | typeof __VLS_components.ElAlert | typeof __VLS_components['el-alert']} */
    elAlert;
    // @ts-ignore
    const __VLS_20 = __VLS_asFunctionalComponent1(__VLS_19, new __VLS_19({
        type: "info",
        closable: (false),
        title: "请先在右上角选择当前登录的物业人员身份",
        ...{ style: {} },
    }));
    const __VLS_21 = __VLS_20({
        type: "info",
        closable: (false),
        title: "请先在右上角选择当前登录的物业人员身份",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_20));
}
let __VLS_24;
/** @ts-ignore @type { | typeof __VLS_components.elTable | typeof __VLS_components.ElTable | typeof __VLS_components['el-table'] | typeof __VLS_components.elTable | typeof __VLS_components.ElTable | typeof __VLS_components['el-table']} */
elTable;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent1(__VLS_24, new __VLS_24({
    data: (__VLS_ctx.tickets),
    border: true,
    size: "default",
}));
const __VLS_26 = __VLS_25({
    data: (__VLS_ctx.tickets),
    border: true,
    size: "default",
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_asFunctionalDirective(__VLS_directives.vLoading, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading), }, null, null);
const { default: __VLS_29 } = __VLS_27.slots;
let __VLS_30;
/** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
elTableColumn;
// @ts-ignore
const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({
    prop: "id",
    label: "工单号",
    width: "80",
}));
const __VLS_32 = __VLS_31({
    prop: "id",
    label: "工单号",
    width: "80",
}, ...__VLS_functionalComponentArgsRest(__VLS_31));
let __VLS_35;
/** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
elTableColumn;
// @ts-ignore
const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({
    prop: "faultType",
    label: "类型",
    width: "80",
}));
const __VLS_37 = __VLS_36({
    prop: "faultType",
    label: "类型",
    width: "80",
}, ...__VLS_functionalComponentArgsRest(__VLS_36));
let __VLS_40;
/** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
elTableColumn;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({
    prop: "description",
    label: "故障描述",
    minWidth: "180",
    showOverflowTooltip: true,
}));
const __VLS_42 = __VLS_41({
    prop: "description",
    label: "故障描述",
    minWidth: "180",
    showOverflowTooltip: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
let __VLS_45;
/** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column'] | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
elTableColumn;
// @ts-ignore
const __VLS_46 = __VLS_asFunctionalComponent1(__VLS_45, new __VLS_45({
    label: "状态",
    width: "100",
}));
const __VLS_47 = __VLS_46({
    label: "状态",
    width: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_46));
const { default: __VLS_50 } = __VLS_48.slots;
{
    const { default: __VLS_51 } = __VLS_48.slots;
    const [scope] = __VLS_vSlot(__VLS_51);
    let __VLS_52;
    /** @ts-ignore @type { | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag'] | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag']} */
    elTag;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent1(__VLS_52, new __VLS_52({
        type: (__VLS_ctx.statusTagType(scope.row.status)),
    }));
    const __VLS_54 = __VLS_53({
        type: (__VLS_ctx.statusTagType(scope.row.status)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    const { default: __VLS_57 } = __VLS_55.slots;
    (scope.row.status);
    // @ts-ignore
    [currentStaffId, loading, tickets, vLoading, statusTagType,];
    var __VLS_55;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_48;
let __VLS_58;
/** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column'] | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
elTableColumn;
// @ts-ignore
const __VLS_59 = __VLS_asFunctionalComponent1(__VLS_58, new __VLS_58({
    label: "当前处理人",
    width: "110",
}));
const __VLS_60 = __VLS_59({
    label: "当前处理人",
    width: "110",
}, ...__VLS_functionalComponentArgsRest(__VLS_59));
const { default: __VLS_63 } = __VLS_61.slots;
{
    const { default: __VLS_64 } = __VLS_61.slots;
    const [scope] = __VLS_vSlot(__VLS_64);
    (scope.row.handlerName ?? '—');
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_61;
let __VLS_65;
/** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column'] | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
elTableColumn;
// @ts-ignore
const __VLS_66 = __VLS_asFunctionalComponent1(__VLS_65, new __VLS_65({
    label: "转派情况",
    minWidth: "200",
}));
const __VLS_67 = __VLS_66({
    label: "转派情况",
    minWidth: "200",
}, ...__VLS_functionalComponentArgsRest(__VLS_66));
const { default: __VLS_70 } = __VLS_68.slots;
{
    const { default: __VLS_71 } = __VLS_68.slots;
    const [scope] = __VLS_vSlot(__VLS_71);
    if (scope.row.hasPendingTransfer) {
        let __VLS_72;
        /** @ts-ignore @type { | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag'] | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag']} */
        elTag;
        // @ts-ignore
        const __VLS_73 = __VLS_asFunctionalComponent1(__VLS_72, new __VLS_72({
            type: "warning",
            size: "small",
        }));
        const __VLS_74 = __VLS_73({
            type: "warning",
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_73));
        const { default: __VLS_77 } = __VLS_75.slots;
        // @ts-ignore
        [];
        var __VLS_75;
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
var __VLS_68;
let __VLS_78;
/** @ts-ignore @type { | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column'] | typeof __VLS_components.elTableColumn | typeof __VLS_components.ElTableColumn | typeof __VLS_components['el-table-column']} */
elTableColumn;
// @ts-ignore
const __VLS_79 = __VLS_asFunctionalComponent1(__VLS_78, new __VLS_78({
    label: "操作",
    width: "320",
    fixed: "right",
}));
const __VLS_80 = __VLS_79({
    label: "操作",
    width: "320",
    fixed: "right",
}, ...__VLS_functionalComponentArgsRest(__VLS_79));
const { default: __VLS_83 } = __VLS_81.slots;
{
    const { default: __VLS_84 } = __VLS_81.slots;
    const [scope] = __VLS_vSlot(__VLS_84);
    if (scope.row.status === '已提交' && !scope.row.handlerId) {
        let __VLS_85;
        /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
        elButton;
        // @ts-ignore
        const __VLS_86 = __VLS_asFunctionalComponent1(__VLS_85, new __VLS_85({
            ...{ 'onClick': {} },
            type: "primary",
            size: "small",
            disabled: (!__VLS_ctx.currentStaffId || __VLS_ctx.busy === scope.row.id),
        }));
        const __VLS_87 = __VLS_86({
            ...{ 'onClick': {} },
            type: "primary",
            size: "small",
            disabled: (!__VLS_ctx.currentStaffId || __VLS_ctx.busy === scope.row.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_86));
        let __VLS_90;
        const __VLS_91 = {
            /** @type {typeof __VLS_90.click} */
            onClick: (...[$event]) => {
                if (!(scope.row.status === '已提交' && !scope.row.handlerId))
                    throw 0;
                return (__VLS_ctx.onAccept(scope.row));
                // @ts-ignore
                [currentStaffId, busy, onAccept,];
            },
        };
        const { default: __VLS_92 } = __VLS_88.slots;
        // @ts-ignore
        [];
        var __VLS_88;
        var __VLS_89;
    }
    if (scope.row.status === '处理中' && scope.row.hasPendingTransfer) {
        if (__VLS_ctx.currentStaffId === scope.row.pendingToStaffId) {
            let __VLS_93;
            /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
            elButton;
            // @ts-ignore
            const __VLS_94 = __VLS_asFunctionalComponent1(__VLS_93, new __VLS_93({
                ...{ 'onClick': {} },
                type: "success",
                size: "small",
                loading: (__VLS_ctx.busy === scope.row.id),
            }));
            const __VLS_95 = __VLS_94({
                ...{ 'onClick': {} },
                type: "success",
                size: "small",
                loading: (__VLS_ctx.busy === scope.row.id),
            }, ...__VLS_functionalComponentArgsRest(__VLS_94));
            let __VLS_98;
            const __VLS_99 = {
                /** @type {typeof __VLS_98.click} */
                onClick: (...[$event]) => {
                    if (!(scope.row.status === '处理中' && scope.row.hasPendingTransfer))
                        throw 0;
                    if (!(__VLS_ctx.currentStaffId === scope.row.pendingToStaffId))
                        throw 0;
                    return (__VLS_ctx.onAcceptTransfer(scope.row));
                    // @ts-ignore
                    [currentStaffId, busy, onAcceptTransfer,];
                },
            };
            const { default: __VLS_100 } = __VLS_96.slots;
            // @ts-ignore
            [];
            var __VLS_96;
            var __VLS_97;
            let __VLS_101;
            /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
            elButton;
            // @ts-ignore
            const __VLS_102 = __VLS_asFunctionalComponent1(__VLS_101, new __VLS_101({
                ...{ 'onClick': {} },
                type: "danger",
                size: "small",
                loading: (__VLS_ctx.busy === scope.row.id),
            }));
            const __VLS_103 = __VLS_102({
                ...{ 'onClick': {} },
                type: "danger",
                size: "small",
                loading: (__VLS_ctx.busy === scope.row.id),
            }, ...__VLS_functionalComponentArgsRest(__VLS_102));
            let __VLS_106;
            const __VLS_107 = {
                /** @type {typeof __VLS_106.click} */
                onClick: (...[$event]) => {
                    if (!(scope.row.status === '处理中' && scope.row.hasPendingTransfer))
                        throw 0;
                    if (!(__VLS_ctx.currentStaffId === scope.row.pendingToStaffId))
                        throw 0;
                    return (__VLS_ctx.onRejectTransfer(scope.row));
                    // @ts-ignore
                    [busy, onRejectTransfer,];
                },
            };
            const { default: __VLS_108 } = __VLS_104.slots;
            // @ts-ignore
            [];
            var __VLS_104;
            var __VLS_105;
        }
        else if (__VLS_ctx.currentStaffId === scope.row.handlerId) {
            let __VLS_109;
            /** @ts-ignore @type { | typeof __VLS_components.elTooltip | typeof __VLS_components.ElTooltip | typeof __VLS_components['el-tooltip'] | typeof __VLS_components.elTooltip | typeof __VLS_components.ElTooltip | typeof __VLS_components['el-tooltip']} */
            elTooltip;
            // @ts-ignore
            const __VLS_110 = __VLS_asFunctionalComponent1(__VLS_109, new __VLS_109({
                content: "转派待接受，期间不能处理或再次转派",
                placement: "top",
            }));
            const __VLS_111 = __VLS_110({
                content: "转派待接受，期间不能处理或再次转派",
                placement: "top",
            }, ...__VLS_functionalComponentArgsRest(__VLS_110));
            const { default: __VLS_114 } = __VLS_112.slots;
            let __VLS_115;
            /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
            elButton;
            // @ts-ignore
            const __VLS_116 = __VLS_asFunctionalComponent1(__VLS_115, new __VLS_115({
                size: "small",
                disabled: true,
            }));
            const __VLS_117 = __VLS_116({
                size: "small",
                disabled: true,
            }, ...__VLS_functionalComponentArgsRest(__VLS_116));
            const { default: __VLS_120 } = __VLS_118.slots;
            // @ts-ignore
            [currentStaffId,];
            var __VLS_118;
            // @ts-ignore
            [];
            var __VLS_112;
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
        let __VLS_121;
        /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
        elButton;
        // @ts-ignore
        const __VLS_122 = __VLS_asFunctionalComponent1(__VLS_121, new __VLS_121({
            ...{ 'onClick': {} },
            type: "warning",
            size: "small",
            disabled: (__VLS_ctx.currentStaffId !== scope.row.handlerId || __VLS_ctx.busy === scope.row.id),
        }));
        const __VLS_123 = __VLS_122({
            ...{ 'onClick': {} },
            type: "warning",
            size: "small",
            disabled: (__VLS_ctx.currentStaffId !== scope.row.handlerId || __VLS_ctx.busy === scope.row.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_122));
        let __VLS_126;
        const __VLS_127 = {
            /** @type {typeof __VLS_126.click} */
            onClick: (...[$event]) => {
                if (!(scope.row.status === '处理中' && !scope.row.hasPendingTransfer))
                    throw 0;
                return (__VLS_ctx.openTransfer(scope.row));
                // @ts-ignore
                [currentStaffId, busy, openTransfer,];
            },
        };
        const { default: __VLS_128 } = __VLS_124.slots;
        // @ts-ignore
        [];
        var __VLS_124;
        var __VLS_125;
        let __VLS_129;
        /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
        elButton;
        // @ts-ignore
        const __VLS_130 = __VLS_asFunctionalComponent1(__VLS_129, new __VLS_129({
            ...{ 'onClick': {} },
            type: "success",
            size: "small",
            disabled: (__VLS_ctx.currentStaffId !== scope.row.handlerId || __VLS_ctx.busy === scope.row.id),
        }));
        const __VLS_131 = __VLS_130({
            ...{ 'onClick': {} },
            type: "success",
            size: "small",
            disabled: (__VLS_ctx.currentStaffId !== scope.row.handlerId || __VLS_ctx.busy === scope.row.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_130));
        let __VLS_134;
        const __VLS_135 = {
            /** @type {typeof __VLS_134.click} */
            onClick: (...[$event]) => {
                if (!(scope.row.status === '处理中' && !scope.row.hasPendingTransfer))
                    throw 0;
                return (__VLS_ctx.onComplete(scope.row));
                // @ts-ignore
                [currentStaffId, busy, onComplete,];
            },
        };
        const { default: __VLS_136 } = __VLS_132.slots;
        // @ts-ignore
        [];
        var __VLS_132;
        var __VLS_133;
    }
    if (scope.row.status === '已完成') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    let __VLS_137;
    /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
    elButton;
    // @ts-ignore
    const __VLS_138 = __VLS_asFunctionalComponent1(__VLS_137, new __VLS_137({
        ...{ 'onClick': {} },
        link: true,
        type: "primary",
        size: "small",
    }));
    const __VLS_139 = __VLS_138({
        ...{ 'onClick': {} },
        link: true,
        type: "primary",
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_138));
    let __VLS_142;
    const __VLS_143 = {
        /** @type {typeof __VLS_142.click} */
        onClick: (...[$event]) => {
            return (__VLS_ctx.openHistory(scope.row));
            // @ts-ignore
            [openHistory,];
        },
    };
    const { default: __VLS_144 } = __VLS_140.slots;
    // @ts-ignore
    [];
    var __VLS_140;
    var __VLS_141;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_81;
// @ts-ignore
[];
var __VLS_27;
let __VLS_145;
/** @ts-ignore @type { | typeof __VLS_components.elDialog | typeof __VLS_components.ElDialog | typeof __VLS_components['el-dialog'] | typeof __VLS_components.elDialog | typeof __VLS_components.ElDialog | typeof __VLS_components['el-dialog']} */
elDialog;
// @ts-ignore
const __VLS_146 = __VLS_asFunctionalComponent1(__VLS_145, new __VLS_145({
    modelValue: (__VLS_ctx.transferDialogVisible),
    title: "转派工单",
    width: "460px",
}));
const __VLS_147 = __VLS_146({
    modelValue: (__VLS_ctx.transferDialogVisible),
    title: "转派工单",
    width: "460px",
}, ...__VLS_functionalComponentArgsRest(__VLS_146));
const { default: __VLS_150 } = __VLS_148.slots;
let __VLS_151;
/** @ts-ignore @type { | typeof __VLS_components.elForm | typeof __VLS_components.ElForm | typeof __VLS_components['el-form'] | typeof __VLS_components.elForm | typeof __VLS_components.ElForm | typeof __VLS_components['el-form']} */
elForm;
// @ts-ignore
const __VLS_152 = __VLS_asFunctionalComponent1(__VLS_151, new __VLS_151({
    labelWidth: "92px",
}));
const __VLS_153 = __VLS_152({
    labelWidth: "92px",
}, ...__VLS_functionalComponentArgsRest(__VLS_152));
const { default: __VLS_156 } = __VLS_154.slots;
let __VLS_157;
/** @ts-ignore @type { | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item'] | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item']} */
elFormItem;
// @ts-ignore
const __VLS_158 = __VLS_asFunctionalComponent1(__VLS_157, new __VLS_157({
    label: "工单",
}));
const __VLS_159 = __VLS_158({
    label: "工单",
}, ...__VLS_functionalComponentArgsRest(__VLS_158));
const { default: __VLS_162 } = __VLS_160.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.transferForm.ticketId);
(__VLS_ctx.transferForm.faultType);
// @ts-ignore
[transferDialogVisible, transferForm, transferForm,];
var __VLS_160;
let __VLS_163;
/** @ts-ignore @type { | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item'] | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item']} */
elFormItem;
// @ts-ignore
const __VLS_164 = __VLS_asFunctionalComponent1(__VLS_163, new __VLS_163({
    label: "原处理人",
}));
const __VLS_165 = __VLS_164({
    label: "原处理人",
}, ...__VLS_functionalComponentArgsRest(__VLS_164));
const { default: __VLS_168 } = __VLS_166.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.transferForm.fromName);
// @ts-ignore
[transferForm,];
var __VLS_166;
let __VLS_169;
/** @ts-ignore @type { | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item'] | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item']} */
elFormItem;
// @ts-ignore
const __VLS_170 = __VLS_asFunctionalComponent1(__VLS_169, new __VLS_169({
    label: "转给",
    required: true,
}));
const __VLS_171 = __VLS_170({
    label: "转给",
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_170));
const { default: __VLS_174 } = __VLS_172.slots;
let __VLS_175;
/** @ts-ignore @type { | typeof __VLS_components.elSelect | typeof __VLS_components.ElSelect | typeof __VLS_components['el-select'] | typeof __VLS_components.elSelect | typeof __VLS_components.ElSelect | typeof __VLS_components['el-select']} */
elSelect;
// @ts-ignore
const __VLS_176 = __VLS_asFunctionalComponent1(__VLS_175, new __VLS_175({
    modelValue: (__VLS_ctx.transferForm.targetStaffId),
    placeholder: "选择物业人员",
    ...{ style: {} },
}));
const __VLS_177 = __VLS_176({
    modelValue: (__VLS_ctx.transferForm.targetStaffId),
    placeholder: "选择物业人员",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_176));
const { default: __VLS_180 } = __VLS_178.slots;
for (const [s] of __VLS_vFor((__VLS_ctx.transferTargets))) {
    let __VLS_181;
    /** @ts-ignore @type { | typeof __VLS_components.elOption | typeof __VLS_components.ElOption | typeof __VLS_components['el-option']} */
    elOption;
    // @ts-ignore
    const __VLS_182 = __VLS_asFunctionalComponent1(__VLS_181, new __VLS_181({
        key: (s.id),
        label: (s.name),
        value: (s.id),
    }));
    const __VLS_183 = __VLS_182({
        key: (s.id),
        label: (s.name),
        value: (s.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_182));
    // @ts-ignore
    [transferForm, transferTargets,];
}
// @ts-ignore
[];
var __VLS_178;
// @ts-ignore
[];
var __VLS_172;
let __VLS_186;
/** @ts-ignore @type { | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item'] | typeof __VLS_components.elFormItem | typeof __VLS_components.ElFormItem | typeof __VLS_components['el-form-item']} */
elFormItem;
// @ts-ignore
const __VLS_187 = __VLS_asFunctionalComponent1(__VLS_186, new __VLS_186({
    label: "转派原因",
    required: true,
}));
const __VLS_188 = __VLS_187({
    label: "转派原因",
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_187));
const { default: __VLS_191 } = __VLS_189.slots;
let __VLS_192;
/** @ts-ignore @type { | typeof __VLS_components.elInput | typeof __VLS_components.ElInput | typeof __VLS_components['el-input']} */
elInput;
// @ts-ignore
const __VLS_193 = __VLS_asFunctionalComponent1(__VLS_192, new __VLS_192({
    modelValue: (__VLS_ctx.transferForm.reason),
    type: "textarea",
    rows: (3),
    placeholder: "请写明转派原因",
    maxlength: "200",
    showWordLimit: true,
}));
const __VLS_194 = __VLS_193({
    modelValue: (__VLS_ctx.transferForm.reason),
    type: "textarea",
    rows: (3),
    placeholder: "请写明转派原因",
    maxlength: "200",
    showWordLimit: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_193));
// @ts-ignore
[transferForm,];
var __VLS_189;
// @ts-ignore
[];
var __VLS_154;
{
    const { footer: __VLS_197 } = __VLS_148.slots;
    let __VLS_198;
    /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
    elButton;
    // @ts-ignore
    const __VLS_199 = __VLS_asFunctionalComponent1(__VLS_198, new __VLS_198({
        ...{ 'onClick': {} },
    }));
    const __VLS_200 = __VLS_199({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_199));
    let __VLS_203;
    const __VLS_204 = {
        /** @type {typeof __VLS_203.click} */
        onClick: (...[$event]) => {
            return (__VLS_ctx.transferDialogVisible = false);
            // @ts-ignore
            [transferDialogVisible,];
        },
    };
    const { default: __VLS_205 } = __VLS_201.slots;
    // @ts-ignore
    [];
    var __VLS_201;
    var __VLS_202;
    let __VLS_206;
    /** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
    elButton;
    // @ts-ignore
    const __VLS_207 = __VLS_asFunctionalComponent1(__VLS_206, new __VLS_206({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.submitting),
    }));
    const __VLS_208 = __VLS_207({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.submitting),
    }, ...__VLS_functionalComponentArgsRest(__VLS_207));
    let __VLS_211;
    const __VLS_212 = {
        /** @type {typeof __VLS_211.click} */
        onClick: (__VLS_ctx.onSubmitTransfer),
    };
    const { default: __VLS_213 } = __VLS_209.slots;
    // @ts-ignore
    [submitting, onSubmitTransfer,];
    var __VLS_209;
    var __VLS_210;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_148;
let __VLS_214;
/** @ts-ignore @type { | typeof __VLS_components.elDialog | typeof __VLS_components.ElDialog | typeof __VLS_components['el-dialog'] | typeof __VLS_components.elDialog | typeof __VLS_components.ElDialog | typeof __VLS_components['el-dialog']} */
elDialog;
// @ts-ignore
const __VLS_215 = __VLS_asFunctionalComponent1(__VLS_214, new __VLS_214({
    modelValue: (__VLS_ctx.historyVisible),
    title: "转派记录",
    width: "520px",
}));
const __VLS_216 = __VLS_215({
    modelValue: (__VLS_ctx.historyVisible),
    title: "转派记录",
    width: "520px",
}, ...__VLS_functionalComponentArgsRest(__VLS_215));
const { default: __VLS_219 } = __VLS_217.slots;
if (__VLS_ctx.historyRecords.length) {
    let __VLS_220;
    /** @ts-ignore @type { | typeof __VLS_components.elTimeline | typeof __VLS_components.ElTimeline | typeof __VLS_components['el-timeline'] | typeof __VLS_components.elTimeline | typeof __VLS_components.ElTimeline | typeof __VLS_components['el-timeline']} */
    elTimeline;
    // @ts-ignore
    const __VLS_221 = __VLS_asFunctionalComponent1(__VLS_220, new __VLS_220({}));
    const __VLS_222 = __VLS_221({}, ...__VLS_functionalComponentArgsRest(__VLS_221));
    __VLS_asFunctionalDirective(__VLS_directives.vLoading, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.historyLoading), }, null, null);
    const { default: __VLS_225 } = __VLS_223.slots;
    for (const [r] of __VLS_vFor((__VLS_ctx.historyRecords))) {
        let __VLS_226;
        /** @ts-ignore @type { | typeof __VLS_components.elTimelineItem | typeof __VLS_components.ElTimelineItem | typeof __VLS_components['el-timeline-item'] | typeof __VLS_components.elTimelineItem | typeof __VLS_components.ElTimelineItem | typeof __VLS_components['el-timeline-item']} */
        elTimelineItem;
        // @ts-ignore
        const __VLS_227 = __VLS_asFunctionalComponent1(__VLS_226, new __VLS_226({
            key: (r.id),
            timestamp: (r.decidedAt ? `${r.createdAt} 发起 · ${r.decidedAt} 决策` : `${r.createdAt} 发起`),
            placement: "top",
            type: (r.status === '已接受' ? 'success' : r.status === '已拒绝' ? 'danger' : 'warning'),
        }));
        const __VLS_228 = __VLS_227({
            key: (r.id),
            timestamp: (r.decidedAt ? `${r.createdAt} 发起 · ${r.decidedAt} 决策` : `${r.createdAt} 发起`),
            placement: "top",
            type: (r.status === '已接受' ? 'success' : r.status === '已拒绝' ? 'danger' : 'warning'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_227));
        const { default: __VLS_231 } = __VLS_229.slots;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "history-item" },
        });
        /** @type {__VLS_StyleScopedClasses['history-item']} */ ;
        let __VLS_232;
        /** @ts-ignore @type { | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag'] | typeof __VLS_components.elTag | typeof __VLS_components.ElTag | typeof __VLS_components['el-tag']} */
        elTag;
        // @ts-ignore
        const __VLS_233 = __VLS_asFunctionalComponent1(__VLS_232, new __VLS_232({
            type: (__VLS_ctx.historyTagType(r.status)),
            size: "small",
        }));
        const __VLS_234 = __VLS_233({
            type: (__VLS_ctx.historyTagType(r.status)),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_233));
        const { default: __VLS_237 } = __VLS_235.slots;
        (r.status);
        // @ts-ignore
        [vLoading, historyVisible, historyRecords, historyRecords, historyLoading, historyTagType,];
        var __VLS_235;
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
        var __VLS_229;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_223;
}
else if (!__VLS_ctx.historyLoading) {
    let __VLS_238;
    /** @ts-ignore @type { | typeof __VLS_components.elEmpty | typeof __VLS_components.ElEmpty | typeof __VLS_components['el-empty']} */
    elEmpty;
    // @ts-ignore
    const __VLS_239 = __VLS_asFunctionalComponent1(__VLS_238, new __VLS_238({
        description: "该工单暂无转派记录",
    }));
    const __VLS_240 = __VLS_239({
        description: "该工单暂无转派记录",
    }, ...__VLS_functionalComponentArgsRest(__VLS_239));
}
// @ts-ignore
[historyLoading,];
var __VLS_217;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    setup: () => __VLS_exposed,
});
export default {};
