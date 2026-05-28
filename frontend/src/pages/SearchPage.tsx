import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import type { DictionaryWord } from '@learning-english/shared';
import { searchWords } from '@/api/client';
import { AppLayout } from '@/components/layout/AppLayout';
import WordHeader from '@/components/WordHeader';
import AudioButton from '@/components/AudioButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SearchPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<DictionaryWord[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function doSearch() {
    if (!keyword.trim()) {
      setResults([]);
      setSearched(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setResults(await searchWords(keyword));
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout title="Tìm kiếm" onBack={() => navigate('/')}>
      <div className="flex gap-2">
        <Input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void doSearch())}
          placeholder="Nhập từ khóa..."
          className="flex-1"
        />
        <Button onClick={() => void doSearch()} disabled={loading}>
          <SearchIcon className="size-4" />
          {loading ? '...' : 'Tìm'}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {searched && results.length === 0 && (
        <p className="text-muted-foreground py-8 text-center text-sm">Không tìm thấy từ nào</p>
      )}
      <div className="grid gap-3">
        {results.map((word) => (
          <Card key={word.id} className="py-4">
            <CardContent className="grid gap-3 px-4">
              <WordHeader name={word.name} type={word.type} transcription={word.transcription} />
              {word.meaning && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Nghĩa: </span>
                  {word.meaning}
                </p>
              )}
              {word.example?.length > 0 && (
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
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
