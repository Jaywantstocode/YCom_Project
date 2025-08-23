"use client";

import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AuthModal } from './AuthModal';
import { useState } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="ml-2">Checking authentication status...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-center">Sign in required</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-gray-600">
                You must be signed in to use this feature.
              </p>
              <Button onClick={() => setShowAuthModal(true)}>
                Sign in
              </Button>
            </CardContent>
          </Card>
        </div>
        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)} 
        />
      </>
    );
  }

  return <>{children}</>;
}
