import { useState, useRef } from 'react';

// useWhisper — records audio via MediaRecorder and transcribes it with OpenAI Whisper.
//
// Flow:
//   1. startRecording() — asks for mic permission, starts MediaRecorder
//   2. User speaks
//   3. stopRecording() — stops recording, checks for actual audio content,
//      sends audio blob to /api/transcribe if speech is detected,
//      calls onTranscriptChange with the result
//
// Returns:
//   isRecording      — true while mic is active
//   isTranscribing   — true while waiting for Whisper response
//   error            — string error message or null
//   startRecording   — function
//   stopRecording    — function

// Analyses a webm audio Blob for actual speech content using the Web Audio API.
// Returns true if the RMS amplitude is above a threshold — i.e. the user spoke.
// Returns false for silence, background hiss, or accidental taps.
async function hasSpeech(blob) {
  try {
    const audioContext = new AudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    audioContext.close();

    const channelData = audioBuffer.getChannelData(0);

    // Calculate RMS (root mean square) amplitude
    let sum = 0;
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sum / channelData.length);

    // 0.01 is a conservative threshold — normal speech is 0.05–0.3+.
    // This catches silence, mic hiss, and accidental taps without blocking quiet voices.
    return rms > 0.01;
  } catch {
    // If audio analysis fails for any reason, let Whisper try — don't block the user.
    return true;
  }
}

function useWhisper({ onTranscriptChange }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  async function startRecording() {
    setError(null);
    chunksRef.current = [];

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Microphone access was denied. Please allow it in your browser settings.');
      return;
    }

    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      // Stop all mic tracks so the browser indicator disappears
      stream.getTracks().forEach(t => t.stop());

      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });

      // Check for actual speech before sending to Whisper.
      // Whisper hallucinates random text when given silent audio —
      // detecting silence here prevents that entirely.
      const speechDetected = await hasSpeech(blob);
      if (!speechDetected) {
        // Silent recording — do nothing, leave textarea as-is
        return;
      }

      await transcribe(blob, recorder.mimeType);
    };

    recorder.start();
    setIsRecording(true);
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function transcribe(blob, mimeType) {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'audio.webm');

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${res.status}`);
      }

      const { transcript } = await res.json();
      if (transcript) {
        onTranscriptChange(transcript);
      }
      // If transcript is empty (server-side hallucination filter caught it),
      // leave the textarea unchanged.
    } catch (err) {
      setError(`Transcription failed: ${err.message}`);
    } finally {
      setIsTranscribing(false);
    }
  }

  return { isRecording, isTranscribing, error, startRecording, stopRecording };
}

export default useWhisper;
