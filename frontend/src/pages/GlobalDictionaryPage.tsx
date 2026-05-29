import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, PlusCircle } from 'lucide-react';
import { listGlobalLevels, listGlobalTypes, listGlobalWords } from '@/api/client';
import type {
  GlobalDictionaryWord,
  GlobalLevelSummary,
  GlobalTypeSummary,
  PaginatedGlobalWords,
} from '@/shared/types';
import { AppLayout } from '@/components/layout/AppLayout';
import AddToFlashcardDialog from '@/components/AddToFlashcardDialog';
import WordHeader from '@/components/WordHeader';
import AudioButton from '@/components/AudioButton';
import GoogleTranslateBlock from '@/components/GoogleTranslateBlock';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import CefrLevelBadge, { normalizeCefrLevel } from '@/components/CefrLevelBadge';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import WordTypeAutocomplete, { ALL_WORD_TYPES } from '@/components/WordTypeAutocomplete';

const PAGE_SIZE = 20;

const CEFR_LABELS: Record<string, string> = {
  A1: 'Sơ cấp',
  A2: 'Cơ bản',
  B1: 'Trung cấp',
  B2: 'Trung cao',
  C1: 'Cao cấp',
  C2: 'Thành thạo',
};

function cefrLabel(level: string): string {
  return CEFR_LABELS[normalizeCefrLevel(level)] ?? 'CEFR';
}

