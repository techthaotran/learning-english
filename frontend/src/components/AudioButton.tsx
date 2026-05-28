import { Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { speakText } from '@/utils/tts';

interface AudioButtonProps {
  text: string;
}

export default function AudioButton({ text }: AudioButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-8 shrink-0"
      aria-label="Phát âm"
      onClick={(e) => {
        e.stopPropagation();
        speakText(text);
      }}
    >
      <Volume2 className="size-4" />
    </Button>
  );
}
