"use client";

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

export default function UserAccountManager() {
  const { user, profile, signOut, updateProfile } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    display_name: profile?.display_name || '',
    avatar_url: profile?.avatar_url || '',
  });

  const handleLogout = async () => {
    setLoading(true);
    try {
      const { error } = await signOut();
      if (error) {
        toast({
          title: "Logout Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Logout Successful",
          description: "You have been logged out successfully",
        });
      }
    } catch {
      toast({
        title: "Logout Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const { error } = await updateProfile(formData);
      if (error) {
        toast({
          title: "Profile Update Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Profile Updated",
          description: "Your profile has been updated successfully",
        });
        setIsEditing(false);
      }
    } catch {
      toast({
        title: "Profile Update Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      display_name: profile?.display_name || '',
      avatar_url: profile?.avatar_url || '',
    });
    setIsEditing(false);
  };

  if (!user) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>User Account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Please log in to continue</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>User Account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Email Address</Label>
          <div className="text-sm text-muted-foreground">{user.email}</div>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                placeholder="Enter your display name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="avatar_url">Avatar URL</Label>
              <Input
                id="avatar_url"
                value={formData.avatar_url}
                onChange={(e) => setFormData(prev => ({ ...prev, avatar_url: e.target.value }))}
                placeholder="Enter avatar URL"
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleSaveProfile} 
                disabled={loading}
                size="sm"
              >
                {loading ? "Saving..." : "Save"}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleCancel}
                disabled={loading}
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {profile?.display_name && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Display Name</Label>
                <div className="text-sm text-muted-foreground">{profile.display_name}</div>
              </div>
            )}
            
            {profile?.avatar_url && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Avatar</Label>
                <div className="flex items-center gap-2">
                  <Image 
                    src={profile.avatar_url} 
                    alt="Avatar" 
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full"
                    onError={() => {
                      // エラー時の処理はNext.js Imageコンポーネントで自動的に処理される
                    }}
                  />
                  <div className="text-sm text-muted-foreground truncate">{profile.avatar_url}</div>
                </div>
              </div>
            )}

            <Button 
              onClick={() => setIsEditing(true)}
              variant="outline"
              size="sm"
            >
              Edit Profile
            </Button>
          </div>
        )}

        <Separator />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={loading}>
              Logout
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to logout?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleLogout}>
                Logout
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
