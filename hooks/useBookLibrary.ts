
import { useState, useEffect, useCallback } from 'react';
import type { Book } from '../types';

const DB_NAME = 'PDFReaderDB';
const DB_VERSION = 1;
const STORE_NAME = 'books';

let dbInstance: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject("Error opening database.");
        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
};

export const useBookLibrary = () => {
    const [books, setBooks] = useState<Book[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);

    const refreshBooks = useCallback(async () => {
        const db = await openDB();
        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => {
                setBooks(request.result as Book[]);
                resolve();
            };
            request.onerror = () => reject("Failed to fetch books.");
        });
    }, []);

    useEffect(() => {
        openDB().then(() => {
            refreshBooks().finally(() => setIsInitialized(true));
        }).catch(err => {
            console.error(err);
            setIsInitialized(true); // Still finish initialization even on error
        });
    }, [refreshBooks]);

    const addBook = useCallback(async (book: Omit<Book, 'id'>): Promise<Book> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.add(book);
            request.onsuccess = () => {
                const newBook = { ...book, id: request.result as number };
                refreshBooks();
                resolve(newBook);
            };
            request.onerror = () => reject("Failed to save book.");
        });
    }, [refreshBooks]);

    const getBook = useCallback(async (id: number): Promise<Book | null> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result as Book | null);
            request.onerror = () => reject("Failed to fetch the book.");
        });
    }, []);

    const deleteBook = useCallback(async (id: number) => {
        const db = await openDB();
        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => {
                refreshBooks();
                resolve();
            };
            request.onerror = () => reject("Failed to delete book.");
        });
    }, [refreshBooks]);

    const updateBookPosition = useCallback(async (id: number, position: number) => {
        const db = await openDB();
        const book = await getBook(id);
        if (book) {
            const updatedBook = { ...book, lastPosition: position };
            return new Promise<void>((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put(updatedBook);
                request.onsuccess = () => resolve();
                request.onerror = () => reject("Failed to update book position.");
            });
        }
    }, [getBook]);

    return { books, addBook, getBook, deleteBook, updateBookPosition, isInitialized };
};
