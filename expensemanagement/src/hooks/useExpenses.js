import { useEffect, useState } from 'react';

import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';

const useExpenses = () => {
  const { token } = useAuth();
  const [state, setState] = useState({ data: [], isLoading: true, error: null });

  useEffect(() => {
    if (!token) {
      return () => {};
    }

    let active = true;
    const controller = new AbortController();

    const fetchExpenses = async () => {
      setState({ data: [], isLoading: true, error: null });
      try {
        const payload = await apiClient.fetchJson(
          `${process.env.REACT_APP_API_URL || 'http://localhost:4000/api'}/expenses`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            signal: controller.signal,
          },
          { useCache: false },
        );

        if (!active) return;
        setState({ data: payload?.expenses || [], isLoading: false, error: null });
      } catch (error) {
        if (!active) return;
        setState({ data: [], isLoading: false, error });
      }
    };

    fetchExpenses();

    return () => {
      active = false;
      controller.abort();
    };
  }, [token]);

  return state;
};

export default useExpenses;
