/**
 * Script para criar um usuário administrador inicial no Supabase
 * 
 * Para executar:
 * 1. Copie o arquivo .env.example para .env e preencha as variáveis
 * 2. Adicione as seguintes variáveis ao .env:
 *    SUPABASE_SERVICE_KEY=sua_chave_service_role
 *    ADMIN_EMAIL=email_do_admin
 *    ADMIN_PASSWORD=senha_do_admin
 *    ADMIN_NAME=nome_do_admin
 *    ADMIN_REGISTRATION=matricula_do_admin (8 dígitos)
 * 3. Execute: node scripts/create-admin.js
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const {
  VITE_SUPABASE_URL: supabaseUrl,
  SUPABASE_SERVICE_KEY: supabaseServiceKey,
  ADMIN_EMAIL: adminEmail,
  ADMIN_PASSWORD: adminPassword,
  ADMIN_NAME: adminName,
  ADMIN_REGISTRATION: adminRegistration,
} = process.env;

// Verificar se todas as variáveis de ambiente necessárias estão definidas
if (!supabaseUrl || !supabaseServiceKey || !adminEmail || !adminPassword || !adminName || !adminRegistration) {
  console.error('Todas as variáveis de ambiente necessárias devem ser definidas');
  process.exit(1);
}

// Verificar formato da matrícula
if (adminRegistration.length !== 8 || !/^\d+$/.test(adminRegistration)) {
  console.error('A matrícula do administrador deve conter 8 dígitos numéricos');
  process.exit(1);
}

// Criar cliente Supabase com a chave de serviço para ter acesso administrativo
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdminUser() {
  try {
    console.log('Criando usuário administrador...');
    
    // Verificar se já existe um usuário com essa matrícula
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('registration', adminRegistration);
      
    if (checkError) {
      throw new Error(`Erro ao verificar usuários existentes: ${checkError.message}`);
    }
    
    if (existingUsers && existingUsers.length > 0) {
      console.log(`Já existe um usuário com a matrícula ${adminRegistration}`);
      process.exit(0);
    }
    
    // Criar o usuário no Auth do Supabase
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true, // Confirmar o email automaticamente
    });
    
    if (authError) {
      throw new Error(`Erro ao criar usuário no Auth: ${authError.message}`);
    }
    
    if (!authData.user) {
      throw new Error('Falha ao criar usuário: nenhum usuário retornado');
    }
    
    console.log(`Usuário criado com ID: ${authData.user.id}`);
    
    // Inserir dados do usuário na tabela users
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        name: adminName,
        registration: adminRegistration,
        role: 'admin',
        status: 'active'
      });
      
    if (insertError) {
      throw new Error(`Erro ao inserir dados do usuário: ${insertError.message}`);
    }
    
    console.log('Usuário administrador criado com sucesso!');
    console.log(`Email: ${adminEmail}`);
    console.log(`Matrícula: ${adminRegistration}`);
    console.log(`Nome: ${adminName}`);
    console.log(`Função: admin`);
    
  } catch (error) {
    console.error('Erro:', error.message);
    process.exit(1);
  }
}

createAdminUser(); 