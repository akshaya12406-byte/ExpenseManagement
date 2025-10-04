import { useCallback, useMemo } from 'react';

import SubmitExpense from '../components/SubmitExpense';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';

const SubmitExpensePage = () => {
  const { token } = useAuth();
  const apiBase = useMemo(() => process.env.REACT_APP_API_URL || 'http://localhost:4000/api', []);

  const handleSubmit = useCallback(
    async (payload) => {
      await apiClient.fetchJson(
        `${apiBase}/expenses`,
        {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: JSON.stringify(payload),
        },
        { useCache: false },
      );
    },
    [apiBase, token],
  );

  return (
    <SubmitExpense
      onSubmit={handleSubmit}
      baseCurrency="USD"
      categories={[
        'Travel',
        'Meals',
        'Accommodation',
        'Office Supplies',
        'Training',
        'Entertainment',
        'Health & Wellness',
        'Other',
      ]}
    />
  );
};

export default SubmitExpensePage;
