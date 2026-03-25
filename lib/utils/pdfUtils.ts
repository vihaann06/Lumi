/**
 * PDF-related utility functions
 */

/**
 * Get PDF file URL from route state or sessionStorage
 */
export const getFileUrl = (location: { state?: { fileUrl?: string } }) => {
  if (location.state?.fileUrl) {
    return location.state.fileUrl;
  }
  
  // Try to restore from sessionStorage
  const base64 = sessionStorage.getItem('pdfFile');
  if (base64) {
    // Convert base64 back to blob URL
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
};

