import React from 'react';
import { Upload, Sparkles } from 'lucide-react';
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
    <div className="h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-6 shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-light text-slate-900 mb-3 tracking-tight">Lumi</h1>
          <p className="text-slate-500 text-lg font-light">Upload a PDF to begin</p>
        </div>
        
        <label className="group flex flex-col items-center justify-center w-full h-72 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer bg-white/50 backdrop-blur-sm hover:border-indigo-300 hover:bg-indigo-50/30 transition-all duration-300 shadow-sm hover:shadow-md">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <div className="w-16 h-16 rounded-full bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center mb-5 transition-colors duration-300">
              <Upload className="w-7 h-7 text-slate-400 group-hover:text-indigo-500 transition-colors duration-300" />
            </div>
            <p className="mb-2 text-base text-slate-700 font-medium">
              <span className="text-indigo-600">Click to upload</span> or drag and drop
            </p>
            <p className="text-sm text-slate-400">PDF files only</p>
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
