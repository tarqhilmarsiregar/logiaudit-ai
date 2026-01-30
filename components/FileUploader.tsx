import React from 'react';
import { ImageFile } from '../types';
import { processFileToBase64 } from '../services/geminiService';

interface FileUploaderProps {
  label: string;
  subLabel: string;
  image: ImageFile | null;
  onImageChange: (image: ImageFile | null) => void;
  id: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({ label, subLabel, image, onImageChange, id }) => {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const base64 = await processFileToBase64(file);
        const previewUrl = URL.createObjectURL(file);
        onImageChange({
          file,
          previewUrl,
          base64,
          mimeType: file.type
        });
      } catch (err) {
        console.error("Error processing file", err);
      }
    }
  };

  const handleRemove = () => {
    if (image) {
      URL.revokeObjectURL(image.previewUrl);
    }
    onImageChange(null);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className={`
        relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors h-64
        ${image ? 'border-indigo-200 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 bg-white hover:bg-slate-50'}
      `}>
        {image ? (
          <div className="relative w-full h-full flex items-center justify-center">
             <img 
               src={image.previewUrl} 
               alt="Preview" 
               className="max-h-full max-w-full object-contain rounded shadow-sm"
             />
             <button 
               onClick={handleRemove}
               className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors"
               type="button"
             >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
               </svg>
             </button>
          </div>
        ) : (
          <>
            <div className="text-indigo-500 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-slate-900">{subLabel}</span>
            <span className="text-xs text-slate-500 mt-1">Supports JPG, PNG</span>
            <input 
              id={id} 
              type="file" 
              accept="image/*" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default FileUploader;
