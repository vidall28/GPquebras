// Opções pré-definidas para os motivos de trocas e quebras com códigos numéricos
export interface ReasonOption {
  code: string;   // Código numérico do motivo
  label: string;  // Descrição do motivo
}

export const allReasons: ReasonOption[] = [
  { code: '2', label: 'RDPA-ALT. NA COR' },
  { code: '3', label: 'RDPA-ALT. NO ODOR' },
  { code: '14', label: 'RDPA-VAZIA' },
  { code: '15', label: 'RDPA-EMB. AMASSADA' },
  { code: '16', label: 'RDPA-EMB. ESTUFADA' },
  { code: '17', label: 'RDPA-EMB MICRO FURO' },
  { code: '18', label: 'RDPA-EMB. QUEBRADA' },
  { code: '19', label: 'RDPA-EMB. RASGADA' },
  { code: '20', label: 'RDPA-EMB. MAL CHEIA' },
  { code: '21', label: 'RDPA-LACRE' },
  { code: '22', label: 'RDPA-ROLHA (TAMPA)' },
  { code: '23', label: 'RDPA-RÓTULO/ESTANHOL' },
  { code: '24', label: 'RDPA-SELO PROTEÇÃO' },
  { code: '25', label: 'RDPA-SUJIDADE EXT.' },
  { code: '34', label: 'CONSUMO' },
  { code: '26', label: 'PROD VENCIDO' },
  { code: '27', label: 'CARGA/DESCARGA PDV' },
  { code: '28', label: 'CARGA/DESCARGA PDV' },
  { code: '29', label: 'ACIDENTE NO PATIO' },
];

// Dividir motivos por tipo (quebra/troca)
// Por padrão, todos são considerados válidos para ambos os tipos
// Você pode personalizar quais motivos são válidos para cada tipo conforme necessário
export const exchangeReasons: ReasonOption[] = allReasons;
export const breakageReasons: ReasonOption[] = allReasons;

// Função para obter os motivos com base no tipo de registro
export const getReasonsByType = (type: 'exchange' | 'breakage'): ReasonOption[] => {
  return type === 'exchange' ? exchangeReasons : breakageReasons;
};
