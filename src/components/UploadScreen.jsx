import React from 'react';
import { Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function UploadScreen() {
  const navigate = useNavigate();

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      // Convert file to base64 and store in sessionStorage for persistence
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        sessionStorage.setItem('pdfFile', base64);
        sessionStorage.setItem('pdfFileName', file.name);
        
        // Create blob URL for immediate use
        const fileUrl = URL.createObjectURL(file);
        navigate('/reader', { state: { fileUrl, fileName: file.name } });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-2xl w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">PDF Reader with AI</h1>
          <p className="text-gray-600">Upload a PDF to get started</p>
        </div>
        
        <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-16 h-16 mb-4 text-gray-400" />
            <p className="mb-2 text-lg text-gray-700">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-sm text-gray-500">PDF files only</p>
          </div>
          <input
            type="file"
            className="hidden"
            accept="application/pdf"
            onChange={handleFileUpload}
          />
        </label>
      </div>
    </div>
  );
}

