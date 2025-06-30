'use client';

import { useState } from 'react';
import { RegistrationData, LoginData } from '@bassnotion/contracts';

import { RegistrationForm, LoginForm } from '@/domains/user/components/auth';
import { Button } from '@/shared/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs';

export default function AuthDemoPage() {
  const [registrationResult, setRegistrationResult] = useState<string>('');
  const [loginResult, setLoginResult] = useState<string>('');
  const [isRegistrationLoading, setIsRegistrationLoading] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  const handleRegistration = async (data: RegistrationData) => {
    setIsRegistrationLoading(true);
    setRegistrationResult('');

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setRegistrationResult(
        // TODO: Review non-null assertion - consider null safety
        `✅ Registration successful!\nEmail: ${data.email}\nPassword: ${data.password.substring(0, 3)}***`,
      );
    } catch (error) {
      setRegistrationResult(`❌ Registration failed: ${error}`);
    } finally {
      setIsRegistrationLoading(false);
    }
  };

  const handleLogin = async (data: LoginData) => {
    setIsLoginLoading(true);
    setLoginResult('');

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setLoginResult(
        // TODO: Review non-null assertion - consider null safety
        `✅ Login successful!\nEmail: ${data.email}\nPassword: ${data.password.substring(0, 3)}***`,
      );
    } catch (error) {
      setLoginResult(`❌ Login failed: ${error}`);
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      // Simulate Google OAuth flow
      setRegistrationResult('🚀 Redirecting to Google OAuth...');
      setLoginResult('🚀 Redirecting to Google OAuth...');

      // In a real app, this would redirect to the backend Google OAuth endpoint
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // TODO: Review non-null assertion - consider null safety
      setRegistrationResult('✅ Google OAuth successful! (Demo)');
      // TODO: Review non-null assertion - consider null safety
      setLoginResult('✅ Google OAuth successful! (Demo)');
    } catch (error) {
      setRegistrationResult(`❌ Google OAuth failed: ${error}`);
      setLoginResult(`❌ Google OAuth failed: ${error}`);
    }
  };

  const clearResults = () => {
    setRegistrationResult('');
    setLoginResult('');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">BassNotion Auth Demo</h1>
          <p className="text-muted-foreground mt-2">
            Testing Zod validation with React Hook Form
          </p>
          <Button onClick={clearResults} variant="outline" className="mt-4">
            Clear Results
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Forms Section */}
          <div>
            <Tabs defaultValue="registration" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="registration">Registration</TabsTrigger>
                <TabsTrigger value="login">Login</TabsTrigger>
              </TabsList>

              <TabsContent value="registration" className="mt-6">
                <div className="border rounded-lg p-6">
                  <RegistrationForm
                    onSubmit={handleRegistration}
                    onGoogleSignIn={handleGoogleSignIn}
                    isLoading={isRegistrationLoading}
                  />
                </div>
              </TabsContent>

              <TabsContent value="login" className="mt-6">
                <div className="border rounded-lg p-6">
                  <LoginForm
                    onSubmit={handleLogin}
                    onGoogleSignIn={handleGoogleSignIn}
                    isLoading={isLoginLoading}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {/* Registration Results */}
            <div className="border rounded-lg p-6">
              <h3 className="font-semibold mb-4">Registration Results</h3>
              <div className="bg-muted rounded p-4 min-h-[100px] font-mono text-sm">
                {registrationResult || 'No registration attempts yet...'}
              </div>
            </div>

            {/* Login Results */}
            <div className="border rounded-lg p-6">
              <h3 className="font-semibold mb-4">Login Results</h3>
              <div className="bg-muted rounded p-4 min-h-[100px] font-mono text-sm">
                {loginResult || 'No login attempts yet...'}
              </div>
            </div>

            {/* Validation Info */}
            <div className="border rounded-lg p-6">
              <h3 className="font-semibold mb-4">Validation Rules</h3>
              <div className="text-sm space-y-2">
                <p>
                  <strong>Email:</strong> Valid email format required
                </p>
                <p>
                  <strong>Password:</strong> Min 8 chars, uppercase, lowercase,
                  number, special char
                </p>
                <p>
                  <strong>Confirm Password:</strong> Must match password
                </p>
                <p className="text-muted-foreground">
                  Real-time validation powered by Zod schemas
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
