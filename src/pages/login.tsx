import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/toast';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated, resetPassword } = useAuth();
  const [isResetMode, setIsResetMode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || (!isResetMode && !password)) {
      toast.error('Preencha todos os campos');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (isResetMode) {
        await resetPassword(email);
        setIsResetMode(false);
      } else {
        await login(email, password);
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 animate-scale-in">
        {/* Logo and Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">LogiSwap</h1>
          <p className="mt-2 text-muted-foreground">Sistema de Gestão de Trocas e Quebras</p>
        </div>
        
        {/* Login Form */}
        <div className="bg-card p-8 rounded-lg shadow-sm border">
          <h2 className="text-xl font-medium mb-6 text-center">
            {isResetMode ? 'Recuperar Senha' : 'Login'}
          </h2>
          <p className="text-sm text-center text-muted-foreground mb-6">
            {isResetMode 
              ? 'Digite seu email para receber instruções de recuperação de senha' 
              : 'Entre com suas credenciais para acessar o sistema'}
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="Digite seu email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-transition"
              />
            </div>
            
            {!isResetMode && (
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Senha
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-transition"
                />
              </div>
            )}
            
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting 
                ? (isResetMode ? 'Enviando...' : 'Entrando...') 
                : (isResetMode ? 'Enviar Email de Recuperação' : 'Entrar')}
            </Button>
          </form>
          
          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {isResetMode ? (
                <button 
                  type="button" 
                  onClick={() => setIsResetMode(false)}
                  className="text-primary hover:underline"
                >
                  Voltar ao login
                </button>
              ) : (
                <button 
                  type="button" 
                  onClick={() => setIsResetMode(true)}
                  className="text-primary hover:underline"
                >
                  Esqueceu sua senha?
                </button>
              )}
            </p>
            
            <p className="text-sm text-muted-foreground">
              Não possui uma conta?{' '}
              <Link to="/register" className="text-primary hover:underline">
                Registrar
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
