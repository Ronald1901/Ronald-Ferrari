
import React, { useState, useCallback } from 'react';
import LibraryView from './components/LibraryView';
import ReaderView from './components/ReaderView';
import type { Book } from './types';

const App: React.FC = () => {
    const [currentBookId, setCurrentBookId] = useState<number | null>(null);

    const handleOpenBook = useCallback((bookId: number) => {
        setCurrentBookId(bookId);
    }, []);

    const handleBackToLibrary = useCallback(() => {
        setCurrentBookId(null);
    }, []);

    return (
        <div className="bg-white text-black flex items-center justify-center min-h-screen p-4">
            <div className="bg-gray-50 rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-3xl border border-gray-300">
                {currentBookId === null ? (
                    <LibraryView onOpenBook={handleOpenBook} />
                ) : (
                    <ReaderView bookId={currentBookId} onBackToLibrary={handleBackToLibrary} />
                )}
            </div>
        </div>
    );
};

export default App;
