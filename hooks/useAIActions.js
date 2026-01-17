'use client'

import { useState } from 'react';
import { getAIExplanation, getAISummary, getReferenceCheck } from '@/lib/services/ai/actions';

/**
 * Custom hook for AI actions (explanation, summary, reference check)
 */
export const useAIActions = (onCreateAIHighlight = null) => {
  const [explanation, setExplanation] = useState('');
  const [summary, setSummary] = useState('');
  const [referenceCheck, setReferenceCheck] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState(null);

  const handleAIExplain = async (selectedText, selectedRange = null, currentPageInView = null) => {
    if (!selectedText) return null;
    
    setIsLoading(true);
    setActiveAction('explain');
    setSummary('');
    setReferenceCheck('');
    
    try {
      const result = await getAIExplanation(selectedText);
      setExplanation(result);
      
      // Create AI highlight if callback is provided
      if (onCreateAIHighlight && selectedRange && currentPageInView) {
        const highlightResult = onCreateAIHighlight(selectedText, selectedRange, currentPageInView, 'explanation', result);
        return highlightResult;
      }
      return null;
    } catch (error) {
      setExplanation('Sorry, there was an error getting the explanation. Please try again.');
      console.error('Error:', error);
      return null;
    } finally {
      setIsLoading(false);
      window.getSelection().removeAllRanges();
    }
  };

  const handleAISummary = async (selectedText, selectedRange = null, currentPageInView = null) => {
    if (!selectedText) return null;
    
    setIsLoading(true);
    setActiveAction('summary');
    setExplanation('');
    setReferenceCheck('');
    
    try {
      const result = await getAISummary(selectedText);
      setSummary(result);
      
      // Create AI highlight if callback is provided
      if (onCreateAIHighlight && selectedRange && currentPageInView) {
        const highlightResult = onCreateAIHighlight(selectedText, selectedRange, currentPageInView, 'summary', result);
        return highlightResult;
      }
      return null;
    } catch (error) {
      setSummary('Sorry, there was an error getting the summary. Please try again.');
      console.error('Error:', error);
      return null;
    } finally {
      setIsLoading(false);
      window.getSelection().removeAllRanges();
    }
  };

  const handleReferenceCheck = async (selectedText) => {
    if (!selectedText) return;
    
    setIsLoading(true);
    setActiveAction('reference');
    setExplanation('');
    setSummary('');
    
    try {
      const result = await getReferenceCheck(selectedText);
      setReferenceCheck(result);
    } catch (error) {
      setReferenceCheck('Sorry, there was an error checking references. Please try again.');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
      window.getSelection().removeAllRanges();
    }
  };

  const clearAIActions = () => {
    setExplanation('');
    setSummary('');
    setReferenceCheck('');
    setActiveAction(null);
  };

  return {
    explanation,
    summary,
    referenceCheck,
    isLoading,
    activeAction,
    handleAIExplain,
    handleAISummary,
    handleReferenceCheck,
    clearAIActions
  };
};

