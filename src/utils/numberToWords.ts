// Função para converter números em texto por extenso
export function numberToWords(value: number): string {
  if (value === 0) return 'zero reais';

  const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  function convertGroup(num: number): string {
    if (num === 0) return '';
    if (num === 100) return 'cem';

    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const u = num % 10;

    let result = '';

    if (h > 0) {
      result += hundreds[h];
    }

    if (t === 1) {
      if (result) result += ' e ';
      result += teens[u];
    } else {
      if (t > 0) {
        if (result) result += ' e ';
        result += tens[t];
      }
      if (u > 0) {
        if (result) result += ' e ';
        result += units[u];
      }
    }

    return result;
  }

  const integerPart = Math.floor(value);
  const centsPart = Math.round((value - integerPart) * 100);

  let result = '';

  // Milhões
  const millions = Math.floor(integerPart / 1000000);
  if (millions > 0) {
    if (millions === 1) {
      result += 'um milhão';
    } else {
      result += convertGroup(millions) + ' milhões';
    }
  }

  // Milhares
  const thousands = Math.floor((integerPart % 1000000) / 1000);
  if (thousands > 0) {
    if (result) result += ' ';
    if (thousands === 1) {
      result += 'mil';
    } else {
      result += convertGroup(thousands) + ' mil';
    }
  }

  // Centenas, dezenas e unidades
  const remainder = integerPart % 1000;
  if (remainder > 0) {
    if (result && thousands === 0 && millions > 0) {
      result += ' e ';
    } else if (result) {
      result += ' ';
    }
    result += convertGroup(remainder);
  }

  // Adicionar "reais"
  if (integerPart > 0) {
    if (integerPart === 1) {
      result += ' real';
    } else {
      result += ' reais';
    }
  }

  // Adicionar centavos
  if (centsPart > 0) {
    if (integerPart > 0) {
      result += ' e ';
    }
    result += convertGroup(centsPart);
    if (centsPart === 1) {
      result += ' centavo';
    } else {
      result += ' centavos';
    }
  }

  return result;
}
