import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import PropertyCard from '../components/PropertyCard.vue';
import RepairWorkbench from '../components/RepairWorkbench.vue';
import { createRepair, getProperties } from '../api/client';
const properties = ref([]);
const mode = ref('列表视图');
const region = ref('');
const maxRent = ref(7000);
const layout = ref('全部');
const faultType = ref('水电');
const description = ref('');
const notice = ref('等待提交');
const submitting = ref(false);
const workbenchRef = ref(null);
onMounted(async () => {
    try {
        properties.value = await getProperties();
    }
    catch (error) {
        ElMessage.error(error.message);
    }
});
const filtered = computed(() => properties.value.filter((item) => {
    const hitRegion = !region.value || item.region.includes(region.value);
    const hitRent = item.rent <= maxRent.value;
    const hitLayout = layout.value === '全部' || item.layout === layout.value;
    return hitRegion && hitRent && hitLayout;
}));
async function submitRepair() {
    if (!description.value.trim()) {
        ElMessage.warning('请描述故障情况');
        return;
    }
    submitting.value = true;
    try {
        const ticket = await createRepair({ faultType: faultType.value, description: description.value });
        notice.value = `工单 ${ticket.id} 已提交：${ticket.status}`;
        description.value = '';
        // 新工单即时出现在下方工作台，刷新后仍可回读
        await workbenchRef.value?.refresh();
    }
    catch (error) {
        ElMessage.error(error.message);
    }
    finally {
        submitting.value = false;
    }
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({
    ...{ class: "page" },
});
/** @type {__VLS_StyleScopedClasses['page']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "toolbar" },
});
/** @type {__VLS_StyleScopedClasses['toolbar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.elSegmented | typeof __VLS_components.ElSegmented | typeof __VLS_components['el-segmented']} */
elSegmented;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.mode),
    options: (['列表视图', '地图视图']),
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.mode),
    options: (['列表视图', '地图视图']),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "filters" },
});
/** @type {__VLS_StyleScopedClasses['filters']} */ ;
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.elInput | typeof __VLS_components.ElInput | typeof __VLS_components['el-input']} */
elInput;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    modelValue: (__VLS_ctx.region),
    placeholder: "区域",
}));
const __VLS_7 = __VLS_6({
    modelValue: (__VLS_ctx.region),
    placeholder: "区域",
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
let __VLS_10;
/** @ts-ignore @type { | typeof __VLS_components.elInputNumber | typeof __VLS_components.ElInputNumber | typeof __VLS_components['el-input-number']} */
elInputNumber;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    modelValue: (__VLS_ctx.maxRent),
    min: (1000),
    step: (500),
}));
const __VLS_12 = __VLS_11({
    modelValue: (__VLS_ctx.maxRent),
    min: (1000),
    step: (500),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
let __VLS_15;
/** @ts-ignore @type { | typeof __VLS_components.elSelect | typeof __VLS_components.ElSelect | typeof __VLS_components['el-select'] | typeof __VLS_components.elSelect | typeof __VLS_components.ElSelect | typeof __VLS_components['el-select']} */
elSelect;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    modelValue: (__VLS_ctx.layout),
    placeholder: "户型",
}));
const __VLS_17 = __VLS_16({
    modelValue: (__VLS_ctx.layout),
    placeholder: "户型",
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
const { default: __VLS_20 } = __VLS_18.slots;
let __VLS_21;
/** @ts-ignore @type { | typeof __VLS_components.elOption | typeof __VLS_components.ElOption | typeof __VLS_components['el-option']} */
elOption;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
    label: "全部",
    value: "全部",
}));
const __VLS_23 = __VLS_22({
    label: "全部",
    value: "全部",
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
let __VLS_26;
/** @ts-ignore @type { | typeof __VLS_components.elOption | typeof __VLS_components.ElOption | typeof __VLS_components['el-option']} */
elOption;
// @ts-ignore
const __VLS_27 = __VLS_asFunctionalComponent1(__VLS_26, new __VLS_26({
    label: "一室一厅",
    value: "一室一厅",
}));
const __VLS_28 = __VLS_27({
    label: "一室一厅",
    value: "一室一厅",
}, ...__VLS_functionalComponentArgsRest(__VLS_27));
let __VLS_31;
/** @ts-ignore @type { | typeof __VLS_components.elOption | typeof __VLS_components.ElOption | typeof __VLS_components['el-option']} */
elOption;
// @ts-ignore
const __VLS_32 = __VLS_asFunctionalComponent1(__VLS_31, new __VLS_31({
    label: "两室一厅",
    value: "两室一厅",
}));
const __VLS_33 = __VLS_32({
    label: "两室一厅",
    value: "两室一厅",
}, ...__VLS_functionalComponentArgsRest(__VLS_32));
let __VLS_36;
/** @ts-ignore @type { | typeof __VLS_components.elOption | typeof __VLS_components.ElOption | typeof __VLS_components['el-option']} */
elOption;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent1(__VLS_36, new __VLS_36({
    label: "三室两厅",
    value: "三室两厅",
}));
const __VLS_38 = __VLS_37({
    label: "三室两厅",
    value: "三室两厅",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
// @ts-ignore
[mode, region, maxRent, layout,];
var __VLS_18;
if (__VLS_ctx.mode === '地图视图') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "map-panel" },
    });
    /** @type {__VLS_StyleScopedClasses['map-panel']} */ ;
    (__VLS_ctx.filtered.length);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
for (const [item] of __VLS_vFor((__VLS_ctx.filtered))) {
    const __VLS_41 = PropertyCard;
    // @ts-ignore
    const __VLS_42 = __VLS_asFunctionalComponent1(__VLS_41, new __VLS_41({
        key: (item.id),
        item: (item),
    }));
    const __VLS_43 = __VLS_42({
        key: (item.id),
        item: (item),
    }, ...__VLS_functionalComponentArgsRest(__VLS_42));
    // @ts-ignore
    [mode, filtered, filtered,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "repair" },
});
/** @type {__VLS_StyleScopedClasses['repair']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "repair-title" },
});
/** @type {__VLS_StyleScopedClasses['repair-title']} */ ;
let __VLS_46;
/** @ts-ignore @type { | typeof __VLS_components.elSelect | typeof __VLS_components.ElSelect | typeof __VLS_components['el-select'] | typeof __VLS_components.elSelect | typeof __VLS_components.ElSelect | typeof __VLS_components['el-select']} */
elSelect;
// @ts-ignore
const __VLS_47 = __VLS_asFunctionalComponent1(__VLS_46, new __VLS_46({
    modelValue: (__VLS_ctx.faultType),
}));
const __VLS_48 = __VLS_47({
    modelValue: (__VLS_ctx.faultType),
}, ...__VLS_functionalComponentArgsRest(__VLS_47));
const { default: __VLS_51 } = __VLS_49.slots;
let __VLS_52;
/** @ts-ignore @type { | typeof __VLS_components.elOption | typeof __VLS_components.ElOption | typeof __VLS_components['el-option']} */
elOption;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent1(__VLS_52, new __VLS_52({
    label: "水电",
    value: "水电",
}));
const __VLS_54 = __VLS_53({
    label: "水电",
    value: "水电",
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
let __VLS_57;
/** @ts-ignore @type { | typeof __VLS_components.elOption | typeof __VLS_components.ElOption | typeof __VLS_components['el-option']} */
elOption;
// @ts-ignore
const __VLS_58 = __VLS_asFunctionalComponent1(__VLS_57, new __VLS_57({
    label: "门锁",
    value: "门锁",
}));
const __VLS_59 = __VLS_58({
    label: "门锁",
    value: "门锁",
}, ...__VLS_functionalComponentArgsRest(__VLS_58));
let __VLS_62;
/** @ts-ignore @type { | typeof __VLS_components.elOption | typeof __VLS_components.ElOption | typeof __VLS_components['el-option']} */
elOption;
// @ts-ignore
const __VLS_63 = __VLS_asFunctionalComponent1(__VLS_62, new __VLS_62({
    label: "管道",
    value: "管道",
}));
const __VLS_64 = __VLS_63({
    label: "管道",
    value: "管道",
}, ...__VLS_functionalComponentArgsRest(__VLS_63));
let __VLS_67;
/** @ts-ignore @type { | typeof __VLS_components.elOption | typeof __VLS_components.ElOption | typeof __VLS_components['el-option']} */
elOption;
// @ts-ignore
const __VLS_68 = __VLS_asFunctionalComponent1(__VLS_67, new __VLS_67({
    label: "家电",
    value: "家电",
}));
const __VLS_69 = __VLS_68({
    label: "家电",
    value: "家电",
}, ...__VLS_functionalComponentArgsRest(__VLS_68));
let __VLS_72;
/** @ts-ignore @type { | typeof __VLS_components.elOption | typeof __VLS_components.ElOption | typeof __VLS_components['el-option']} */
elOption;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent1(__VLS_72, new __VLS_72({
    label: "其他",
    value: "其他",
}));
const __VLS_74 = __VLS_73({
    label: "其他",
    value: "其他",
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
// @ts-ignore
[faultType,];
var __VLS_49;
let __VLS_77;
/** @ts-ignore @type { | typeof __VLS_components.elInput | typeof __VLS_components.ElInput | typeof __VLS_components['el-input']} */
elInput;
// @ts-ignore
const __VLS_78 = __VLS_asFunctionalComponent1(__VLS_77, new __VLS_77({
    modelValue: (__VLS_ctx.description),
    placeholder: "描述故障情况",
}));
const __VLS_79 = __VLS_78({
    modelValue: (__VLS_ctx.description),
    placeholder: "描述故障情况",
}, ...__VLS_functionalComponentArgsRest(__VLS_78));
let __VLS_82;
/** @ts-ignore @type { | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button'] | typeof __VLS_components.elButton | typeof __VLS_components.ElButton | typeof __VLS_components['el-button']} */
elButton;
// @ts-ignore
const __VLS_83 = __VLS_asFunctionalComponent1(__VLS_82, new __VLS_82({
    ...{ 'onClick': {} },
    type: "success",
    loading: (__VLS_ctx.submitting),
}));
const __VLS_84 = __VLS_83({
    ...{ 'onClick': {} },
    type: "success",
    loading: (__VLS_ctx.submitting),
}, ...__VLS_functionalComponentArgsRest(__VLS_83));
let __VLS_87;
const __VLS_88 = {
    /** @type {typeof __VLS_87.click} */
    onClick: (__VLS_ctx.submitRepair),
};
const { default: __VLS_89 } = __VLS_85.slots;
// @ts-ignore
[description, submitting, submitRepair,];
var __VLS_85;
var __VLS_86;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "repair-notice" },
});
/** @type {__VLS_StyleScopedClasses['repair-notice']} */ ;
(__VLS_ctx.notice);
const __VLS_90 = RepairWorkbench;
// @ts-ignore
const __VLS_91 = __VLS_asFunctionalComponent1(__VLS_90, new __VLS_90({
    ref: "workbenchRef",
}));
const __VLS_92 = __VLS_91({
    ref: "workbenchRef",
}, ...__VLS_functionalComponentArgsRest(__VLS_91));
var __VLS_95;
var __VLS_93;
// @ts-ignore
var __VLS_96 = __VLS_95;
// @ts-ignore
[notice,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
