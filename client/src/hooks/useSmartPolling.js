import { useEffect, useRef, useCallback } from 'react';
import ClientLogger from '../utils/ClientLogger';

const useSmartPolling = ({
  fetchJobs,
  fetchInvoices,
  fetchStats, // NUOVO: Aggiungi il parametro per aggiornare i KPI
  jobs = [],
  enabled = true,
  interval = 3000,
  maxInterval = 10000
}) => {
  const intervalRef = useRef(null);
  const ACTIVE_STATES = ['pending', 'processing'];

  const hasActiveJobs = useCallback(() => {
    const activeJobs = jobs.filter(job => {
      const jobStatus = job.status;
      const hasActiveFiles = job.files?.some(file => ACTIVE_STATES.includes(file.status));
      return ACTIVE_STATES.includes(jobStatus) || hasActiveFiles;
    });
    return activeJobs.length > 0;
  }, [jobs]);

  const poll = useCallback(async () => {
    try {
      ClientLogger.debug('Smart polling: INIZIO CICLO');
      
      // Aggiorna sempre i job
      await fetchJobs();
      
      // Se ci sono job attivi, aggiorna fatture E statistiche
      if (hasActiveJobs()) {
        ClientLogger.debug('Smart polling: AGGIORNAMENTO FATTURE E KPI');
        
        // Aggiorna fatture
        if (fetchInvoices) {
          await fetchInvoices();
        }
        
        // NUOVO: Aggiorna anche i KPI/statistiche
        if (fetchStats) {
          await fetchStats();
        }
      }
      
      ClientLogger.debug('Smart polling: FINE CICLO');
    } catch (error) {
      ClientLogger.error('Errore durante polling', { error });
    }
  }, [fetchJobs, fetchInvoices, fetchStats, hasActiveJobs]);

  const startPolling = useCallback(() => {
    if (intervalRef.current || !enabled) return;
    
    ClientLogger.debug('Smart polling: AVVIO POLLING');
    intervalRef.current = setInterval(poll, interval);
  }, [poll, enabled, interval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      ClientLogger.debug('Smart polling: FERMANDO POLLING');
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled && hasActiveJobs() && !intervalRef.current) {
      startPolling();
    } else if (!hasActiveJobs() && intervalRef.current) {
      stopPolling();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, hasActiveJobs, startPolling, stopPolling]);

  return {
    isPolling: !!intervalRef.current,
    startPolling,
    stopPolling,
    currentInterval: interval
  };
};

export default useSmartPolling;
