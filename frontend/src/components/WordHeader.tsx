import AudioButton from './AudioButton';
import { Badge } from '@/components/ui/badge';

interface WordHeaderProps {
  name: string;
  type?: string;
  transcription?: string;
}

export default function WordHeader({ name, type, transcription }: WordHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-lg font-semibold">{name}</span>
      {type && (
        <Badge variant="secondary" className="font-normal">
          {type}
        </Badge>
      )}
      {transcription && (
        <span className="text-muted-foreground text-sm">/{transcription}/</span>
      )}
      <AudioButton text={name} />
    </div>
  );
}
