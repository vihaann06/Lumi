/**
 * Highlight-related utility functions
 */

/**
 * Check if two rectangles overlap or are very close (within threshold)
 */
const doRectsOverlap = (rect1, rect2, threshold = 2) => {
  // Check for actual overlap
  const overlaps = !(
    rect1.x + rect1.width < rect2.x ||
    rect2.x + rect2.width < rect1.x ||
    rect1.y + rect1.height < rect2.y ||
    rect2.y + rect2.height < rect1.y
  );
  
  if (overlaps) return true;
  
  // Check if rectangles are very close horizontally (adjacent on same line)
  const sameLine = Math.abs(rect1.y - rect2.y) < 5;
  if (sameLine) {
    const leftRect = rect1.x < rect2.x ? rect1 : rect2;
    const rightRect = rect1.x < rect2.x ? rect2 : rect1;
    const horizontalGap = rightRect.x - (leftRect.x + leftRect.width);
    if (horizontalGap >= 0 && horizontalGap <= threshold) {
      return true;
    }
  }
  
  // Check if rectangles are very close vertically (adjacent in same column)
  const sameColumn = Math.abs(rect1.x - rect2.x) < 5;
  if (sameColumn) {
    const topRect = rect1.y < rect2.y ? rect1 : rect2;
    const bottomRect = rect1.y < rect2.y ? rect2 : rect1;
    const verticalGap = bottomRect.y - (topRect.y + topRect.height);
    if (verticalGap >= 0 && verticalGap <= threshold) {
      return true;
    }
  }
  
  return false;
};

/**
 * Merge two overlapping rectangles into a single bounding rectangle
 */
const mergeTwoRects = (rect1, rect2) => {
  const minX = Math.min(rect1.x, rect2.x);
  const minY = Math.min(rect1.y, rect2.y);
  const maxX = Math.max(rect1.x + rect1.width, rect2.x + rect2.width);
  const maxY = Math.max(rect1.y + rect1.height, rect2.y + rect2.height);
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
};

/**
 * Merge overlapping rectangles within a highlight into a single rectangle
 * @param {Array} rects - Array of rectangle objects with x, y, width, height
 * @returns {Array} - Array of merged rectangles
 */
export const mergeOverlappingRects = (rects) => {
  if (rects.length <= 1) return rects;
  
  let merged = rects.map(r => ({ ...r })); // Deep copy
  let changed = true;
  let iterations = 0;
  const maxIterations = 10; // Safety limit
  
  // Keep merging until no more overlaps are found
  while (changed && iterations < maxIterations) {
    iterations++;
    changed = false;
    const newMerged = [];
    const processed = new Set();
    
    for (let i = 0; i < merged.length; i++) {
      if (processed.has(i)) continue;
      
      let current = { ...merged[i] };
      
      // Check for overlaps with all other rectangles
      for (let j = 0; j < merged.length; j++) {
        if (i === j || processed.has(j)) continue;
        
        if (doRectsOverlap(current, merged[j])) {
          current = mergeTwoRects(current, merged[j]);
          processed.add(j);
          changed = true;
        }
      }
      
      newMerged.push(current);
      processed.add(i);
    }
    
    merged = newMerged;
  }
  
  return merged;
};

/**
 * Merge adjacent or overlapping rectangles
 */
const mergeRects = (rects) => {
  if (rects.length <= 1) return rects;
  
  // Sort by y position, then by x
  const sorted = [...rects].sort((a, b) => {
    if (Math.abs(a.y - b.y) < 5) { // Same line (within 5px)
      return a.x - b.x;
    }
    return a.y - b.y;
  });
  
  const merged = [];
  let current = { ...sorted[0] };
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const sameLine = Math.abs(current.y - next.y) < 5; // Same line
    const adjacent = sameLine && (next.x - (current.x + current.width)) < 5; // Adjacent horizontally
    
    if (sameLine && adjacent) {
      // Merge horizontally
      current.width = (next.x + next.width) - current.x;
    } else if (sameLine && next.x < current.x + current.width) {
      // Overlapping on same line
      current.width = Math.max(current.x + current.width, next.x + next.width) - current.x;
    } else {
      // New rectangle
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  
  return merged;
};

/**
 * Filter out very small rectangles (likely noise)
 */
const filterSmallRects = (rects, minArea = 10) => {
  return rects.filter(rect => (rect.width * rect.height) >= minArea);
};

/**
 * Calculate highlight rectangles relative to page
 */
export const calculateHighlightRects = (clientRects, pageRect) => {
  const rects = Array.from(clientRects).map(rect => ({
    x: rect.left - pageRect.left,
    y: rect.top - pageRect.top,
    width: rect.width,
    height: rect.height
  }));
  
  // Filter out very small rectangles
  const filtered = filterSmallRects(rects);
  
  // If we have many rectangles, try to merge them
  if (filtered.length > 10) {
    return mergeRects(filtered);
  }
  
  return filtered;
};

/**
 * Find which page a selection belongs to
 */
export const findPageForSelection = (clientRects, pages, currentPageInView) => {
  if (!pages || clientRects.length === 0) {
    return { pageElement: null, pageNum: currentPageInView };
  }

  const firstRect = clientRects[0];
  
  for (const page of pages) {
    const pageRect = page.getBoundingClientRect();
    const selectionCenterY = firstRect.top + firstRect.height / 2;
    if (selectionCenterY >= pageRect.top && selectionCenterY <= pageRect.bottom) {
      return {
        pageElement: page,
        pageNum: parseInt(page.dataset.pageNumber)
      };
    }
  }
  
  return { pageElement: null, pageNum: currentPageInView };
};

/**
 * Create a new highlight object
 */
export const createHighlight = (text, highlightRects, aiType = null, aiContent = null) => {
  const highlightId = Date.now();
  
  // Initialize chat history with the initial AI response only for explanations (not summaries)
  const chatHistory = (aiType === 'explanation' && aiContent) ? [
    {
      role: 'assistant',
      content: aiContent,
      timestamp: highlightId
    }
  ] : [];
  
  return {
    id: highlightId,
    text,
    timestamp: highlightId,
    rects: highlightRects,
    aiType, // 'explanation' or 'summary'
    aiContent, // The AI-generated content (kept for backward compatibility)
    chatHistory // Array of { role: 'user' | 'assistant', content: string, timestamp: number }
  };
};

/**
 * Truncate text to show first 20 words and last 3 words if longer than 23 words
 * @param {string} text - The text to truncate
 * @returns {string} - Truncated text with ellipsis if needed
 */
export const truncateTextForDisplay = (text) => {
  if (!text) return '';
  
  const words = text.trim().split(/\s+/);
  
  if (words.length <= 23) {
    return text;
  }
  
  const firstWords = words.slice(0, 20).join(' ');
  const lastWords = words.slice(-3).join(' ');
  
  return `${firstWords} ... ${lastWords}`;
};

