import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/toast';
import { setupDebugProcedure, debugSupabaseSchema } from '@/lib/debug';

const Register: React.FC = () => {
  const [registration, setRegistration] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const { register, isAuthenticated } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!registration || !name || !email || !password || !confirmPassword) {
      toast.error('Preencha todos os campos');
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    
    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Formato de email inválido');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await register(registration, name, email, password, confirmPassword);
    } catch (error) {
      console.error('Registration error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Função para executar diagnóstico da estrutura da tabela users
  const runDiagnostic = async () => {
    try {
      // Configurar a stored procedure necessária para diagnóstico
      await setupDebugProcedure();
      
      // Executar o diagnóstico da estrutura do banco de dados
      const diagnosticResult = await debugSupabaseSchema();
      
      // Exibir os resultados no console
      console.log("Diagnóstico do Supabase:", diagnosticResult);
      
      toast.success("Diagnóstico concluído! Verifique o console para detalhes.");
      
      // Ativar modo de depuração
      setDebugMode(true);
    } catch (error) {
      console.error("Erro ao executar diagnóstico:", error);
      toast.error("Falha ao executar diagnóstico");
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
        
        {/* Registration Form */}
        <div className="bg-card p-8 rounded-lg shadow-sm border">
          <h2 className="text-xl font-medium mb-6 text-center">Cadastro</h2>
          <p className="text-sm text-center text-muted-foreground mb-6">
            Crie uma conta para acessar o sistema
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="registration" className="text-sm font-medium">
                Matrícula
              </label>
              <Input
                id="registration"
                type="text"
                placeholder="Digite sua matrícula (formato: 00000000)"
                value={registration}
                onChange={(e) => setRegistration(e.target.value)}
                required
                pattern="\d{8}"
                title="A matrícula deve conter 8 dígitos"
                className="input-transition"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Nome Completo
              </label>
              <Input
                id="name"
                type="text"
                placeholder="Digite seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="input-transition"
              />
            </div>
            
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
              {debugMode && (
                <p className="text-xs text-amber-500 mt-1">
                  Email para diagnóstico: {email}
                </p>
              )}
            </div>
            
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
            
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirmar Senha
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirme sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="input-transition"
              />
            </div>
            
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Registrando...' : 'Registrar'}
            </Button>
            
            {/* Botão para executar diagnóstico - visível apenas para desenvolvimento */}
            <div className="text-center mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={runDiagnostic}
                className="text-xs"
              >
                Executar Diagnóstico
              </Button>
            </div>
          </form>
          
          <div className="mt-6 text-center text-sm">
            <p className="text-muted-foreground">
              Já possui uma conta?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Faça login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
