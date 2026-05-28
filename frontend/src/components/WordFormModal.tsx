import { useEffect, useState } from 'react';
import { Copy, Sparkles } from 'lucide-react';
import type { DictionaryWord, UpdateWordPayload, WordStatus } from '@learning-english/shared';
import { EXAMPLE_TEMPLATE, WORD_STATUSES } from '@/constants/wordStatus';
import { lookupWordFromGoogle } from '@/utils/googleTranslate';
import AudioButton from '@/components/AudioButton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FormState {
  name: string;
  type: string;
  transcription: string;
  meaning: string;
  example: string;
  status: WordStatus;
}

const EMPTY: FormState = {
  name: '',
  type: '',
  transcription: '',
  meaning: '',
  example: EXAMPLE_TEMPLATE,
  status: 'Mới',
};

interface WordFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialWord: DictionaryWord | null;
  onClose: () => void;
  onSubmit: (payload: UpdateWordPayload) => Promise<void>;
}

export default function WordFormModal({
  open,
  mode,
  initialWord,
  onClose,
  onSubmit,
}: WordFormModalProps) {
  const MAX_EXAMPLE_ROWS = 10;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [copyPromptMessage, setCopyPromptMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setAutoLoading(false);
    setCopyPromptMessage('');
    if (mode === 'edit' && initialWord) {
      setForm({
        name: initialWord.name,
        type: initialWord.type || '',
        transcription: initialWord.transcription || '',
        meaning: initialWord.meaning || '',
        example: JSON.stringify(initialWord.example ?? [], null, 2),
        status: initialWord.status,
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, mode, initialWord]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleExampleChange(value: string) {
    const lines = value.split('\n');
    if (lines.length > MAX_EXAMPLE_ROWS) {
      updateField('example', lines.slice(0, MAX_EXAMPLE_ROWS).join('\n'));
      return;
    }
    updateField('example', value);
  }

  function buildExamplePrompt(vocabulary: string): string {
    const safeWord = vocabulary.trim() || 'Design';
    return `Bạn là trợ lý tạo ví dụ tiếng Anh cho người học.

Nhiệm vụ:
- Nhận đầu vào là 1 từ vựng tiếng Anh: ${safeWord}
- Tạo đúng 5 câu ví dụ tiếng Anh có chứa từ đó (đúng ngữ cảnh tự nhiên).
- Mỗi câu cần có bản dịch tiếng Việt tương ứng.

Yêu cầu output:
- Chỉ trả về JSON array hợp lệ, không thêm giải thích.
- Mỗi phần tử theo đúng format:
  {
    "sentence": "...",
    "meaning": "..."
  }

Ràng buộc:
- Câu tiếng Anh ngắn gọn, thông dụng, trình độ A2-B2.
- Không lặp lại cùng một cấu trúc câu.
- Không dùng markdown, không dùng code block.

Ví dụ format mong muốn:
[
  {
    "sentence": "She took a quick shower before leaving for work.",
    "meaning": "Cô ấy đã tắm nhanh trước khi đi làm."
  }
]`;
  }

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(buildExamplePrompt(form.name));
      setError('');
      setCopyPromptMessage('Đã copy prompt tạo ví dụ.');
    } catch {
      setCopyPromptMessage('');
      setError('Không copy được prompt. Hãy kiểm tra quyền clipboard.');
    }
  }

  async function handleAutoFill() {
    if (!form.name.trim()) {
      setError('Nhập từ vựng trước khi dùng Auto');
      return;
    }
    setError('');
    setAutoLoading(true);
    try {
      const result = await lookupWordFromGoogle(form.name);
      setForm((prev) => ({
        ...prev,
        name: result.word,
        type: result.type,
        meaning: result.meaning,
        transcription: result.transcription || prev.transcription,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tra được từ');
    } finally {
      setAutoLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    let parsedExample: UpdateWordPayload['example'];
    try {
      parsedExample = JSON.parse(form.example);
      if (!Array.isArray(parsedExample)) throw new Error();
    } catch {
      setError('Example phải là JSON hợp lệ (mảng các object)');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        name: form.name,
        type: form.type,
        transcription: form.transcription,
        meaning: form.meaning,
        example: parsedExample,
        status: form.status,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Sửa từ' : 'Thêm từ mới'}</DialogTitle>
          <DialogDescription>
            Điền thông tin từ vựng và ví dụ dạng JSON.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="wf-name">Tên từ</Label>
            <div className="flex gap-2">
              <Input
                id="wf-name"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
                className="flex-1"
                placeholder="shower"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleAutoFill()}
                disabled={autoLoading || loading || !form.name.trim()}
                className="shrink-0"
              >
                <Sparkles className="size-4" />
                {autoLoading ? '...' : 'Auto'}
              </Button>
              <AudioButton text={form.name.trim() || form.name} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="wf-type">Loại từ</Label>
              <Input
                id="wf-type"
                value={form.type}
                onChange={(e) => updateField('type', e.target.value)}
                placeholder="noun, verb..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="wf-transcription">Phiên âm</Label>
              <Input
                id="wf-transcription"
                value={form.transcription}
                onChange={(e) => updateField('transcription', e.target.value)}
                placeholder="ˈʃaʊər"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wf-meaning">Nghĩa</Label>
            <Textarea
              id="wf-meaning"
              value={form.meaning}
              onChange={(e) => updateField('meaning', e.target.value)}
              rows={3}
              placeholder="Nghĩa tiếng Việt..."
            />
          </div>
          {mode === 'edit' && (
            <div className="grid gap-2">
              <Label>Trạng thái</Label>
              <Select
                value={form.status}
                onValueChange={(v) => updateField('status', v as WordStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORD_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="wf-example">Ví dụ (JSON)</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyPrompt()}>
                <Copy className="size-4" />
                Copy prompt
              </Button>
            </div>
            <Textarea
              id="wf-example"
              value={form.example}
              onChange={(e) => handleExampleChange(e.target.value)}
              className="font-mono text-xs"
              rows={MAX_EXAMPLE_ROWS}
              required
            />
            <p className="text-muted-foreground text-xs">
              Tối đa {MAX_EXAMPLE_ROWS} dòng.
            </p>
            {copyPromptMessage && (
              <p className="text-xs text-emerald-700">{copyPromptMessage}</p>
            )}
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
