import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import type { DictionaryWord, PaginatedWords, UpdateWordPayload, WordStatus } from '@learning-english/shared';
import { listWords, createWord, updateWord, deleteWord } from '@/api/client';
import WordFormModal from '@/components/WordFormModal';
import { StatusBadge } from '@/components/StatusBadge';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WORD_STATUSES, DEFAULT_PAGE_SIZE } from '@/constants/wordStatus';

interface ModalState {
  open: boolean;
  mode: 'create' | 'edit';
  word: DictionaryWord | null;
}

export default function WordManagePage() {
  const navigate = useNavigate();
  const [data, setData] = useState<PaginatedWords | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const [filterStatus, setFilterStatus] = useState<WordStatus | 'all'>('all');
  const [appliedQ, setAppliedQ] = useState('');
  const [appliedStatus, setAppliedStatus] = useState<WordStatus | ''>('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: 'create',
    word: null,
  });

  const loadWords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listWords({
        q: appliedQ,
        status: appliedStatus || undefined,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
      });
      setData(result);
      if (page > result.totalPages) setPage(Math.max(1, result.totalPages));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi');
    } finally {
      setLoading(false);
    }
  }, [appliedQ, appliedStatus, page]);

  useEffect(() => {
    void loadWords();
  }, [loadWords]);

  function applyFilters() {
    setAppliedQ(filterQ);
    setAppliedStatus(filterStatus === 'all' ? '' : filterStatus);
    setPage(1);
  }

  async function handleFormSubmit(payload: UpdateWordPayload) {
    if (modal.mode === 'edit' && modal.word) {
      await updateWord(modal.word.id, payload);
    } else {
      if (!payload.name?.trim()) throw new Error('Tên từ không được để trống');
      const { status: _s, ...rest } = payload;
      await createWord({
        name: rest.name!,
        type: rest.type,
        transcription: rest.transcription,
        meaning: rest.meaning,
        example: rest.example ?? [],
      });
    }
    await loadWords();
  }

  async function handleDelete(word: DictionaryWord) {
    if (!window.confirm(`Xóa từ "${word.name}"?`)) return;
    try {
      await deleteWord(word.id);
      await loadWords();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi');
    }
  }

  const words = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <AppLayout
      title="Quản lý từ vựng"
      subtitle={`Tổng: ${total} từ`}
      onBack={() => navigate('/')}
      headerAction={
        <Button size="sm" onClick={() => setModal({ open: true, mode: 'create', word: null })}>
          <Plus className="size-4" />
          Thêm
        </Button>
      }
    >
      <Card className="py-4">
        <CardContent className="grid gap-4 px-4">
          <div className="grid gap-2">
            <Label htmlFor="filter-q">Tìm theo tên</Label>
            <Input
              id="filter-q"
              value={filterQ}
              onChange={(e) => setFilterQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyFilters())}
              placeholder="Từ khóa..."
            />
          </div>
          <div className="grid gap-2">
            <Label>Trạng thái</Label>
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as WordStatus | 'all')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {WORD_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={applyFilters}>Lọc</Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <p className="text-muted-foreground py-8 text-center">Đang tải...</p>
      ) : words.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">Không có từ nào</p>
      ) : (
        <p className="text-muted-foreground text-center text-xs">
          Trang {data?.page}/{totalPages} — {words.length} / {total} từ
        </p>
      )}

      <div className="grid gap-3">
        {words.map((word) => (
          <Card key={word.id} className="py-4">
            <CardContent className="grid gap-3 px-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {word.name}
                    {word.type && (
                      <span className="text-muted-foreground font-normal"> — {word.type}</span>
                    )}
                  </p>
                  {word.meaning && (
                    <p className="text-muted-foreground text-sm">{word.meaning}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={word.status} />
                    <span className="text-muted-foreground text-xs">{word.created_date}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setModal({ open: true, mode: 'edit', word })}
                >
                  <Pencil className="size-3.5" />
                  Sửa
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={() => void handleDelete(word)}
                >
                  <Trash2 className="size-3.5" />
                  Xóa
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="size-4" />
            Trước
          </Button>
          <span className="text-muted-foreground text-sm">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      <WordFormModal
        open={modal.open}
        mode={modal.mode}
        initialWord={modal.word}
        onClose={() => setModal({ open: false, mode: 'create', word: null })}
        onSubmit={handleFormSubmit}
      />
    </AppLayout>
  );
}
