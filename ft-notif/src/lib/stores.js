import { writable } from 'svelte/store';

export const user  = writable(null);
export const toast = writable(null);

export function showToast(message, type = 'success') {
  toast.set({ message, type });
  setTimeout(() => toast.set(null), 3500);
}

export function fmt(n, symbol = 'RM') {
  return symbol + ' ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function today() {
  return new Date().toISOString().split('T')[0];
}

export const CATEGORIES = [
  'Food','Fuel','Groceries','Shopping','Vacation',
  'Bills','Transport','Health','Education','Entertainment','Other'
];

export const BANKS_LIST = [
  'Maybank','MAE','GX','CIMB','Public Bank','RHB','OCBC',
  'Affin','Alliance Bank','AmBank','Bank Muamalat','HSBC',
  'Standard Chartered','UOB','Citibank','ICBC','Other'
];
