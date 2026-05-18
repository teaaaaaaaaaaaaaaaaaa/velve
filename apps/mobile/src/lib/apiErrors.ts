export function getApiErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    code?: string;
    message?: string;
    name?: string;
    response?: { status?: number; data?: { error?: string; message?: string } };
  };

  const status = err?.response?.status;
  const serverMessage = err?.response?.data?.error || err?.response?.data?.message;

  if (status === 400 && serverMessage) return serverMessage;
  if (err?.code === 'AUTH_REQUIRED') return 'Sesija je zavrsena. Prijavi se ponovo.';
  if (status === 401) return 'Sesija je istekla. Prijavi se ponovo.';
  if (status === 403) return 'Nemamo dozvolu za ovu akciju.';
  if (status === 404) return 'Ovaj sadrzaj vise nije dostupan.';
  if (status === 408) return 'Serveru treba previse vremena da odgovori. Pokusaj ponovo.';
  if (status === 429) return 'Previse pokusaja u kratkom roku. Sacekaj malo pa probaj ponovo.';
  if (status && status >= 500)
    return 'Server trenutno ne odgovara kako treba. Pokusaj malo kasnije.';
  if (err?.code === 'ECONNABORTED') return 'Veza je prespora. Pokusaj ponovo.';
  if (err?.code === 'ERR_NETWORK' || (!status && err?.message?.includes('Network'))) {
    return 'Nema stabilne internet konekcije.';
  }
  if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
    return fallback;
  }

  return serverMessage || fallback;
}
