import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FlashcardWord } from '@/shared/types';
import type { ReviewResult } from '@/shared/wordStatus';
import { getFlashcards, submitFlashcardReview } from '@/api/client';
import { getUserName } from '@/utils/storage';
import { resetReminderAnchor } from '@/utils/studyReminder';
import { AppLayout } from '@/components/layout/AppLayout';
import WordHeader from '@/components/WordHeader';
import AudioButton from '@/components/AudioButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlightedSentence(sentence: string, keyword: string): ReactNode {
  const trimmedKeyword = keyword.trim();
  if (!trimmedKeyword) return sentence;

  const pattern = new RegExp(`(${escapeRegExp(trimmedKeyword)})`, 'gi');
  const parts = sentence.split(pattern);
  if (parts.length <= 1) return sentence;

  return parts.map((part, idx) =>
    part.toLowerCase() === trimmedKeyword.toLowerCase() ? (
      <mark key={`${part}-${idx}`} className="bg-yellow-200/80 rounded px-0.5 text-current">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${idx}`}>{part}</span>
    )
  );
}

export default function FlashcardPage() {
  const navigate = useNavigate();
  const userName = getUserName();
  const [cards, setCards] = useState<FlashcardWord[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [exampleIndex, setExampleIndex] = useState(0);
  const [batchCompleted, setBatchCompleted] = useState(false);

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError('');
    setBatchCompleted(false);
    try {
      const data = await getFlashcards(userName);
      setCards(data);
      setIndex(0);
      setFlipped(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi');
    } finally {
      setLoading(false);
    }
  }, [userName]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  useEffect(() => {
    resetReminderAnchor();
  }, []);

  const current = cards[index];
  const ex =
    current && current.example.length > 0
      ? current.example[exampleIndex % current.example.length] ?? null
      : current?.flashExample ?? null;

  const randomizeExample = useCallback(() => {
    if (!current || current.example.length <= 1) return;
    setExampleIndex((prev) => {
      const next = Math.floor(Math.random() * current.example.length);
      if (next === prev) {
        return (next + 1) % current.example.length;
      }
      return next;
    });
  }, [current]);

  useEffect(() => {
    if (!current || current.example.length === 0) {
      setExampleIndex(0);
      return;
    }
    setExampleIndex(Math.floor(Math.random() * current.example.length));
  }, [current?.id]);

  async function handleReview(result: ReviewResult) {
    if (!current || submitting) return;
    setSubmitting(true);
    try {
      await submitFlashcardReview({
        dictionaryId: current.id,
        userName,
        result,
      });
      if (index + 1 < cards.length) {
        setIndex((i) => i + 1);
        setFlipped(false);
      } else {
        setBatchCompleted(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AppLayout title="Flashcard" onBack={() => navigate('/')}>
        <p className="text-muted-foreground py-12 text-center">Đang tải...</p>
      </AppLayout>
    );
  }

  if (batchCompleted) {
    return (
      <AppLayout title="Ôn tập flashcard" onBack={() => navigate('/')}>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <p className="py-12 text-center text-lg font-medium">
          Chúc mừng bạn đã hoàn thành
        </p>
        <Button className="w-full" onClick={() => void loadCards()}>
          Làm mới
        </Button>
      </AppLayout>
    );
  }

  if (!current) {
    return (
      <AppLayout title="Flashcard" onBack={() => navigate('/')}>
        <p className="text-muted-foreground py-8 text-center text-sm">
          Không có từ cần ôn. Thêm từ mới hoặc đánh dấu &quot;Đang học&quot;.
        </p>
        <Button onClick={() => void loadCards()}>Tải lại</Button>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Ôn tập flashcard"
      subtitle={`Thẻ ${index + 1} / ${cards.length}`}
      onBack={() => navigate('/')}
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div
        className={cn('flashcard-perspective cursor-pointer', flipped && 'flashcard-flipped')}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="flashcard-inner relative min-h-[300px]">
          <Card className="flashcard-face absolute inset-0 py-6">
            <CardContent className="flex h-full min-h-[260px] flex-col gap-4 px-6">
              <WordHeader
                name={current.name}
                type={current.type}
                transcription={current.transcription}
              />
              {ex && (
                <div className="bg-muted/50 flex items-start gap-2 rounded-lg p-3">
                  <p className="flex-1 text-sm">
                    {renderHighlightedSentence(ex.sentence, current.name)}
                  </p>
                  <AudioButton text={ex.sentence} />
                </div>
              )}
              {current.example.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={(e) => {
                    e.stopPropagation();
                    randomizeExample();
                  }}
                >
                  Ví dụ khác
                </Button>
              )}
              <p className="text-muted-foreground mt-auto text-center text-xs">
                Nhấn thẻ để xem nghĩa
              </p>
            </CardContent>
          </Card>
          <Card className="flashcard-face flashcard-back absolute inset-0 py-6">
            <CardContent className="flex min-h-[260px] flex-col justify-center gap-3 px-6">
              {ex?.meaning && (
                <p className="text-base">
                  <span className="text-muted-foreground text-sm">Nghĩa ví dụ: </span>
                  {ex.meaning}
                </p>
              )}
              {current.meaning && (
                <p>
                  <span className="text-muted-foreground text-sm">Nghĩa từ: </span>
                  {current.meaning}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          className="flex-1"
          disabled={submitting}
          onClick={(e) => {
            e.stopPropagation();
            void handleReview('đang học');
          }}
        >
          Đang học
        </Button>
        <Button
          className="flex-1"
          disabled={submitting}
          onClick={(e) => {
            e.stopPropagation();
            void handleReview('hoàn thành');
          }}
        >
          Hoàn thành
        </Button>
      </div>
      <div className="flex justify-center gap-1">
        {cards.map((_, i) => (
          <Badge
            key={i}
            variant={i === index ? 'default' : 'outline'}
            className="size-2 rounded-full p-0"
          />
        ))}
      </div>
    </AppLayout>
  );
}
