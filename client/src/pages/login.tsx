import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import loginErrorSound from "@assets/login-error_1771588547644.mp3";
import loginSuccessSound from "@assets/ElevenLabs_2026_02_20T12_28_13_Gojo_Calm,_Clear_and_Measured_p_1771590685418.mp3";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: any) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const turnstileWidgetId = useRef<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const errorAudioRef = useRef<HTMLAudioElement | null>(null);
  const successAudioRef = useRef<HTMLAudioElement | null>(null);

  function playErrorSound() {
    try {
      if (!errorAudioRef.current) {
        errorAudioRef.current = new Audio(loginErrorSound);
      }
      errorAudioRef.current.currentTime = 0;
      errorAudioRef.current.play().catch(() => {});
    } catch {}
  }

  function playSuccessSound() {
    try {
      if (!successAudioRef.current) {
        successAudioRef.current = new Audio(loginSuccessSound);
      }
      successAudioRef.current.currentTime = 0;
      successAudioRef.current.play().catch(() => {});
    } catch {}
  }

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    if (document.getElementById("turnstile-script")) {
      if (window.turnstile) setTurnstileReady(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "turnstile-script";
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad";
    script.async = true;
    window.onTurnstileLoad = () => setTurnstileReady(true);
    document.head.appendChild(script);
    return () => {
      delete window.onTurnstileLoad;
    };
  }, []);

  const renderTurnstile = useCallback(() => {
    if (!window.turnstile || !turnstileContainerRef.current || !TURNSTILE_SITE_KEY) return;
    if (turnstileWidgetId.current) {
      window.turnstile.remove(turnstileWidgetId.current);
    }
    turnstileContainerRef.current.innerHTML = "";
    setTurnstileToken(null);
    turnstileWidgetId.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "dark",
      callback: (token: string) => {
        setTurnstileToken(token);
      },
      "error-callback": () => setTurnstileToken(null),
      "expired-callback": () => setTurnstileToken(null),
    });
  }, []);

  useEffect(() => {
    if (showVerification && turnstileReady) {
      const timer = setTimeout(renderTurnstile, 100);
      return () => clearTimeout(timer);
    }
  }, [showVerification, turnstileReady, renderTurnstile]);

  useEffect(() => {
    if (showVerification && turnstileToken) {
      handleSubmit();
    }
  }, [turnstileToken, showVerification]);

  function handleLoginClick(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    if (!TURNSTILE_SITE_KEY) {
      handleSubmit();
      return;
    }
    setShowVerification(true);
  }

  async function handleSubmit() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/local/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: username.trim(),
          password,
          turnstileToken: turnstileToken || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        playErrorSound();
        toast({ title: "Login failed", description: data.message, variant: "destructive" });
        setShowVerification(false);
        setTurnstileToken(null);
        return;
      }
      playSuccessSound();
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await new Promise((r) => setTimeout(r, 500));
      setLocation("/dashboard");
    } catch {
      playErrorSound();
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
      setShowVerification(false);
      setTurnstileToken(null);
    } finally {
      setIsLoading(false);
    }
  }

  if (showVerification) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
        <div className="flex flex-col items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-4xl font-bold tracking-tight italic text-white" data-testid="text-brand-verify">KeyAuth Manager</span>
          </div>

          <h2 className="text-xl font-semibold text-white text-center">
            Please wait while we validate your connection.
          </h2>

          <div ref={turnstileContainerRef} data-testid="turnstile-widget" />

          <Button
            variant="outline"
            className="w-64 border-gray-700 bg-gray-900 text-white hover:bg-gray-800"
            onClick={() => { setShowVerification(false); setTurnstileToken(null); }}
            data-testid="button-back-login"
          >
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.08),_transparent_70%)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
              <Shield className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold tracking-tight italic" data-testid="text-brand">KeyAuth Manager</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <button
              onClick={() => setLocation("/register")}
              className="font-medium text-primary hover:underline"
              data-testid="link-register"
            >
              Sign up
            </button>
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleLoginClick} className="space-y-4">
            <Input
              data-testid="input-username"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />

            <Input
              data-testid="input-password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !username.trim() || !password}
              data-testid="button-submit-login"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By signing in, you agree to our{" "}
            <span className="underline cursor-pointer">Terms of Service</span>
            {" "}and{" "}
            <span className="underline cursor-pointer">Privacy Policy</span>
          </p>
        </Card>
      </div>
    </div>
  );
}
