<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { FormInstance } from '@arco-design/web-vue';
import { useApi } from '@/composables/useApi';
import { useToast } from '@/composables/useToast';
import type { Material } from '@/types';

const props = defineProps<{
  item: Material | null;
  visible: boolean;
  categories: string[];
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const api = useApi();
const { toast } = useToast();

const formRef = ref<FormInstance>();

const form = reactive({
  filename: '',
  desc: '',
  tags: [] as string[],
});

const saving = ref(false);
const ext = ref('');

watch(
  () => props.visible,
  (v) => {
    if (v && props.item) {
      const raw = props.item.filename || props.item.name || '';
      ext.value = props.item.ext || '';
      // strip extension from filename if present
      if (ext.value && raw.endsWith(`.${ext.value}`)) {
        form.filename = raw.slice(0, -(ext.value.length + 1));
      } else {
        form.filename = raw;
      }
      form.desc = props.item.desc || '';
      form.tags = [...(props.item.tags || [])];
    }
  },
);

async function handleSave() {
  const valid = await formRef.value?.validate?.();
  if (valid !== undefined) return;
  saving.value = true;
  try {
    const res = await api.update(props.item!.id, {
      name: form.filename,
      desc: form.desc,
      tags: form.tags,
    });
    if (res.success) {
      emit('saved');
    } else {
      toast('保存失败', 'error');
    }
  } catch (err: any) {
    toast(err?.message || '保存失败', 'error');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <a-modal
      :visible="visible"
      title="编辑物料"
      :width="520"
      :mask-closable="false"
      @cancel="emit('close')"
    >
      <div class="edit-body">
        <a-form ref="formRef" :model="form" layout="vertical">
          <a-form-item field="filename" label="文件名"
            :rules="[{ required: true, message: '请输入文件名' }]">
            <a-input v-model="form.filename" placeholder="文件名" allow-clear>
              <template #append>.{{ ext }}</template>
            </a-input>
          </a-form-item>

          <a-form-item field="desc" label="描述">
            <a-textarea
              v-model="form.desc"
              placeholder="输入描述信息"
              :auto-size="{ minRows: 2, maxRows: 5 }"
              :max-length="200"
              show-word-limit
              allow-clear
            />
          </a-form-item>

          <a-form-item label="标签">
            <a-input-tag
              v-model="form.tags"
              placeholder="输入标签后回车"
              allow-clear
            />
          </a-form-item>
        </a-form>
      </div>

      <template #footer>
        <div class="edit-footer">
          <a-button @click="emit('close')">取消</a-button>
          <a-button type="primary" :loading="saving" @click="handleSave">保存</a-button>
        </div>
      </template>
    </a-modal>
  </Teleport>
</template>

<style scoped>
.edit-body {
  padding: var(--gap-sm) 0;
}

.edit-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--gap-sm);
}
</style>
