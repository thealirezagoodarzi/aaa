import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import { LAB_IMAGES } from '../../assets/images';

interface CompanyLogoProps {
  className?: string;
  iconClassName?: string;
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({ className = "w-11 h-11 rounded-2xl", iconClassName = "w-6 h-6" }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className={`bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white shadow-md shadow-amber-500/25 ${className}`}>
        <Building2 className={iconClassName} />
      </div>
    );
  }

  return (
    <div className={`overflow-hidden flex items-center justify-center bg-slate-950 border border-slate-700/50 shadow-sm shrink-0 ${className}`}>
      <img 
        src={LAB_IMAGES.companyLogo} 
        alt="آزما بتن پایش خاک و پی جهان بین" 
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
      />
    </div>
  );
};
