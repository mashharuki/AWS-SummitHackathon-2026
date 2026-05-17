/**
 * タスク手動追加モーダル
 */
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface TaskAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: {
    title: string;
    deadline?: string | null;
    description?: string;
  }) => Promise<void>;
}

export function TaskAddModal({ isOpen, onClose, onAdd }: TaskAddModalProps) {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsAdding(true);
    try {
      await onAdd({
        title: title.trim(),
        deadline: deadline ? new Date(deadline).toISOString() : null,
        description: description.trim() || undefined,
      });
      // フォームリセット
      setTitle("");
      setDeadline("");
      setDescription("");
      onClose();
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-task-title"
    >
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
          <h2 id="add-task-title" className="font-semibold text-[#1A1A1A]">
            タスクを追加
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="閉じる"
            className="h-8 w-8"
          >
            <X size={16} />
          </Button>
        </div>

        {/* フォーム */}
        <form onSubmit={(e) => void handleSubmit(e)} className="p-4 space-y-3">
          <div>
            <label
              htmlFor="new-title"
              className="text-xs font-medium text-[#6B7280] mb-1 block"
            >
              タスク名 <span aria-hidden="true">*</span>
            </label>
            <Input
              id="new-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: クライアント向けレポート作成"
              required
              maxLength={200}
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="new-deadline"
              className="text-xs font-medium text-[#6B7280] mb-1 block"
            >
              期限
            </label>
            <Input
              id="new-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="new-description"
              className="text-xs font-medium text-[#6B7280] mb-1 block"
            >
              内容・メモ
            </label>
            <Textarea
              id="new-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="タスクの詳細（任意）"
              rows={3}
              maxLength={1000}
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              キャンセル
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isAdding || !title.trim()}
            >
              {isAdding ? "追加中..." : "追加する"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
