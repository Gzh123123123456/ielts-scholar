import React, { useState, useRef, useEffect } from 'react';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { SerifButton } from '@/src/components/ui/SerifButton';
import { useApp } from '@/src/context/AppContext';
import { Mic, Square, Play, Volume2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'pending';
  detail: string;
}

interface SpeechEvent {
  time: string;
  type: string;
  detail: string;
}

export default function SpeechTest() {
  const { addDebugLog } = useApp();

  const [tests, setTests] = useState<TestResult[]>([
    { name: 'SpeechRecognition', status: 'pending', detail: '' },
    { name: 'webkitSpeechRecognition', status: 'pending', detail: '' },
    { name: 'getUserMedia', status: 'pending', detail: '' },
    { name: 'MediaRecorder', status: 'pending', detail: '' },
    { name: 'SpeechSynthesis', status: 'pending', detail: '' },
  ]);

  const [micStatus, setMicStatus] = useState<string>('not tested');
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  const [recorderStatus, setRecorderStatus] = useState<string>('not tested');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const [speechStatus, setSpeechStatus] = useState<string>('not tested');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [speechEvents, setSpeechEvents] = useState<SpeechEvent[]>([]);

  const [synthStatus, setSynthStatus] = useState<string>('not tested');
  const [recorderVolume, setRecorderVolume] = useState<number>(0);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const speechRetriesRef = useRef(0);
  const maxSpeechRetries = 3;
  const audioContextRef = useRef<AudioContext | null>(null);

  // Run browser detection on mount
  useEffect(() => {
    const results: TestResult[] = [];
    const w = window as any;

    results.push({
      name: 'SpeechRecognition',
      status: typeof (window as any).SpeechRecognition !== 'undefined' ? 'pass' : 'fail',
      detail: typeof (window as any).SpeechRecognition !== 'undefined' ? 'window.SpeechRecognition exists' : 'window.SpeechRecognition is undefined',
    });

    results.push({
      name: 'webkitSpeechRecognition',
      status: !!w.webkitSpeechRecognition ? 'pass' : 'fail',
      detail: w.webkitSpeechRecognition ? 'window.webkitSpeechRecognition exists' : 'window.webkitSpeechRecognition is undefined',
    });

    results.push({
      name: 'getUserMedia',
      status: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ? 'pass' : 'fail',
      detail: navigator.mediaDevices?.getUserMedia ? 'navigator.mediaDevices.getUserMedia exists' : 'navigator.mediaDevices.getUserMedia is undefined',
    });

    results.push({
      name: 'MediaRecorder',
      status: typeof MediaRecorder !== 'undefined' ? 'pass' : 'fail',
      detail: typeof MediaRecorder !== 'undefined' ? 'window.MediaRecorder exists' : 'window.MediaRecorder is undefined',
    });

    results.push({
      name: 'SpeechSynthesis',
      status: !!window.speechSynthesis ? 'pass' : 'fail',
      detail: window.speechSynthesis ? 'window.speechSynthesis exists' : 'window.speechSynthesis is undefined',
    });

    setTests(results);
    results.forEach(r => addDebugLog(`SpeechTest detect: ${r.name} = ${r.status} — ${r.detail}`));
  }, []);

  const addSpeechEvent = (type: string, detail: string) => {
    const event: SpeechEvent = {
      time: new Date().toISOString().split('T')[1].split('.')[0],
      type,
      detail,
    };
    setSpeechEvents(prev => [event, ...prev].slice(0, 30));
    addDebugLog(`SpeechTest event: ${type} — ${detail}`);
  };

  // --- Test 1: Microphone Permission ---
  const testMicrophone = async () => {
    setMicStatus('requesting...');
    addSpeechEvent('mic-permission', 'Requesting getUserMedia({ audio: true })');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);
      setMicStatus('granted');
      addSpeechEvent('mic-permission', 'Permission GRANTED. Stream obtained.');
    } catch (err: any) {
      setMicStatus(`denied: ${err.name} — ${err.message}`);
      setMicStream(null);
      addSpeechEvent('mic-permission', `Permission DENIED: ${err.name} — ${err.message}`);
    }
  };

  const stopMicStream = () => {
    if (micStream) {
      micStream.getTracks().forEach(t => t.stop());
      setMicStream(null);
      setMicStatus('stream stopped');
      addSpeechEvent('mic-permission', 'Audio tracks stopped.');
    }
  };

  // --- Test 2: MediaRecorder ---
  const startRecorder = async () => {
    setRecorderStatus('requesting...');
    recorderChunksRef.current = [];
    setRecordedBlob(null);
    setRecordedUrl(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recorderChunksRef.current.push(e.data);
      };

      recorder.onstart = () => {
        setRecorderStatus('recording (5s)...');
        setRecorderVolume(0);
        addSpeechEvent('mediarecorder', 'Recording started for 5 seconds.');

        // Volume meter via AudioContext
        try {
          const audioCtx = new AudioContext();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (recorder.state !== 'recording') return;
            analyser.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((a: number, b: number) => a + b, 0) / dataArray.length;
            setRecorderVolume(Math.round(avg));
            requestAnimationFrame(updateVolume);
          };
          updateVolume();
        } catch (e) {
          addSpeechEvent('mediarecorder', `Volume meter unavailable: ${e}`);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        setRecorderVolume(0);
        const blob = new Blob(recorderChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setRecordedBlob(blob);

        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        setRecorderStatus('done — blob created');
        addSpeechEvent('mediarecorder', `Recording stopped. Blob size: ${blob.size} bytes, type: ${blob.type}`);
      };

      recorder.onerror = (e) => {
        setRecorderStatus(`error: ${JSON.stringify(e)}`);
        addSpeechEvent('mediarecorder', `Error: ${JSON.stringify(e)}`);
      };

      recorder.start();
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 5000);
    } catch (err: any) {
      setRecorderStatus(`failed: ${err.name} — ${err.message}`);
      addSpeechEvent('mediarecorder', `Failed: ${err.name} — ${err.message}`);
    }
  };

  // --- Test 3: Speech Recognition ---
  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechStatus('unavailable — no SpeechRecognition API');
      addSpeechEvent('speech', 'ERROR: No SpeechRecognition API found.');
      return;
    }

    setInterimTranscript('');
    setFinalTranscript('');
    setSpeechStatus('starting...');
    speechRetriesRef.current = 0;
    addSpeechEvent('speech', 'Creating SpeechRecognition instance...');

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setSpeechStatus('listening');
      addSpeechEvent('speech', 'onstart fired — recognition active.');
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += text + ' ';
        } else {
          interim += text;
        }
      }
      setInterimTranscript(interim);
      if (final) {
        setFinalTranscript(prev => prev + final);
        addSpeechEvent('speech', `Final result: "${final.trim()}"`);
      }
      if (interim) {
        addSpeechEvent('speech', `Interim: "${interim}"`);
      }
    };

    recognition.onerror = (event: any) => {
      addSpeechEvent('speech', `ERROR: ${event.error} — ${event.message || ''}`);
      if (event.error === 'not-allowed') {
        setSpeechStatus('error: microphone permission denied');
      } else if (event.error === 'no-speech') {
        // Don't treat no-speech as fatal — may just need louder speech
        setSpeechStatus(`no speech detected (retry ${speechRetriesRef.current}/${maxSpeechRetries})`);
        // Handled in onend — auto-restart
      } else if (event.error === 'network') {
        setSpeechStatus('error: network failure — check proxy/internet');
      } else {
        setSpeechStatus(`error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      const isNoSpeech = speechRetriesRef.current < maxSpeechRetries
        && recognitionRef.current
        && (speechStatus.includes('no speech') || speechStatus === 'listening' || speechStatus === 'starting...');

      // We can't easily check the last error type here, so use a different approach:
      // Always try to restart if we haven't hit max retries AND no final transcript yet
      const shouldRetry = speechRetriesRef.current < maxSpeechRetries
        && !finalTranscript
        && !speechStatus.includes('error:')
        && speechStatus !== 'error: microphone permission denied';

      if (shouldRetry) {
        speechRetriesRef.current += 1;
        setSpeechStatus(`retrying (${speechRetriesRef.current}/${maxSpeechRetries})...`);
        addSpeechEvent('speech', `Auto-restarting recognition after no-speech (attempt ${speechRetriesRef.current}/${maxSpeechRetries})`);
        try {
          recognitionRef.current = new SpeechRecognition();
          const retryRecognition = recognitionRef.current;
          retryRecognition.lang = 'en-US';
          retryRecognition.continuous = true;
          retryRecognition.interimResults = true;
          retryRecognition.onstart = () => {
            setSpeechStatus(`listening (retry ${speechRetriesRef.current}/${maxSpeechRetries})`);
            addSpeechEvent('speech', `Retry ${speechRetriesRef.current} onstart.`);
          };
          retryRecognition.onresult = recognition.onresult;
          retryRecognition.onerror = recognition.onerror;
          retryRecognition.onend = recognition.onend;
          retryRecognition.onaudiostart = () => addSpeechEvent('speech', 'onaudiostart — audio capture began.');
          retryRecognition.onaudioend = () => addSpeechEvent('speech', 'onaudioend — audio capture ended.');
          retryRecognition.onsoundstart = () => addSpeechEvent('speech', 'onsoundstart — sound detected.');
          retryRecognition.onsoundend = () => addSpeechEvent('speech', 'onsoundend — sound ended.');
          retryRecognition.onspeechstart = () => addSpeechEvent('speech', 'onspeechstart — speech detected.');
          retryRecognition.onspeechend = () => addSpeechEvent('speech', 'onspeechend — speech ended.');
          retryRecognition.start();
          return;
        } catch (e: any) {
          addSpeechEvent('speech', `Retry failed: ${e.message}`);
        }
      }

      // No more retries or we have results
      if (speechRetriesRef.current >= maxSpeechRetries && !finalTranscript) {
        setSpeechStatus('error: no speech after max retries — speak louder or check mic volume in Windows settings');
      } else if (!speechStatus.startsWith('error')) {
        setSpeechStatus('ended');
      }
      addSpeechEvent('speech', `onend fired — recognition stopped. (retries: ${speechRetriesRef.current})`);
    };

    recognition.onaudiostart = () => addSpeechEvent('speech', 'onaudiostart — audio capture began.');
    recognition.onaudioend = () => addSpeechEvent('speech', 'onaudioend — audio capture ended.');
    recognition.onsoundstart = () => addSpeechEvent('speech', 'onsoundstart — sound detected.');
    recognition.onsoundend = () => addSpeechEvent('speech', 'onsoundend — sound ended.');
    recognition.onspeechstart = () => addSpeechEvent('speech', 'onspeechstart — speech detected.');
    recognition.onspeechend = () => addSpeechEvent('speech', 'onspeechend — speech ended.');

    try {
      recognition.start();
    } catch (err: any) {
      setSpeechStatus(`failed to start: ${err.message}`);
      addSpeechEvent('speech', `Failed to start: ${err.message}`);
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      addSpeechEvent('speech', 'Manual stop requested.');
    }
  };

  // --- Test 4: SpeechSynthesis ---
  const testSynthesis = () => {
    if (!window.speechSynthesis) {
      setSynthStatus('unavailable');
      addSpeechEvent('synth', 'ERROR: window.speechSynthesis is undefined.');
      return;
    }

    setSynthStatus('speaking...');
    const utterance = new SpeechSynthesisUtterance('This is a microphone and speech recognition test.');
    utterance.lang = 'en-US';
    utterance.rate = 0.9;

    utterance.onstart = () => {
      setSynthStatus('speaking...');
      addSpeechEvent('synth', 'onstart — speaking test sentence.');
    };
    utterance.onend = () => {
      setSynthStatus('done');
      addSpeechEvent('synth', 'onend — finished speaking.');
    };
    utterance.onerror = (e) => {
      setSynthStatus(`error: ${e.error}`);
      addSpeechEvent('synth', `ERROR: ${e.error}`);
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    addSpeechEvent('synth', 'Speaking test sentence...');
  };

  const statusIcon = (status: string) => {
    if (status === 'pass') return <CheckCircle2 className="w-4 h-4 text-green-700" />;
    if (status === 'fail') return <XCircle className="w-4 h-4 text-red-800" />;
    return <span className="w-4 h-4 text-paper-ink/20">—</span>;
  };

  return (
    <PageShell>
      <TopBar />

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Speech System Diagnostics</h1>
        <p className="text-sm text-paper-ink/50 italic">
          This page tests each speech subsystem independently. Use it to isolate issues before debugging the main Speaking Practice page.
        </p>
      </div>

      {/* Section 1: Browser Support Detection */}
      <PaperCard className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest mb-4 border-b border-paper-ink/10 pb-2">
          1. Browser Support Detection
        </h2>
        <div className="space-y-2 font-mono text-xs">
          {tests.map((test) => (
            <div key={test.name} className="flex items-center gap-3 py-1 border-b border-paper-ink/5 last:border-0">
              {statusIcon(test.status)}
              <span className="w-48 font-bold">{test.name}</span>
              <span className={`${test.status === 'fail' ? 'text-red-800' : 'text-paper-ink/60'}`}>
                {test.detail}
              </span>
            </div>
          ))}
        </div>
      </PaperCard>

      {/* Section 2: Microphone Permission */}
      <PaperCard className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest mb-4 border-b border-paper-ink/10 pb-2">
          2. Microphone Permission Test
        </h2>
        <p className="text-xs text-paper-ink/50 mb-3">
          Requests microphone access. Watch for the browser permission prompt.
        </p>
        <div className="flex items-center gap-3 mb-3">
          <SerifButton onClick={testMicrophone} className="flex items-center gap-2 text-xs">
            <Mic className="w-3 h-3" /> Test Microphone Permission
          </SerifButton>
          {micStream && (
            <SerifButton onClick={stopMicStream} variant="outline" className="text-xs">
              Stop Stream
            </SerifButton>
          )}
        </div>
        <div className={`text-xs font-mono p-2 rounded border ${
          micStatus === 'granted' ? 'bg-green-50 border-green-200 text-green-800' :
          micStatus.startsWith('denied') ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-paper-ink/5 border-paper-ink/10 text-paper-ink/60'
        }`}>
          Status: {micStatus}
          {micStream && ` (active tracks: ${micStream.getAudioTracks().length})`}
        </div>
      </PaperCard>

      {/* Section 3: MediaRecorder Test */}
      <PaperCard className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest mb-4 border-b border-paper-ink/10 pb-2">
          3. MediaRecorder Test
        </h2>
        <p className="text-xs text-paper-ink/50 mb-3">
          Records 5 seconds of audio and creates a playable blob.
        </p>
        <div className="flex items-center gap-3 mb-3">
          <SerifButton
            onClick={startRecorder}
            disabled={recorderStatus.startsWith('recording')}
            className="flex items-center gap-2 text-xs"
          >
            <Play className="w-3 h-3" /> Record 5 Seconds
          </SerifButton>
        </div>
        <div className={`text-xs font-mono p-2 rounded border mb-3 ${
          recorderStatus === 'done — blob created' ? 'bg-green-50 border-green-200 text-green-800' :
          recorderStatus.startsWith('failed') || recorderStatus.startsWith('error') ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-paper-ink/5 border-paper-ink/10 text-paper-ink/60'
        }`}>
          Status: {recorderStatus}
          {recordedBlob && ` | Blob: ${recordedBlob.size} bytes, type: ${recordedBlob.type}`}
        </div>

        {/* Volume meter */}
        {(recorderStatus.startsWith('recording') || recorderVolume > 0) && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-paper-ink/40">Mic Volume</span>
              <span className="text-[10px] font-mono text-paper-ink/60">{recorderVolume}</span>
            </div>
            <div className="w-full h-3 bg-paper-ink/10 rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-100 rounded ${
                  recorderVolume < 5 ? 'bg-red-400' :
                  recorderVolume < 20 ? 'bg-amber-400' :
                  'bg-green-500'
                }`}
                style={{ width: `${Math.min(recorderVolume * 100 / 50, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-paper-ink/30 mt-1">
              {recorderVolume < 5
                ? 'Volume too low — mic may not detect speech. Check Windows mic settings.'
                : recorderVolume < 20
                ? 'Low volume — try speaking louder or moving closer to mic.'
                : 'Good volume level.'}
            </p>
          </div>
        )}

        {recordedUrl && (
          <div className="p-3 bg-green-50/50 border border-green-200 rounded">
            <p className="text-xs font-bold mb-2 text-green-800">Recording successful — playback below:</p>
            <audio controls src={recordedUrl} className="w-full max-w-md h-8" />
          </div>
        )}
      </PaperCard>

      {/* Section 4: Web Speech Recognition */}
      <PaperCard className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest mb-4 border-b border-paper-ink/10 pb-2">
          4. Web Speech Recognition Test
        </h2>
        <p className="text-xs text-paper-ink/50 mb-3">
          Starts speech recognition. Speak in English and watch for real-time transcription.
        </p>
        <div className="flex items-center gap-3 mb-3">
          <SerifButton
            onClick={startSpeechRecognition}
            disabled={speechStatus === 'listening'}
            className="flex items-center gap-2 text-xs"
          >
            <Mic className="w-3 h-3" /> Start Speech Recognition
          </SerifButton>
          <SerifButton
            onClick={stopSpeechRecognition}
            disabled={speechStatus !== 'listening'}
            variant="outline"
            className="flex items-center gap-2 text-xs"
          >
            <Square className="w-3 h-3" /> Stop
          </SerifButton>
        </div>
        <div className={`text-xs font-mono p-2 rounded border mb-3 ${
          speechStatus === 'listening' ? 'bg-green-50 border-green-200 text-green-800 animate-pulse' :
          speechStatus.startsWith('error') ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-paper-ink/5 border-paper-ink/10 text-paper-ink/60'
        }`}>
          Status: {speechStatus}
        </div>

        {/* Transcript display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-paper-ink/40 mb-1">Interim Transcript</h3>
            <div className="min-h-[40px] p-2 bg-paper-ink/5 rounded border border-paper-ink/10 font-serif text-sm italic text-paper-ink/60">
              {interimTranscript || '(empty — speak to see interim results)'}
            </div>
          </div>
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-paper-ink/40 mb-1">Final Transcript</h3>
            <div className="min-h-[40px] p-2 bg-paper-ink/5 rounded border border-paper-ink/10 font-serif text-sm text-paper-ink">
              {finalTranscript || '(empty — final results accumulate here)'}
            </div>
          </div>
        </div>
      </PaperCard>

      {/* Section 5: SpeechSynthesis Test */}
      <PaperCard className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest mb-4 border-b border-paper-ink/10 pb-2">
          5. SpeechSynthesis Test
        </h2>
        <p className="text-xs text-paper-ink/50 mb-3">
          Reads a test sentence aloud using the browser text-to-speech engine.
        </p>
        <div className="flex items-center gap-3 mb-3">
          <SerifButton onClick={testSynthesis} className="flex items-center gap-2 text-xs">
            <Volume2 className="w-3 h-3" /> Read Test Sentence
          </SerifButton>
        </div>
        <div className={`text-xs font-mono p-2 rounded border ${
          synthStatus === 'done' ? 'bg-green-50 border-green-200 text-green-800' :
          synthStatus.startsWith('error') || synthStatus === 'unavailable' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-paper-ink/5 border-paper-ink/10 text-paper-ink/60'
        }`}>
          Status: {synthStatus}
        </div>
        <p className="text-[10px] text-paper-ink/30 italic mt-2">
          Test sentence: "This is a microphone and speech recognition test."
        </p>
      </PaperCard>

      {/* Section 6: Event Log */}
      <PaperCard>
        <h2 className="text-sm font-bold uppercase tracking-widest mb-4 border-b border-paper-ink/10 pb-2">
          6. Event Log
        </h2>
        <div className="max-h-[300px] overflow-auto font-mono text-[10px] space-y-0.5">
          {speechEvents.length === 0 ? (
            <p className="text-paper-ink/20 italic">No events yet. Run a test above.</p>
          ) : (
            speechEvents.map((ev, i) => (
              <div key={i} className="flex gap-2 py-0.5 border-b border-paper-ink/5 last:border-0">
                <span className="text-paper-ink/30 shrink-0">{ev.time}</span>
                <span className="font-bold text-paper-ink/50 shrink-0 w-28 truncate">{ev.type}</span>
                <span className={`${
                  ev.detail.toLowerCase().includes('error') ? 'text-red-800' : 'text-paper-ink/60'
                }`}>{ev.detail}</span>
              </div>
            ))
          )}
        </div>
      </PaperCard>
    </PageShell>
  );
}
