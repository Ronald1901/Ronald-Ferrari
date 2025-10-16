
import React from 'react';
import type { Book } from '../types';

interface BookItemProps {
    book: Book;
    onOpen: (id: number) => void;
    onDelete: (id: number, name: string) => void;
}

const BookItem: React.FC<BookItemProps> = ({ book, onOpen, onDelete }) => {
    const handleDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        onDelete(book.id, book.name);
    };

    return (
        <div className="relative group cursor-pointer bg-white rounded-lg shadow border border-gray-200 hover:shadow-lg transition-shadow" onClick={() => onOpen(book.id)}>
            <img src={book.thumbnail} alt={book.name} className="rounded-t-lg object-cover w-full h-40" />
            <p className="text-xs font-semibold text-gray-800 p-2 truncate">{book.name}</p>
            <button
                onClick={handleDelete}
                className="delete-btn absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Delete ${book.name}`}
            >
                &times;
            </button>
        </div>
    );
};

export default BookItem;
