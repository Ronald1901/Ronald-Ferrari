
import React, { useState, useEffect, useCallback } from 'react';
import { useBookLibrary } from '../hooks/useBookLibrary';
import { processPdf } from '../services/pdfService';
import BookItem from './BookItem';
import Spinner from './Spinner';
import type { Book } from '../types';

interface LibraryViewProps {
    onOpenBook: (bookId: number) => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({ onOpenBook }) => {
    const { books, addBook, deleteBook, isInitialized } = useBookLibrary();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setError(null);
        try {
            const { thumbnail } = await processPdf(file);
            const newBook: Omit<Book, 'id'> = {
                name: file.name,
                file: file,
                lastPosition: 0,
                thumbnail: thumbnail
            };
            const addedBook = await addBook(newBook);
            onOpenBook(addedBook.id);
        } catch (err) {
            console.error("Error processing PDF:", err);
            setError("Falha ao processar o arquivo PDF. Tente novamente.");
        } finally {
            setIsLoading(false);
            event.target.value = ''; // Reset file input
        }
    };

    const handleDeleteBook = useCallback(async (id: number, name: string) => {
        if (window.confirm(`Tem certeza que deseja remover "${name}"?`)) {
            await deleteBook(id);
        }
    }, [deleteBook]);

    if (!isInitialized) {
        return <div className="flex justify-center items-center h-96"><Spinner /></div>;
    }

    return (
        <div id="library-view">
            <div className="text-center mb-6">
                <h1 className="text-3xl font-bold text-black">Minha Biblioteca</h1>
                <p className="text-gray-600 mt-2">Seus livros salvos. Clique em um para abrir.</p>
            </div>
            {isLoading && (
                <div className="text-center my-4">
                    <Spinner />
                    <p className="text-gray-600 mt-2">Processando seu livro...</p>
                </div>
            )}
            {error && <p className="text-center text-red-500 my-4">{error}</p>}
             <div className="mt-6">
                <label htmlFor="pdf-upload" className="w-full text-center block bg-black hover:bg-gray-800 text-white font-bold py-3 px-4 rounded-lg cursor-pointer transition-colors duration-200">
                    + Adicionar Novo Livro
                </label>
                <input type="file" id="pdf-upload" accept=".pdf" className="hidden" onChange={handleFileSelect} disabled={isLoading} />
            </div>
            <div id="book-list" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                {books.length > 0 ? (
                    books.map(book => (
                        <BookItem key={book.id} book={book} onOpen={onOpenBook} onDelete={handleDeleteBook} />
                    ))
                ) : (
                    <p className="text-center text-gray-500 col-span-full mt-4">Sua biblioteca está vazia. Adicione um livro para começar.</p>
                )}
            </div>
        </div>
    );
};

export default LibraryView;
