'use client'

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/db/supabaseClient';
import { getFileUrl } from '@/lib/utils/pdfUtils';

/**
 * Custom hook for PDF viewer functionality
 */
export const usePDFViewer = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseClient();
  const docId = searchParams.get('docId');
  const [pdfFile, setPdfFile] = useState(() => {
    const fileUrl = searchParams.get('fileUrl');
    if (fileUrl) return fileUrl;
    // Fallback to sessionStorage
    const base64 = typeof window !== 'undefined' ? sessionStorage.getItem('pdfFile') : null;
    if (base64) {
      const byteCharacters = atob(base64.split(',')[1]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      return URL.createObjectURL(blob);
    }
    return null;
  });
  const [numPages, setNumPages] = useState(null);
  const [pageWidth, setPageWidth] = useState(800);
  const [currentPageInView, setCurrentPageInView] = useState(1);
  const containerRef = useRef(null);
  const pdfContainerRef = useRef(null);
  const [isFetchingDoc, setIsFetchingDoc] = useState(false);

  // Navigate away if no PDF file
  useEffect(() => {
    if (!pdfFile && !docId) {
      router.push('/');
    }
  }, [pdfFile, docId, router]);

  // If the PDF isn't in session/query but we have a docId, fetch it from Supabase Storage
  useEffect(() => {
    const loadFromStorage = async () => {
      if (!supabase || !docId || pdfFile || isFetchingDoc) return;
      setIsFetchingDoc(true);
      try {
        const { data: docRow, error: docError } = await supabase
          .from('documents')
          .select('file_bucket, file_path, title')
          .eq('id', docId)
          .maybeSingle();

        if (docError || !docRow?.file_bucket || !docRow?.file_path) {
          router.push('/');
          return;
        }

        const { data: blob, error: downloadError } = await supabase.storage
          .from(docRow.file_bucket)
          .download(docRow.file_path);

        if (downloadError || !blob) {
          router.push('/');
          return;
        }

        // Create an object URL for the viewer
        const objectUrl = URL.createObjectURL(blob);
        setPdfFile(objectUrl);

        // Store in sessionStorage for reloads
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result;
          if (base64) {
            sessionStorage.setItem('pdfFile', base64);
            if (docRow.title) sessionStorage.setItem('pdfFileName', docRow.title);
          }
        };
        reader.readAsDataURL(blob);
      } finally {
        setIsFetchingDoc(false);
      }
    };

    loadFromStorage();
  }, [supabase, docId, pdfFile, isFetchingDoc, router]);

  // Update page width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        setPageWidth(Math.min(containerWidth - 100, 900));
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Track current page in view using Intersection Observer
  useEffect(() => {
    if (!pdfContainerRef.current || !numPages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.dataset.pageNumber);
            setCurrentPageInView(pageNum);
          }
        });
      },
      { threshold: 0.5 }
    );

    const pages = pdfContainerRef.current.querySelectorAll('[data-page-number]');
    pages.forEach((page) => observer.observe(page));

    return () => {
      pages.forEach((page) => observer.unobserve(page));
    };
  }, [numPages, pdfFile]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  return {
    pdfFile,
    numPages,
    pageWidth,
    currentPageInView,
    containerRef,
    pdfContainerRef,
    onDocumentLoadSuccess
  };
};

