import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFileUrl } from '../utils/pdfUtils';

/**
 * Custom hook for PDF viewer functionality
 */
export const usePDFViewer = (location) => {
  const navigate = useNavigate();
  const [pdfFile, setPdfFile] = useState(() => getFileUrl(location));
  const [numPages, setNumPages] = useState(null);
  const [pageWidth, setPageWidth] = useState(800);
  const [currentPageInView, setCurrentPageInView] = useState(1);
  const containerRef = useRef(null);
  const pdfContainerRef = useRef(null);

  // Navigate away if no PDF file
  useEffect(() => {
    if (!pdfFile) {
      navigate('/');
    }
  }, [pdfFile, navigate]);

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

