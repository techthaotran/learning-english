import { useState } from 'react';
import { Languages } from 'lucide-react';
import type { ExampleItem, WordLookupResult } from '@/shared/types';
import { lookupWordFromGoogle, translateTextFromGoogle } from '@/utils/googleTranslate';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ExampleTranslation {
  sentence: string;
  translation: string;
}

interface TranslateResult {
  word: WordLookupResult;
  examples: ExampleTranslation[];
}

interface GoogleTranslateBlockProps {
  word: string;
  examples?: ExampleItem[];
  className?: string;
}

export default function GoogleTranslateBlock({
  word,
  examples = [],
  className,
}: GoogleTranslateBlockProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [error, setError] = useState('');

  async function handleTranslate() {
    if (result) {
      setResult(null);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const wordResult = await lookupWordFromGoogle(word);

      const sentences = examples
        .map((ex) => ex.sentence.trim())
        .filter((sentence, index, list) => sentence && list.indexOf(sentence) === index);

      const exampleTranslations = await Promise.all(
        sentences.map(async (sentence) => {
          try {
            const translated = await translateTextFromGoogle(sentence);
            return { sentence, translation: translated.translation };
          } catch {
            return { sentence, translation: '—' };
          }
        })
      );

      setResult({ word: wordResult, examples: exampleTranslations });
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Không dịch được từ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={loading || !word.trim()}
        onClick={() => void handleTranslate()}
      >
        <Languages className="size-4" />
        {loading ? 'Đang dịch...' : result ? 'Ẩn bản dịch' : 'Dịch (Google)'}
      </Button>
      {error && (
        <Alert variant="destructive" className="mt-2 py-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {result && (
        <div className="bg-sky-50 border-sky-200 mt-2 grid gap-2 rounded-lg border p-3 text-sm dark:bg-sky-950/40 dark:border-sky-900">
          <div className="grid gap-1">
            <p>
              <span className="text-muted-foreground">Nghĩa: </span>
              {result.word.meaning || '—'}
            </p>
            {result.word.type && (
              <p>
                <span className="text-muted-foreground">Loại từ: </span>
                {result.word.type}
              </p>
            )}
            {result.word.transcription && (
              <p>
                <span className="text-muted-foreground">Phiên âm: </span>/{result.word.transcription}/
              </p>
            )}
          </div>
          {result.examples.length > 0 && (
            <div className="grid gap-2 border-t border-sky-200 pt-2 dark:border-sky-900">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Ví dụ (Google)
              </p>
              {result.examples.map((ex) => (
                <div key={ex.sentence} className="grid gap-0.5">
                  <p className="text-foreground/90">{ex.sentence}</p>
                  <p className="text-muted-foreground">{ex.translation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
