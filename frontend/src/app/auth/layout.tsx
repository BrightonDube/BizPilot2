/**
 * Auth layout with dark theme styling.
 */

import { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            Biz<span className="text-blue-500">Pilot</span>
          </h1>
          <p className="text-gray-400 mt-2">Modern Multi-Business Management</p>
        </div>
        
        {/* Auth Card */}
        <div className="bg-gray-800 rounded-xl shadow-xl p-8 border border-gray-700">
          {children}
        </div>
        
        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-8">
          &copy; {new Date().getFullYear()} BizPilot. All rights reserved.
        </p>
      </div>
    </div>
  );
}
