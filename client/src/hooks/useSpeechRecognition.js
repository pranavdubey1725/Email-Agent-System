import { useState, useEffect, useRef } from 'react';

// Cleans up common speech-to-text mistakes that affect email dictation.
// The browser Speech API can't produce special characters like @, so users
// say "at" or "at the rate" — we convert those back.
function fixSpeechArtifacts(text) {
  return text
    .replace(/\bat the rate\b/gi, '@')   // "pranav at the rate gmail" → "pranav@gmail"
    .replace(/\[at\]/gi, '@')            // some locales say "[at]"
    .trim();
}

// useSpeechRecognition — wraps the browser's Web Speech API
//
// How it works:
//   1. You call startListening() — the browser asks for mic permission
//   2. As the user speaks, onTranscriptChange fires with live (interim) text
//   3. When the user stops speaking, the browser finalises the text
//   4. You call stopListening() or it stops automatically after silence
//
// Returns:
//   isListening      — true while the mic is active
//   isSupported      — false on Firefox / non-supported browsers
//   error            — string error message if something goes wrong
//   startListening   — function to start recording
//   stopListening    — function to stop recording

function useSpeechRecognition({ onTranscriptChange }) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);

  // We store the recognition instance in a ref so it persists across renders
  // without causing re-renders itself
  const recognitionRef = useRef(null);

  // Check if the browser supports the Web Speech API
  // Chrome and Edge support it — Firefox does not
  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Clean up the recognition instance when the component unmounts
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  function startListening() {
    if (!isSupported) {
      setError('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    setError(null);

    // webkitSpeechRecognition is the Chrome-prefixed version
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    // continuous: false — stops automatically after a pause in speech
    // interimResults: true — fires results as you speak, not just at the end
    //   This gives the "live transcription" effect in the textarea
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      // event.results is a list of results, each with one or more alternatives
      // We join them all to get the full transcript so far
      const raw = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('');

      // Fix common speech-to-text artifacts before passing to the textarea.
      // The Web Speech API can't type "@" — users say "at" or "at the rate",
      // so we convert those patterns back to the @ symbol.
      const transcript = fixSpeechArtifacts(raw);

      // Send the live transcript up to the parent (InputPanel)
      // so it can update the textarea in real time
      onTranscriptChange(transcript);
    };

    recognition.onerror = (event) => {
      // 'not-allowed' means the user denied microphone permission
      if (event.error === 'not-allowed') {
        setError('Microphone access was denied. Please allow it in your browser settings.');
      } else if (event.error === 'no-speech') {
        setError('No speech detected. Please try again.');
      } else {
        setError(`Voice error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      // Fires when recognition stops — either naturally or via stopListening()
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }

  return { isListening, isSupported, error, startListening, stopListening };
}

export default useSpeechRecognition;
