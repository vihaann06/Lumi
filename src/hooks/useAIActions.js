import { useState } from 'react';
import { getAIExplanation, getAISummary, getReferenceCheck } from '../services/openaiService';

/**
 * Custom hook for AI actions (explanation, summary, reference check)
 */
export const useAIActions = () => {
  const [explanation, setExplanation] = useState('');
  const [summary, setSummary] = useState('');
  const [referenceCheck, setReferenceCheck] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState(null);

  const handleAIExplain = async (selectedText) => {
    if (!selectedText) return;
    
    setIsLoading(true);
    setActiveAction('explain');
    setSummary('');
    setReferenceCheck('');
    
    try {
      const result = await getAIExplanation(selectedText);
      setExplanation(result);
    } catch (error) {
      setExplanation('Sorry, there was an error getting the explanation. Please try again.');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
      window.getSelection().removeAllRanges();
    }
  };

  const handleAISummary = async (selectedText) => {
    if (!selectedText) return;
    
    setIsLoading(true);
    setActiveAction('summary');
    setExplanation('');
    setReferenceCheck('');
    
    try {
      const result = await getAISummary(selectedText);
      setSummary(result);
    } catch (error) {
      setSummary('Sorry, there was an error getting the summary. Please try again.');
      console.error('Error:', error);
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

