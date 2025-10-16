
import React, { useState, useEffect, useRef } from 'react';
import { useBookLibrary } from '../hooks/useBookLibrary';
import { processPdf } from '../services/pdfService';
import { generateAndCacheAudio, audioCache, clearAudioCache } from '../services/ttsService';
import { pcmToWav, base64ToArrayBuffer } from '../utils/audioUtils';
import { VOICES } from '../constants';
import { BackArrowIcon, NextIcon, PauseIcon, PlayIcon, StopIcon } from './Icons';
import Spinner from './Spinner';
import type { Book } from '../types';

interface ReaderViewProps {
    bookId: number;
    onBackToLibrary: () => void;
}

const PRELOAD_BUFFER_SIZE = 3;

const ReaderView: React.FC<ReaderViewProps> = ({ bookId, onBackToLibrary }) => {
    const [book, setBook] = useState<Book | null>(null);
    const [textChunks, setTextChunks] = useState<string[]>([]);
    const [status, setStatus] = useState('Carregando livro...');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [selectedVoice, setSelectedVoice] = useState(VOICES[0].value);
    
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
    const stopPlaybackRef = useRef(false);
    const pendingPreloads = useRef(new Set<number>());

    const { getBook, updateBookPosition } = useBookLibrary();

    const cleanupAudio = () => {
        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.src = '';
            audioPlayerRef.current = null;
        }
    };
    
    const handleBack = () => {
        stopPlaybackRef.current = true;
        cleanupAudio();
        clearAudioCache();
        onBackToLibrary();
    };

    useEffect(() => {
        const loadBook = async () => {
            setIsLoading(true);
            setError(null);
            setStatus('Carregando livro...');
            
            const bookData = await getBook(bookId);
            if (!bookData) {
                setError('Livro não encontrado.');
                setIsLoading(false);
                return;
            }
            setBook(bookData);
            
            try {
                setStatus('Processando PDF...');
                const { text } = await processPdf(bookData.file);
                const chunks = text.match(/[^.!?\n]+[.!?\n]*|[\n]+/g)?.filter(chunk => chunk.trim().length > 0) || [];
                setTextChunks(chunks);
                setCurrentChunkIndex(bookData.lastPosition || 0);
                setStatus('Pronto para tocar.');
            } catch (err) {
                console.error("Error processing PDF:", err);
                setError('Falha ao processar o PDF.');
            } finally {
                setIsLoading(false);
            }
        };

        loadBook();

        return () => {
            stopPlaybackRef.current = true;
            cleanupAudio();
            clearAudioCache();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bookId, getBook]);

    const managePreloadBuffer = async () => {
        for (let i = 1; i <= PRELOAD_BUFFER_SIZE; i++) {
            const preloadIndex = currentChunkIndex + i;
            if (preloadIndex < textChunks.length && !audioCache.has(preloadIndex) && !pendingPreloads.current.has(preloadIndex)) {
                pendingPreloads.current.add(preloadIndex);
                try {
                    await generateAndCacheAudio(textChunks[preloadIndex], selectedVoice, preloadIndex);
                } catch (e) {
                    console.error(`Failed to preload chunk ${preloadIndex}`, e);
                } finally {
                    pendingPreloads.current.delete(preloadIndex);
                }
            }
        }
    };

    const playNextChunk = async () => {
        if (stopPlaybackRef.current || currentChunkIndex >= textChunks.length) {
            handleStop();
            setCurrentChunkIndex(0);
            return;
        }

        setIsPlaying(true);
        setIsPaused(false);
        setStatus(`Lendo trecho ${currentChunkIndex + 1} de ${textChunks.length}...`);
        
        await updateBookPosition(bookId, currentChunkIndex);
        managePreloadBuffer();
        
        try {
            const audioUrl = await generateAndCacheAudio(textChunks[currentChunkIndex], selectedVoice, currentChunkIndex);
            if (!audioUrl || stopPlaybackRef.current) {
// FIX: The `setStatus` function from `useState` only accepts one argument. The extra argument has been removed.
                if(!stopPlaybackRef.current) setStatus(`Falha ao obter áudio para o trecho.`);
                handleStop();
                return;
            }

            cleanupAudio();
            audioPlayerRef.current = new Audio(audioUrl);
            audioPlayerRef.current.playbackRate = playbackRate;
            audioPlayerRef.current.onended = () => {
                if (!stopPlaybackRef.current) {
                    setCurrentChunkIndex(prev => prev + 1);
                }
            };
             audioPlayerRef.current.onerror = () => { 
                setStatus('Erro ao reproduzir o áudio.');
                handleStop();
            };
            audioPlayerRef.current.play().catch(e => {
                console.error("Play error:", e);
                handleStop();
            });

        } catch (error) {
            console.error(error);
            setStatus('Erro ao gerar áudio.');
            handleStop();
        }
    };

    useEffect(() => {
        if(isPlaying && !isPaused) {
            playNextChunk();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentChunkIndex]);


    const startPlayback = (index?: number) => {
        stopPlaybackRef.current = false;
        const newIndex = index ?? currentChunkIndex;
        setCurrentChunkIndex(newIndex);
        setIsPlaying(true);
        setIsPaused(false);
        // This will trigger the useEffect to call playNextChunk
        if (index !== undefined) {
             playNextChunk();
        }
    };

    const handlePlayPause = () => {
        if (isPlaying) {
            audioPlayerRef.current?.pause();
            setIsPaused(true);
            setIsPlaying(false);
            setStatus('Pausado.');
        } else if (isPaused) {
            audioPlayerRef.current?.play();
            setIsPaused(false);
            setIsPlaying(true);
            setStatus(`Lendo trecho ${currentChunkIndex + 1} de ${textChunks.length}...`);
        } else {
            startPlayback();
        }
    };

    const handleStop = (clearCache = true) => {
        stopPlaybackRef.current = true;
        cleanupAudio();
        setIsPlaying(false);
        setIsPaused(false);
        if (clearCache) {
            clearAudioCache();
        }
        pendingPreloads.current.clear();
        setStatus('Parado.');
    };

    const handleNext = () => {
        if (currentChunkIndex < textChunks.length - 1) {
            handleStop(false);
            setCurrentChunkIndex(prev => prev + 1);
            startPlayback(currentChunkIndex + 1);
        }
    };

    const handleTextClick = (index: number) => {
        if (!isPlaying) {
            handleStop(false);
            startPlayback(index);
        }
    };
    
    useEffect(() => {
        const span = document.querySelector(`#text-display span[data-index='${currentChunkIndex}']`);
        span?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [currentChunkIndex]);


    if (isLoading) return <div className="flex justify-center items-center h-96"><Spinner /> <p className="ml-4">{status}</p></div>;
    if (error) return <p className="text-center text-red-500">{error}</p>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <button onClick={handleBack} className="flex items-center text-black hover:text-gray-700 transition-colors">
                    <BackArrowIcon />
                    <span className="ml-2">Voltar para a Biblioteca</span>
                </button>
                <h2 className="text-xl font-bold text-center text-gray-800 truncate">{book?.name}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div>
                    <label htmlFor="voice-select" className="block mb-2 text-sm font-medium text-gray-700">Voz</label>
                    {/* FIX: The `<option>` elements were outside the `<select>` tag, causing a rendering error. They have been moved inside. */}
                    <select id="voice-select" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)} disabled={isPlaying} className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-black focus:ring-black focus:border-black transition">
                        {VOICES.map(voice => (
                            <option key={voice.value} value={voice.value}>{voice.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                     <label htmlFor="speed-control" className="block mb-2 text-sm font-medium text-gray-700">Velocidade: <span className="font-bold text-black">{playbackRate.toFixed(1)}x</span></label>
                     <input type="range" id="speed-control" min="0.5" max="2" step="0.1" value={playbackRate} onChange={e => {
                         const newRate = parseFloat(e.target.value);
                         setPlaybackRate(newRate);
                         if(audioPlayerRef.current) audioPlayerRef.current.playbackRate = newRate;
                     }} className="w-full h-2 rounded-lg appearance-none cursor-pointer" />
                </div>
            </div>

            <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center space-x-4">
                <button onClick={handlePlayPause} className={`p-4 bg-black rounded-full text-white disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 ${isPlaying ? 'btn-glowing-shadow' : ''}`} disabled={!textChunks.length}>
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button onClick={handleNext} className="p-3 bg-gray-700 rounded-full text-white disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50" disabled={!textChunks.length || currentChunkIndex >= textChunks.length - 1}>
                    <NextIcon />
                </button>
                <button onClick={() => handleStop()} className="p-3 bg-gray-700 rounded-full text-white disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50" disabled={!textChunks.length}>
                     <StopIcon />
                </button>
            </div>
            
            <div className="text-center text-gray-600 h-6">{status}</div>

            <div>
                <label htmlFor="text-display" className="block mb-2 text-sm font-medium text-gray-700">Texto Extraído (clique para iniciar a leitura)</label>
                <div id="text-display" className="w-full h-64 bg-white border border-gray-300 rounded-lg p-3 text-gray-800 overflow-y-auto custom-scrollbar">
                    {textChunks.map((chunk, index) => (
                        <span
                            key={index}
                            data-index={index}
                            className={index === currentChunkIndex && isPlaying ? 'highlight' : ''}
                            onClick={() => handleTextClick(index)}
                        >
                            {chunk}{' '}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ReaderView;