'use client'

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getFileUrl } from '@/lib/utils/pdfUtils';

/**
 * Custom hook for PDF viewer functionality
 */
export const usePDFViewer = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // Navigate away if no PDF file
  useEffect(() => {
    if (!pdfFile) {
      router.push('/');
    }
  }, [pdfFile, router]);

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

