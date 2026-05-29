import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Sparkles } from 'lucide-react';
import { createWord } from '@/api/client';
import { lookupWordFromGoogle } from '@/utils/googleTranslate';
import { EXAMPLE_TEMPLATE } from '@/shared/wordStatus';
import { AppLayout } from '@/components/layout/AppLayout';
import AudioButton from '@/components/AudioButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AddWordPage() {
  const MAX_EXAMPLE_ROWS = 10;
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [meaning, setMeaning] = useState('');
  const [transcription, setTranscription] = useState('');
  const [example, setExample] = useState(EXAMPLE_TEMPLATE);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);

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
      await navigator.clipboard.writeText(buildExamplePrompt(name));
      setError('');
      setSuccess('Đã copy prompt tạo ví dụ.');
    } catch {
      setError('Không copy được prompt. Hãy kiểm tra quyền clipboard.');
    }
  }

  function handleExampleChange(value: string) {
    const lines = value.split('\n');
    if (lines.length > MAX_EXAMPLE_ROWS) {
      setExample(lines.slice(0, MAX_EXAMPLE_ROWS).join('\n'));
      return;
    }
    setExample(value);
  }

  async function handleAutoFill() {
    if (!name.trim()) {
      setError('Nhập từ vựng trước khi dùng Auto');
      return;
    }
    setError('');
    setSuccess('');
    setAutoLoading(true);
    try {
      const result = await lookupWordFromGoogle(name);
      setName(result.word);
      setType(result.type);
      setMeaning(result.meaning);
      if (result.transcription) {
        setTranscription(result.transcription);
      }
      setSuccess('Đã điền loại từ, nghĩa và phiên âm từ Google Translate');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tra được từ');
    } finally {
      setAutoLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      JSON.parse(example);
    } catch {
      setError('Example phải là JSON hợp lệ');
      setLoading(false);
      return;
    }
    try {
      await createWord({
        name,
        type,
        meaning,
        transcription,
        example: JSON.parse(example),
      });
      setSuccess('Đã thêm từ mới!');
      setName('');
      setType('');
      setMeaning('');
      setTranscription('');
      setExample(EXAMPLE_TEMPLATE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout title="Thêm từ mới" onBack={() => navigate('/')}>
      <Card className="py-4">
        <CardHeader>
          <CardTitle className="text-lg">Từ vựng mới</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Tên từ</Label>
              <div className="flex gap-2">
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="shower"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleAutoFill()}
                  disabled={autoLoading || !name.trim()}
                  className="shrink-0"
                >
                  <Sparkles className="size-4" />
                  {autoLoading ? '...' : 'Auto'}
                </Button>
                <AudioButton text={name.trim() || name} />
              </div>
              <p className="text-muted-foreground text-xs">
                Tra từ qua Google Translate (server proxy, tránh CORS)
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="type">Loại từ</Label>
                <Input
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="noun, verb..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="transcription">Phiên âm</Label>
                <Input
                  id="transcription"
                  value={transcription}
                  onChange={(e) => setTranscription(e.target.value)}
                  placeholder="ˈʃaʊər"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="meaning">Nghĩa</Label>
              <Textarea
                id="meaning"
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                rows={3}
                placeholder="Nghĩa tiếng Việt..."
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="example">Ví dụ (JSON)</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyPrompt()}>
                  <Copy className="size-4" />
                  Copy prompt
                </Button>
              </div>
              <Textarea
                id="example"
                value={example}
                onChange={(e) => handleExampleChange(e.target.value)}
                className="font-mono text-xs"
                rows={MAX_EXAMPLE_ROWS}
                required
              />
              <p className="text-muted-foreground text-xs">
                Mảng JSON: sentence, meaning (tối đa {MAX_EXAMPLE_ROWS} dòng)
              </p>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert>
                <AlertDescription className="text-emerald-700">{success}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Đang lưu...' : 'Lưu từ'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
