import { useEffect, useRef, useCallback } from 'react';
import ClientLogger from '../utils/ClientLogger';

// Aggiungi questi parametri all'hook
const useSmartPolling = ({
  fetchJobs,
  fetchInvoices,
  fetchStats, // NUOVO: Aggiungi il parametro per aggiornare i KPI
  jobs = [],
  enabled = true,
  interval = 3000,
  maxInterval = 10000,
  // Nuovi parametri
  temporaryPollingEnabled = false,
  temporaryPollingInterval = 1000,
  temporaryPollingDuration = 10000
}) => {
  const intervalRef = useRef(null);
  const temporaryIntervalRef = useRef(null);
  // Rimuovi questa riga che causa il conflitto
  // const ACTIVE_STATES = ['pending', 'processing'];

  const hasActiveJobs = useCallback(() => {
    // Questa definizione è corretta e include 'uploaded'
    const ACTIVE_STATES = ['uploaded', 'pending', 'processing'];
    const activeJobs = jobs.filter(job => {
      const jobStatus = job.status;
      const hasActiveFiles = job.files?.some(file => ACTIVE_STATES.includes(file.status));
      return ACTIVE_STATES.includes(jobStatus) || hasActiveFiles;
    });
    return activeJobs.length > 0;
  }, [jobs]);

  // Aggiungi queste variabili per il debounce
  const lastPollTimeRef = useRef(0);
  const MIN_POLL_INTERVAL = 2000; // Minimo 2 secondi tra le richieste

  const poll = useCallback(async () => {
    try {
      // Implementa un semplice meccanismo di debounce
      const now = Date.now();
      if (now - lastPollTimeRef.current < MIN_POLL_INTERVAL) {
        ClientLogger.debug('Smart polling: Richiesta troppo frequente, saltata');
        return;
      }
      
      lastPollTimeRef.current = now;
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

  // Aggiungi questa nuova funzione
  const startTemporaryPolling = useCallback(() => {
    // Ferma il polling temporaneo esistente se presente
    if (temporaryIntervalRef.current) {
      clearInterval(temporaryIntervalRef.current);
      temporaryIntervalRef.current = null;
    }
    
    // Ferma anche il polling normale se è attivo
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Avvia un nuovo polling temporaneo
    ClientLogger.debug('Smart polling: AVVIO POLLING TEMPORANEO');
    temporaryIntervalRef.current = setInterval(poll, temporaryPollingInterval);
    
    // Imposta un timeout per fermare il polling temporaneo
    setTimeout(() => {
      if (temporaryIntervalRef.current) {
        ClientLogger.debug('Smart polling: FINE POLLING TEMPORANEO');
        clearInterval(temporaryIntervalRef.current);
        temporaryIntervalRef.current = null;
        
        // Riavvia il polling normale se ci sono job attivi
        if (enabled && hasActiveJobs() && !intervalRef.current) {
          startPolling();
        }
      }
    }, temporaryPollingDuration);
  }, [poll, temporaryPollingInterval, temporaryPollingDuration, enabled, hasActiveJobs, startPolling]);
  
  // Aggiungi questo effect per gestire il polling temporaneo
  useEffect(() => {
    if (temporaryPollingEnabled) {
      startTemporaryPolling();
    }
    
    return () => {
      if (temporaryIntervalRef.current) {
        clearInterval(temporaryIntervalRef.current);
        temporaryIntervalRef.current = null;
      }
    };
  }, [temporaryPollingEnabled, startTemporaryPolling]);
  
  // Aggiorna il return per includere la nuova funzione
  return {
    isPolling: !!intervalRef.current || !!temporaryIntervalRef.current,
    startPolling,
    stopPolling,
    startTemporaryPolling,
    currentInterval: temporaryIntervalRef.current ? temporaryPollingInterval : interval
  };
};

export default useSmartPolling;
