'use client';

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  options: SelectOption[];
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  dropdownClassName?: string;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "请选择",
  disabled = false,
  className = "",
  dropdownClassName = ""
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const selectedOption = value ? options.find(opt => opt.value === value) : null;
  
  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-custom-select]')) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} data-custom-select>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-2">
          {selectedOption ? (
            <>
              {selectedOption.icon}
              <span>{selectedOption.label}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className={`absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto ${dropdownClassName}`}>
          {options.map((option, index) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value === '' ? null : option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 ${
                index < options.length - 1 ? 'border-b border-border' : ''
              } ${selectedOption?.value === option.value ? 'bg-muted text-muted-foreground' : ''}`}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
