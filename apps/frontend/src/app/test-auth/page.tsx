'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/infrastructure/supabase/client';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';

export default function TestAuthPage() {
  const [session, setSession] = useState<any>(null);
  const [profileResponse, setProfileResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) {
      setError(`Session error: ${error.message}`);
    } else {
      setSession(session);
    }
  };

  const testProfileEndpoint = async () => {
    setIsLoading(true);
    setError(null);
    setProfileResponse(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError('No session token available');
        setIsLoading(false);
        return;
      }

      console.log('Testing with token:', session.access_token);

      const response = await fetch('http://localhost:3000/api/user/profile', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: 'include',
      });

      const data = await response.json();

      setProfileResponse({
        status: response.status,
        statusText: response.statusText,
        data: data,
        headers: {
          contentType: response.headers.get('content-type'),
        },
      });

      if (!response.ok) {
        setError(
          `Profile request failed: ${response.status} ${response.statusText}`,
        );
      }
    } catch (err) {
      setError(
        `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const testBackendAuth = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError('No session token available');
        setIsLoading(false);
        return;
      }

      // Test if backend can validate the token
      const response = await fetch('http://localhost:3000/api/health', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      console.log('Health check response:', data);
      setProfileResponse({
        status: response.status,
        data: data,
        test: 'health-check',
      });
    } catch (err) {
      setError(
        `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loginTestUser = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test@example.com', // Replace with your test user
        password: 'password123', // Replace with your test password
      });

      if (error) {
        setError(`Login error: ${error.message}`);
      } else {
        setSession(data.session);
        console.log('Login successful:', data);
      }
    } catch (err) {
      setError(
        `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError(`Sign out error: ${error.message}`);
    } else {
      setSession(null);
      setProfileResponse(null);
    }
  };

  return (
    <>
      <div className="container mx-auto p-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Auth Debug Page</h1>

        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Current Session</h2>
          {session ? (
            <div className="space-y-2 text-sm">
              <p>
                <strong>User ID:</strong> {session.user?.id}
              </p>
              <p>
                <strong>Email:</strong> {session.user?.email}
              </p>
              <p>
                <strong>Provider:</strong>{' '}
                {session.user?.app_metadata?.provider}
              </p>
              <p>
                <strong>Token (first 20 chars):</strong>{' '}
                {session.access_token?.substring(0, 20)}...
              </p>
              <p>
                <strong>Expires at:</strong>{' '}
                {new Date(session.expires_at * 1000).toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-gray-500">No active session</p>
          )}
        </Card>

        <div className="flex flex-wrap gap-4 mb-6">
          <Button onClick={checkSession} disabled={isLoading}>
            Refresh Session
          </Button>
          <Button onClick={loginTestUser} disabled={isLoading}>
            Login Test User
          </Button>
          <Button
            onClick={testProfileEndpoint}
            disabled={isLoading || !session}
          >
            Test Profile Endpoint
          </Button>
          <Button onClick={testBackendAuth} disabled={isLoading || !session}>
            Test Health Check
          </Button>
          <Button
            onClick={signOut}
            disabled={isLoading || !session}
            variant="destructive"
          >
            Sign Out
          </Button>
        </div>

        {error && (
          <Card className="p-4 mb-6 border-red-500 bg-red-50">
            <p className="text-red-600">{error}</p>
          </Card>
        )}

        {profileResponse && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Backend Response</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
              {JSON.stringify(profileResponse, null, 2)}
            </pre>
          </Card>
        )}
      </div>
    </>
  );
}
