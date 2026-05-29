import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createWord } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import type { GlobalDictionaryWord } from '@/shared/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AddToFlashcardDialogProps {
  word: GlobalDictionaryWord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function AddToFlashcardDialog({
  word,
  open,
  onOpenChange,
  onSuccess,
}: AddToFlashcardDialogProps) {
  const navigate = useNavigate();
  const { userName } = useAuth();
  const [sentence, setSentence] = useState('');
  const [meaning, setMeaning] = useState('');
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState('');
  const [loading, setLoading] = useState(false);

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
    if (!word) return;
    try {
      await navigator.clipboard.writeText(buildExamplePrompt(word.name));
      setError('');
      setCopySuccess('Đã copy prompt tạo ví dụ.');
    } catch {
      setCopySuccess('');
      setError('Không copy được prompt. Hãy kiểm tra quyền clipboard.');
    }
  }

  useEffect(() => {
    if (!open || !word) return;
    setSentence(word.example[0]?.sentence ?? '');
    setMeaning(word.example[0]?.meaning ?? '');
    setError('');
    setCopySuccess('');
  }, [open, word]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!word) return;

    if (!userName) {
      onOpenChange(false);
      navigate('/login', { state: { from: '/dictionary' } });
      return;
    }

    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) {
      setError('Nhập câu ví dụ tiếng Anh');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await createWord({
        name: word.name,
        type: word.type,
        transcription: word.transcription,
        meaning: word.meaning,
        example: [{ sentence: trimmedSentence, meaning: meaning.trim() }],
        globalDictionaryId: word.id,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thêm được từ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm vào flashcard</DialogTitle>
          <DialogDescription>
            {word ? (
              <>
                Từ <strong>{word.name}</strong> — nhập ví dụ của bạn để ôn tập.
              </>
            ) : (
              'Chọn từ để thêm vào flashcard.'
            )}
          </DialogDescription>
        </DialogHeader>
        {word && (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="flash-example-sentence">Câu ví dụ (tiếng Anh)</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyPrompt()}>
                  <Copy className="size-4" />
                  Copy prompt
                </Button>
              </div>
              <Textarea
                id="flash-example-sentence"
                value={sentence}
                onChange={(e) => setSentence(e.target.value)}
                rows={10}
                placeholder="She took a quick shower before work."
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="flash-example-meaning">Nghĩa câu ví dụ (tiếng Việt)</Label>
              <Input
                id="flash-example-meaning"
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                placeholder="Cô ấy tắm nhanh trước khi đi làm."
              />
            </div>
            {copySuccess && (
              <Alert>
                <AlertDescription className="text-emerald-700">{copySuccess}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter className="gap-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Đang lưu...' : 'Thêm flashcard'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
