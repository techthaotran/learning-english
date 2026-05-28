export function speakText(text: string, lang = 'en-US'): void {
  if (!text?.trim()) return;

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = lang;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
    return;
  }

  const encoded = encodeURIComponent(text.trim());
  const audio = new Audio(
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encoded}`
  );
  audio.play().catch(() => {});
}
