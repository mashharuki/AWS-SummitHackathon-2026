/**
 * タスクインライン編集フォーム
 */
import { useState } from "react";
import type { Task } from "@saboru/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
      aria-label="タスク編集フォーム"
    >
      <div>
        <label
          htmlFor="edit-title"
          className="text-xs font-medium text-[#6B7280] mb-1 block"
        >
          タスク名
        </label>
        <Input
          id="edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="タスク名"
          required
          maxLength={200}
        />
      </div>

      <div>
        <label
          htmlFor="edit-deadline"
          className="text-xs font-medium text-[#6B7280] mb-1 block"
        >
          期限
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
          内容
        </label>
        <Textarea
          id="edit-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="タスクの内容"
          rows={3}
          maxLength={1000}
        />
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          キャンセル
        </Button>
        <Button type="submit" size="sm" disabled={isSaving || !title.trim()}>
          {isSaving ? "保存中..." : "保存"}
        </Button>
      </div>
    </form>
  );
}
