import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';

const DiagnosticoPage: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [localStorageKeys, setLocalStorageKeys] = useState<string[]>([]);
  const [sessionStorageKeys, setSessionStorageKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [keyValue, setKeyValue] = useState<string>('');
  const [cookieInfo, setCookieInfo] = useState<string>('');

  useEffect(() => {
    // Obter informações da sessão
    const getSessionInfo = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Erro ao obter informações da sessão:', error);
        toast.error('Erro ao obter informações da sessão');
      } else {
        setSessionInfo(data);
      }
    };

    // Obter chaves do localStorage
    const getLocalStorageKeys = () => {
      try {
        const keys = Object.keys(localStorage);
        setLocalStorageKeys(keys);
      } catch (error) {
        console.error('Erro ao obter chaves do localStorage:', error);
      }
    };

    // Obter chaves do sessionStorage
    const getSessionStorageKeys = () => {
      try {
        const keys = Object.keys(sessionStorage);
        setSessionStorageKeys(keys);
      } catch (error) {
        console.error('Erro ao obter chaves do sessionStorage:', error);
      }
    };

    // Obter cookies
    const getCookieInfo = () => {
      setCookieInfo(document.cookie);
    };

    getSessionInfo();
    getLocalStorageKeys();
    getSessionStorageKeys();
    getCookieInfo();
  }, []);

  // Função para visualizar o valor de uma chave
  const viewKeyValue = (key: string, storageType: 'local' | 'session') => {
    try {
      const value = storageType === 'local' 
        ? localStorage.getItem(key) 
        : sessionStorage.getItem(key);
      
      setSelectedKey(key);
      setKeyValue(value || '');
    } catch (error) {
      console.error(`Erro ao obter valor da chave ${key}:`, error);
      toast.error(`Erro ao obter valor da chave ${key}`);
    }
  };

  // Função para limpar uma chave específica
  const clearKey = (key: string, storageType: 'local' | 'session') => {
    try {
      if (storageType === 'local') {
        localStorage.removeItem(key);
        setLocalStorageKeys(Object.keys(localStorage));
      } else {
        sessionStorage.removeItem(key);
        setSessionStorageKeys(Object.keys(sessionStorage));
      }
      toast.success(`Chave ${key} removida com sucesso`);
      setSelectedKey('');
      setKeyValue('');
    } catch (error) {
      console.error(`Erro ao remover chave ${key}:`, error);
      toast.error(`Erro ao remover chave ${key}`);
    }
  };

  // Função para testar a sessão
  const testSession = async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Erro ao obter usuário:', error);
        toast.error(`Erro ao obter usuário: ${error.message}`);
      } else {
        console.log('Usuário atual:', data);
        toast.success(`Usuário recuperado com sucesso: ${data.user?.email || 'Não autenticado'}`);
      }
    } catch (error) {
      console.error('Erro ao testar sessão:', error);
      toast.error(`Erro ao testar sessão: ${error instanceof Error ? error.message : 'Desconhecido'}`);
    }
  };

  // Função para limpar todas as chaves relacionadas ao Supabase
  const clearAllSupabaseKeys = () => {
    try {
      // Limpar localStorage
      const localKeys = Object.keys(localStorage).filter(key => 
        key.includes('supabase') || key.includes('sb-')
      );
      
      localKeys.forEach(key => localStorage.removeItem(key));
      
      // Limpar sessionStorage
      const sessionKeys = Object.keys(sessionStorage).filter(key => 
        key.includes('supabase') || key.includes('sb-')
      );
      
      sessionKeys.forEach(key => sessionStorage.removeItem(key));
      
      // Atualizar listas
      setLocalStorageKeys(Object.keys(localStorage));
      setSessionStorageKeys(Object.keys(sessionStorage));
      
      toast.success(`Removidas ${localKeys.length + sessionKeys.length} chaves relacionadas ao Supabase`);
    } catch (error) {
      console.error('Erro ao limpar chaves do Supabase:', error);
      toast.error(`Erro ao limpar chaves do Supabase: ${error instanceof Error ? error.message : 'Desconhecido'}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Diagnóstico de Autenticação</h1>
      
      {isLoading ? (
        <div className="text-center py-10">
          <div className="spinner"></div>
          <p className="mt-4">Carregando informações...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Informações do usuário */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Status da Autenticação</h2>
            <div className="space-y-2">
              <p><strong>Autenticado:</strong> {isAuthenticated ? 'Sim' : 'Não'}</p>
              <p><strong>ID do usuário:</strong> {user?.id || 'N/A'}</p>
              <p><strong>Nome:</strong> {user?.name || 'N/A'}</p>
              <p><strong>Email:</strong> {user?.email || 'N/A'}</p>
              <p><strong>Matrícula:</strong> {user?.registration || 'N/A'}</p>
              <p><strong>Função:</strong> {user?.role || 'N/A'}</p>
              <p><strong>Status:</strong> {user?.status || 'N/A'}</p>
            </div>
            
            <div className="mt-6">
              <button 
                onClick={testSession}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Testar Sessão
              </button>
              
              <button 
                onClick={clearAllSupabaseKeys}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 ml-4"
              >
                Limpar Tokens
              </button>
            </div>
          </div>
          
          {/* Informações da sessão */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Informações da Sessão</h2>
            {sessionInfo ? (
              <div className="overflow-auto max-h-60">
                <pre className="text-xs bg-gray-100 p-4 rounded">{JSON.stringify(sessionInfo, null, 2)}</pre>
              </div>
            ) : (
              <p>Nenhuma informação de sessão disponível</p>
            )}
          </div>
          
          {/* LocalStorage */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">localStorage ({localStorageKeys.length} chaves)</h2>
            <div className="overflow-auto max-h-60">
              <ul className="space-y-1">
                {localStorageKeys.map(key => (
                  <li key={key} className="flex justify-between items-center">
                    <span 
                      className={`cursor-pointer hover:text-blue-600 ${key.includes('supabase') || key.includes('sb-') ? 'font-bold text-blue-800' : ''}`}
                      onClick={() => viewKeyValue(key, 'local')}
                    >
                      {key}
                    </span>
                    <button 
                      onClick={() => clearKey(key, 'local')}
                      className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
                    >
                      Limpar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* SessionStorage */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">sessionStorage ({sessionStorageKeys.length} chaves)</h2>
            <div className="overflow-auto max-h-60">
              <ul className="space-y-1">
                {sessionStorageKeys.map(key => (
                  <li key={key} className="flex justify-between items-center">
                    <span 
                      className={`cursor-pointer hover:text-blue-600 ${key.includes('supabase') || key.includes('sb-') ? 'font-bold text-blue-800' : ''}`}
                      onClick={() => viewKeyValue(key, 'session')}
                    >
                      {key}
                    </span>
                    <button 
                      onClick={() => clearKey(key, 'session')}
                      className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
                    >
                      Limpar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* Valor da chave selecionada */}
          {selectedKey && (
            <div className="bg-white rounded-lg shadow p-6 md:col-span-2">
              <h2 className="text-xl font-bold mb-4">Valor da Chave: {selectedKey}</h2>
              <div className="overflow-auto max-h-60">
                <pre className="text-xs bg-gray-100 p-4 rounded">{keyValue}</pre>
              </div>
            </div>
          )}
          
          {/* Cookies */}
          <div className="bg-white rounded-lg shadow p-6 md:col-span-2">
            <h2 className="text-xl font-bold mb-4">Cookies</h2>
            <div className="overflow-auto max-h-60">
              <pre className="text-xs bg-gray-100 p-4 rounded">{cookieInfo || 'Nenhum cookie encontrado'}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiagnosticoPage; 