export default function GlobalDictionaryPage() {
  const navigate = useNavigate();
  const { userName } = useAuth();
  const [levels, setLevels] = useState<GlobalLevelSummary[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [wordsData, setWordsData] = useState<PaginatedGlobalWords | null>(null);
  const [page, setPage] = useState(1);
  const [loadingLevels, setLoadingLevels] = useState(true);
  const [loadingWords, setLoadingWords] = useState(false);
  const [error, setError] = useState('');
  const [flashcardWord, setFlashcardWord] = useState<GlobalDictionaryWord | null>(null);
  const [flashcardOpen, setFlashcardOpen] = useState(false);
  const [addSuccess, setAddSuccess] = useState('');
  const [onlyNotInFlashcard, setOnlyNotInFlashcard] = useState(false);
  const [wordTypes, setWordTypes] = useState<GlobalTypeSummary[]>([]);
  const [selectedType, setSelectedType] = useState(ALL_WORD_TYPES);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const pageTopRef = useRef<HTMLDivElement>(null);
  const scrollAfterPageChangeRef = useRef(false);

  const scrollToPageTop = useCallback(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    pageTopRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, []);

  const handleBack = useCallback(() => {
    if (selectedLevel) {
      setSelectedLevel(null);
      setWordsData(null);
      setPage(1);
      setAddSuccess('');
      return;
    }
    navigate(userName ? '/' : '/login');
  }, [navigate, selectedLevel, userName]);

  useEffect(() => {
    let mounted = true;
    async function loadLevels() {
      setLoadingLevels(true);
      setError('');
      try {
        const data = await listGlobalLevels();
        if (mounted) setLevels(data);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Lỗi tải từ điển');
      } finally {
        if (mounted) setLoadingLevels(false);
      }
    }
    void loadLevels();
    return () => {
      mounted = false;
    };
  }, []);

  const loadWords = useCallback(async () => {
    if (!selectedLevel) return;
    setLoadingWords(true);
    setError('');
    try {
      const result = await listGlobalWords({
        level: selectedLevel,
        page,
        pageSize: PAGE_SIZE,
        excludeNotInFlashcard: userName ? onlyNotInFlashcard : false,
        type: selectedType === ALL_WORD_TYPES ? undefined : selectedType,
      });
      setWordsData(result);
      if (page > result.totalPages) {
        setPage(Math.max(1, result.totalPages));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải từ');
    } finally {
      setLoadingWords(false);
    }
  }, [selectedLevel, page, onlyNotInFlashcard, selectedType, userName]);

  useEffect(() => {
    if (!selectedLevel) {
      setWordTypes([]);
      return;
    }

    const level = selectedLevel;
    let mounted = true;
    async function loadTypes() {
      setLoadingTypes(true);
      try {
        const types = await listGlobalTypes(level);
        if (mounted) setWordTypes(types);
      } catch {
        if (mounted) setWordTypes([]);
      } finally {
        if (mounted) setLoadingTypes(false);
      }
    }
    void loadTypes();
    return () => {
      mounted = false;
    };
  }, [selectedLevel]);

  useEffect(() => {
    void loadWords();
  }, [loadWords]);

  useLayoutEffect(() => {
    if (!scrollAfterPageChangeRef.current || loadingWords) return;
    scrollAfterPageChangeRef.current = false;
    scrollToPageTop();
  }, [loadingWords, wordsData, scrollToPageTop]);

  function selectLevel(level: string) {
    setSelectedLevel(level);
    setPage(1);
    setAddSuccess('');
    setOnlyNotInFlashcard(false);
    setSelectedType(ALL_WORD_TYPES);
  }

  function handleOnlyNotInFlashcardChange(checked: boolean) {
    setOnlyNotInFlashcard(checked);
    setPage(1);
  }

  function handleTypeChange(value: string) {
    setSelectedType(value);
    setPage(1);
  }

  function changePage(nextPage: number) {
    scrollAfterPageChangeRef.current = true;
    setPage(nextPage);
    scrollToPageTop();
  }

  const totalPages = wordsData?.totalPages ?? 1;

  return (
    <AppLayout
      title="Từ điển"
      subtitle={
        selectedLevel ? (
          <span className="flex flex-wrap items-center gap-2">
            <CefrLevelBadge level={selectedLevel} className="text-xs" />
            <span className="text-muted-foreground">{cefrLabel(selectedLevel)}</span>
          </span>
        ) : (
          'Oxford 3000 — nhóm theo CEFR'
        )
      }
      onBack={handleBack}
      topAnchorRef={pageTopRef}
      stickyToolbar={
        selectedLevel ? (
          <div className="grid gap-3">
            <WordTypeAutocomplete
              id="word-type-filter"
              options={wordTypes}
              value={selectedType}
              onValueChange={handleTypeChange}
              disabled={loadingTypes}
            />
            {userName && (
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={onlyNotInFlashcard}
                  onChange={(e) => handleOnlyNotInFlashcardChange(e.target.checked)}
                />
                Chỉ hiện từ chưa thêm flashcard
              </label>
            )}
          </div>
        ) : undefined
      }
    >
      {addSuccess && (
        <Alert>
          <AlertDescription className="text-emerald-700">{addSuccess}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!selectedLevel && (
        <div className="grid gap-3">
          {loadingLevels && (
            <p className="text-muted-foreground py-8 text-center text-sm">Đang tải...</p>
          )}
          {!loadingLevels && levels.length === 0 && (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Chưa có dữ liệu từ điển. Chạy seed trên server.
            </p>
          )}
          {levels.map(({ level, count }) => (
            <Card
              key={level}
              className="cursor-pointer py-4 transition-colors hover:bg-accent/50"
              onClick={() => selectLevel(level)}
            >
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 px-4">
                <div className="flex flex-col gap-1.5">
                  <CefrLevelBadge level={level} className="text-sm px-2.5 py-0.5" />
                  <CardDescription>{cefrLabel(level)}</CardDescription>
                </div>
                <Badge variant="secondary">{count} từ</Badge>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {selectedLevel && (
        <>
          {loadingWords && !wordsData && (
            <p className="text-muted-foreground py-8 text-center text-sm">Đang tải từ...</p>
          )}
          <div className="grid gap-3">
            {wordsData?.items.map((word) => (
              <Card key={word.id} className="py-4">
                <CardContent className="grid gap-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <WordHeader
                      name={word.name}
                      type={word.type}
                      transcription={word.transcription}
                    />
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <CefrLevelBadge level={word.level} />
                      {word.inFlashcard && (
                        <Badge variant="secondary" className="text-xs">
                          Đã thêm
                        </Badge>
                      )}
                    </div>
                  </div>
                  {word.meaning && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Nghĩa: </span>
                      {word.meaning}
                    </p>
                  )}
                  <GoogleTranslateBlock word={word.name} examples={word.example} />
                  {word.example.length > 0 && (
                    <div className="grid gap-2">
                      {word.example.map((ex, idx) => (
                        <div
                          key={idx}
                          className="bg-muted/50 flex items-start gap-2 rounded-lg p-3 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <p>{ex.sentence}</p>
                            {ex.meaning && (
                              <p className="text-muted-foreground mt-1">{ex.meaning}</p>
                            )}
                          </div>
                          <AudioButton text={ex.sentence} />
                        </div>
                      ))}
                    </div>
                  )}
                  {!word.inFlashcard ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setFlashcardWord(word);
                        setFlashcardOpen(true);
                      }}
                    >
                      <PlusCircle className="size-4" />
                      Thêm vào flashcard
                    </Button>
                  ) : null}
                  {word.inFlashcard ? (
                    <p className="text-muted-foreground text-center text-xs">
                      Từ này đã có trong flashcard của bạn
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>

          {wordsData && wordsData.items.length === 0 && !loadingWords && (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {selectedType === ALL_WORD_TYPES
                ? 'Không có từ trong nhóm này'
                : `Không có từ loại "${selectedType}" trong nhóm này`}
            </p>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loadingWords}
                onClick={() => changePage(page - 1)}
              >
                <ChevronLeft className="size-4" />
                Trước
              </Button>
              <span className="text-muted-foreground text-sm">
                {page} / {totalPages}
                {wordsData != null && ` · ${wordsData.total} từ`}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loadingWords}
                onClick={() => changePage(page + 1)}
              >
                Sau
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <AddToFlashcardDialog
        word={flashcardWord}
        open={flashcardOpen}
        onOpenChange={setFlashcardOpen}
        onSuccess={() => {
          setAddSuccess(`Đã thêm "${flashcardWord?.name}" vào flashcard của bạn.`);
          void loadWords();
        }}
      />
    </AppLayout>
  );
}
