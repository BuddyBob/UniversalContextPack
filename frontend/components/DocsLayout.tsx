'use client';

import { ReactNode } from 'react';

interface DocsLayoutProps {
    children: ReactNode;
}

export default function DocsLayout({ children }: DocsLayoutProps) {
    return (
        <div className="min-h-screen bg-white">
            <style jsx global>{`
        /* Override dark theme for docs pages */
        article {
          background-color: white !important;
          color: #1f2937 !important;
        }
        
        article h1, article h2, article h3, article h4 {
          color: #111827 !important;
        }
        
        article p, article li {
          color: #374151 !important;
        }
        
        article .text-secondary {
          color: #4b5563 !important;
        }
        
        article .text-muted {
          color: #6b7280 !important;
        }
        
        article .text-primary {
          color: #111827 !important;
        }
        
        /* Card styling for white theme */
        article .bg-card {
          background-color: #f9fafb !important;
          border-color: #e5e7eb !important;
        }
        
        article .bg-card:hover {
          background-color: #f3f4f6 !important;
          border-color: rgba(102, 57, 208, 0.3) !important;
        }
        
        /* Links */
        article .text-accent-primary {
          color: #6639d0 !important;
        }
        
        article .text-accent-primary:hover {
          color: #5528b8 !important;
        }
        
        /* Green/Red checkmarks */
        article .text-green-400 {
          color: #059669 !important;
        }
        
        article .text-red-400 {
          color: #dc2626 !important;
        }
        
        /* List styling */
        article ol, article ul {
          color: #374151 !important;
        }
      `}</style>
            {children}
        </div>
    );
}
