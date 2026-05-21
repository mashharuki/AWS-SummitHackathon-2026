import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Task } from "@saboru/shared";
/**
 * タスクインライン編集フォーム
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface TaskEditFormProps {
  task: Task;
  onSave: (data: {
    title?: string;
    deadline?: string | null;
    description?: string;
  }) => Promise<void>;
  onCancel: () => void;
}

export function TaskEditForm({ task, onSave, onCancel }: TaskEditFormProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(task.title);
  const [deadline, setDeadline] = useState(
    task.deadline ? task.deadline.split("T")[0] : "",
  );
  const [description, setDescription] = useState(task.description);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        title: title.trim() || undefined,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        description: description.trim() || undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-3"
      aria-label={t("taskForm.editFormAria")}
    >
      <div>
        <label
          htmlFor="edit-title"
          className="text-xs font-medium text-[#6B7280] mb-1 block"
        >
          {t("taskForm.taskName")}
        </label>
        <Input
          id="edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("taskForm.taskName")}
          required
          maxLength={200}
        />
      </div>

      <div>
        <label
          htmlFor="edit-deadline"
          className="text-xs font-medium text-[#6B7280] mb-1 block"
        >
          {t("taskForm.deadline")}
        </label>
        <Input
          id="edit-deadline"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>

      <div>
        <label
          htmlFor="edit-description"
          className="text-xs font-medium text-[#6B7280] mb-1 block"
        >
          {t("taskForm.content")}
        </label>
        <Textarea
          id="edit-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("taskForm.contentPlaceholder")}
          rows={3}
          maxLength={1000}
        />
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" size="sm" disabled={isSaving || !title.trim()}>
          {isSaving ? t("taskForm.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}
