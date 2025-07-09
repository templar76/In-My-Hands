import React, { useState, useEffect,useCallback } from 'react';
import { 
  Box, 
  Typography, 
  FormControlLabel, 
  Switch, 
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { ExpandMore, Settings as SettingsIcon, Security } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { auth } from '../firebase';
import { getApiUrl } from '../utils/apiConfig';
import ClientLogger from '../utils/ClientLogger';

const API_URL = getApiUrl();

const Settings = ({ mode, setMode }) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { role } = useSelector(state => state.auth);
  const isAdmin = role === 'admin';
  

  // Product Matching Configuration State
  const [productMatchingConfig, setProductMatchingConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(null);
  const [originalConfig, setOriginalConfig] = useState(null);

  // Fetch Product Matching Configuration
  const fetchProductMatchingConfig = useCallback(async () => {
  if (!isAdmin) {
    return;
  }
  
  try {
    setLoading(true);
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const token = await user.getIdToken();
    const response = await axios.get(`${API_URL}/api/product-matching/config`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    setProductMatchingConfig(response.data);
    setOriginalConfig(JSON.parse(JSON.stringify(response.data)));
    setError(null);
  } catch (err) {
    setError('Errore nel caricamento della configurazione Product Matching');
  } finally {
    setLoading(false);
  }
}, [isAdmin]);

  // Save Product Matching Configuration
  const saveProductMatchingConfig = async () => {
    try {
      if (!productMatchingConfig || !productMatchingConfig.config) {
        throw new Error('Configurazione non valida');
      }
  
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');
      
      const token = await user.getIdToken();
      const config = productMatchingConfig;
  
      const phaseKeys = Object.keys(config.config);
      const orderedPhases = phaseKeys.sort((a, b) => {
        const order = { 'globalSettings': 0, 'phase1': 1, 'phase2': 2, 'phase3': 3 };
        return (order[a] || 999) - (order[b] || 999);
      });
  
      const responses = [];
      for (const phaseKey of orderedPhases) {
        let phaseNumber;
        if (phaseKey.startsWith('phase')) {
          phaseNumber = phaseKey.replace('phase', '');
        } else if (phaseKey === 'globalSettings') {
          phaseNumber = 'globalSettings';
        } else {
          phaseNumber = phaseKey;
        }
        
        
        try {
          const response = await axios.put(
            `${API_URL}/api/product-matching/config/phase/${phaseNumber}`,
            config.config[phaseKey],
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          responses.push(response);
        } catch (error) {
          ClientLogger.error('Error saving product matching configuration phase', {
            error: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            url: error.config?.url,
            sentData: config.config[phaseKey],
            phaseKey,
            phaseNumber,
            component: 'Settings',
            action: 'saveProductMatchingConfig'
          });
          throw error;
        }
      }
  
      
      await fetchProductMatchingConfig();
      
      setSuccess('Configurazione Product Matching salvata con successo!');
      setError(null);
      setPendingChanges(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      ClientLogger.error('General error saving product matching configuration', {
        error: err.message,
        response: err.response?.data,
        status: err.response?.status,
        url: err.config?.url,
        userId: auth.currentUser?.uid,
        component: 'Settings',
        action: 'saveProductMatchingConfig'
      });
      
      let errorMessage = `Errore nel salvataggio della configurazione: ${err.response?.data?.message || err.message}`;
      
      if (err.response?.status === 400 && err.response?.data?.error) {
        const serverError = err.response.data.error;
        
        if (serverError.includes('Phase 2 richiede che Phase 1 sia abilitata') || 
            serverError.includes('Phase 3 richiede che Phase 2 sia abilitata') ||
            serverError.includes('Non è possibile disabilitare Phase 1 mentre Phase 2 è attiva') ||
            serverError.includes('Non è possibile disabilitare Phase 2 mentre Phase 3 è attiva')) {
          
          errorMessage = `⚠️ Errore di sequenza delle fasi: ${serverError}\n\n` +
                        `ℹ️ Le fasi devono essere attivate in ordine sequenziale:\n` +
                        `• Phase 1 → Phase 2 → Phase 3\n\n` +
                        `Per disattivare una fase, devi prima disattivare tutte le fasi successive.\n` +
                        `Esempio: per disattivare Phase 1, devi prima disattivare Phase 3 e poi Phase 2.`;
        } else {
          errorMessage = `Errore: ${serverError}`;
        }
      }
      
      setError(errorMessage);
      
      if (originalConfig) {
        setProductMatchingConfig(originalConfig);
        setPendingChanges(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductMatchingConfig();
  }, [isAdmin, fetchProductMatchingConfig]); // Aggiunta fetchProductMatchingConfig

  const handleThemeChange = () => {
    setMode(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleLanguageChange = (e) => {
    i18n.changeLanguage(e.target.value);
  };

  const handlePhaseToggle = (phaseKey) => {
    if (!productMatchingConfig) return;
    
    const currentState = JSON.parse(JSON.stringify(productMatchingConfig));
    
    const updatedConfig = {
      ...productMatchingConfig,
      config: {
        ...productMatchingConfig.config,
        [phaseKey]: {
          ...productMatchingConfig.config[phaseKey],
          enabled: !productMatchingConfig.config[phaseKey].enabled
        }
      }
    };
    
    setProductMatchingConfig(updatedConfig);
    setPendingChanges(updatedConfig);
    setOriginalConfig(currentState);
  };

  const handleParameterChange = (phaseKey, paramKey, value) => {
    if (!productMatchingConfig) return;
    
    if (!originalConfig || JSON.stringify(originalConfig) === JSON.stringify(productMatchingConfig)) {
      setOriginalConfig(JSON.parse(JSON.stringify(productMatchingConfig)));
    }
    
    const updatedConfig = {
      ...productMatchingConfig,
      config: {
        ...productMatchingConfig.config,
        [phaseKey]: {
          ...productMatchingConfig.config[phaseKey],
          [paramKey]: value
        }
      }
    };
    
    setProductMatchingConfig(updatedConfig);
    setPendingChanges(updatedConfig);
  };

  const handleConfirmSave = async () => {
    if (pendingChanges) {
      await saveProductMatchingConfig();
      setConfirmDialog(false);
      setPendingChanges(null);
    }
  };

  const handleCancelChanges = () => {
    if (originalConfig) {
      setProductMatchingConfig(originalConfig);
      setPendingChanges(null);
      setError(null);
    }
    setConfirmDialog(false);
  };

  const renderPhaseSettings = (phaseKey, phaseConfig) => {
    const phaseNames = {
      globalSettings: 'Impostazioni Globali',
      phase1: 'Fase 1 - Corrispondenza Esatta',
      phase2: 'Fase 2 - Corrispondenza Fuzzy',
      phase3: 'Fase 3 - Corrispondenza Semantica'
    };

    const phaseDescriptions = {
      globalSettings: {
        title: 'Impostazioni Globali del Sistema',
        description: 'Configurazioni che si applicano a tutto il sistema di matching dei prodotti.',
        options: {
          'maxRetries': 'Numero massimo di tentativi di matching prima di passare alla fase successiva',
          'timeout': 'Tempo limite in secondi per ogni tentativo di matching',
          'enableLogging': 'Abilita la registrazione dettagliata delle operazioni di matching'
        }
      },
      phase1: {
        title: 'Corrispondenza Esatta',
        description: 'Cerca corrispondenze perfette tra i prodotti basandosi su codici, nomi esatti e identificatori univoci.',
        options: {
          'confidenceThreshold': 'Soglia di confidenza minima (0-1) per considerare valida una corrispondenza esatta',
          'autoApproveThreshold': 'Soglia di confidenza (0.7-1) sopra la quale le corrispondenze vengono approvate automaticamente',
          'strictMode': 'Modalità rigorosa: richiede corrispondenza perfetta di tutti i campi chiave',
          'caseSensitive': 'Considera maiuscole/minuscole nella comparazione dei testi'
        }
      },
      phase2: {
        title: 'Corrispondenza Fuzzy',
        description: 'Utilizza algoritmi di similarità per trovare corrispondenze approssimative quando la corrispondenza esatta fallisce.',
        options: {
          'similarityThreshold': 'Soglia di similarità minima (0-1) per considerare valida una corrispondenza fuzzy',
          'algorithm': 'Algoritmo di similarità utilizzato (es. Levenshtein, Jaro-Winkler)',
          'maxDistance': 'Distanza massima consentita tra stringhe per considerarle simili',
          'enablePhonetic': 'Abilita la corrispondenza fonetica per nomi simili nella pronuncia'
        }
      },
      phase3: {
        title: 'Corrispondenza Semantica',
        description: 'Utilizza intelligenza artificiale per comprendere il significato dei prodotti e trovare corrispondenze semantiche.',
        options: {
          'analyticsLevel': 'Livello di analisi semantica: "basic" per analisi semplice, "advanced" per analisi approfondita',
          'contextWeight': 'Peso del contesto (0-1) nell\'analisi semantica',
          'enableCategoryMatching': 'Abilita il matching basato sulle categorie di prodotto',
          'semanticThreshold': 'Soglia di confidenza semantica minima per considerare valida una corrispondenza'
        }
      }
    };

    const phaseInfo = phaseDescriptions[phaseKey];

    return (
      <Accordion key={phaseKey} sx={{ mb: 1 }}>
        <AccordionSummary 
          expandIcon={<ExpandMore />}
          sx={{ 
            minHeight: isMobile ? 48 : 56,
            '& .MuiAccordionSummary-content': {
              alignItems: 'center',
              justifyContent: 'space-between'
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <Typography variant={isMobile ? 'body1' : 'h6'} sx={{ flex: 1 }}>
              {phaseNames[phaseKey] || phaseKey}
            </Typography>
            <FormControlLabel
              control={
                <Switch 
                  checked={phaseConfig.enabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    handlePhaseToggle(phaseKey);
                  }}
                  size={isMobile ? 'small' : 'medium'}
                />
              }
              label=""
              sx={{ mr: 1 }}
            />
          </Box>
        </AccordionSummary>
        
        <AccordionDetails>
          <Box sx={{ width: '100%' }}>
            {phaseInfo && (
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  {phaseInfo.title}
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {phaseInfo.description}
                </Typography>
                {Object.keys(phaseConfig).filter(key => key !== 'enabled').length > 0 && (
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                      Opzioni disponibili:
                    </Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2 }}>
                      {Object.keys(phaseConfig)
                        .filter(key => key !== 'enabled')
                        .map((paramKey) => {
                          const paramValue = phaseConfig[paramKey];
                          
                          if (typeof paramValue === 'number') {
                            const isDecimalThreshold = paramKey.includes('threshold') || 
                                                          paramKey.includes('Threshold') ||
                                                          paramKey.includes('autoApprove') ||
                                                          paramKey.includes('similarity') ||
                                                          paramKey.includes('confidence');
                            
                            let min, max, step, marks;
                            
                            if (paramKey === 'autoApproveAbove' || paramKey === 'autoApproveThreshold') {
                              min = 0.7;
                              max = 1.0;
                              step = 0.01;
                              marks = [
                                { value: 0.7, label: '0.7' },
                                { value: 0.85, label: '0.85' },
                                { value: 1.0, label: '1.0' }
                              ];
                            } else if (paramKey === 'confidenceThreshold') {
                              min = 0.5;
                              max = 1.0;
                              step = 0.01;
                              marks = [
                                { value: 0.5, label: '0.5' },
                                { value: 0.75, label: '0.75' },
                                { value: 1.0, label: '1.0' }
                              ];
                            } else if (isDecimalThreshold) {
                              min = 0;
                              max = 1;
                              step = 0.01;
                              marks = [
                                { value: 0, label: '0' },
                                { value: 0.5, label: '0.5' },
                                { value: 1, label: '1' }
                              ];
                            } else if (paramKey === 'maxRetries') {
                              min = 1;
                              max = 10;
                              step = 1;
                              marks = [
                                { value: 1, label: '1' },
                                { value: 5, label: '5' },
                                { value: 10, label: '10' }
                              ];
                            } else if (paramKey === 'timeout') {
                              min = 1;
                              max = 300;
                              step = 1;
                              marks = [
                                { value: 1, label: '1s' },
                                { value: 30, label: '30s' },
                                { value: 60, label: '1m' },
                                { value: 300, label: '5m' }
                              ];
                            } else if (paramKey === 'maxDistance') {
                              min = 1;
                              max = 10;
                              step = 1;
                              marks = [
                                { value: 1, label: '1' },
                                { value: 5, label: '5' },
                                { value: 10, label: '10' }
                              ];
                            } else if (paramKey.includes('notification') || paramKey.includes('Notification')) {
                              min = 5;
                              max = 100;
                              step = 5;
                              marks = [
                                { value: 5, label: '5' },
                                { value: 25, label: '25' },
                                { value: 50, label: '50' },
                                { value: 100, label: '100' }
                              ];
                            } else {
                              min = 1;
                              max = 100;
                              step = 1;
                              marks = undefined;
                            }
                            
                            return (
                              <Box key={paramKey} sx={{ mb: 3 }}>
                                <Typography 
                                  variant={isMobile ? 'body2' : 'body1'} 
                                  gutterBottom
                                  sx={{ fontWeight: 500 }}
                                >
                                  {paramKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: {paramValue}
                                </Typography>
                                <Slider
                                  value={paramValue}
                                  onChange={(_, value) => handleParameterChange(phaseKey, paramKey, value)}
                                  min={min}
                                  max={max}
                                  step={step}
                                  marks={marks}
                                  valueLabelDisplay="auto"
                                  sx={{ 
                                    mt: 1,
                                    '& .MuiSlider-thumb': {
                                      width: isMobile ? 16 : 20,
                                      height: isMobile ? 16 : 20
                                    }
                                  }}
                                />
                              </Box>
                            );
                          }
                          
                          if (typeof paramValue === 'string') {
                            return (
                              <Box key={paramKey} sx={{ mb: 3 }}>
                                <TextField
                                  fullWidth
                                  label={paramKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                  value={paramValue}
                                  onChange={(e) => handleParameterChange(phaseKey, paramKey, e.target.value)}
                                  variant="outlined"
                                  size={isMobile ? 'small' : 'medium'}
                                />
                              </Box>
                            );
                          }
                          
                          if (typeof paramValue === 'boolean') {
                            return (
                              <Box key={paramKey} sx={{ mb: 2 }}>
                                <FormControlLabel
                                  control={
                                    <Switch
                                      checked={paramValue}
                                      onChange={(e) => handleParameterChange(phaseKey, paramKey, e.target.checked)}
                                      size={isMobile ? 'small' : 'medium'}
                                    />
                                  }
                                  label={paramKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                />
                              </Box>
                            );
                          }
                          
                          return (
                            <Box key={paramKey} sx={{ mb: 2 }}>
                              <Typography variant="body2">
                                {paramKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: {String(paramValue)}
                              </Typography>
                            </Box>
                          );
                        })}
                    </Box>
                  </Box>
                )}
              </Alert>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>
    );
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        {t('settings.title', 'Impostazioni')}
      </Typography>

      {/* Sezione Impostazioni Generali */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('settings.general', 'Impostazioni Generali')}
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 3 }}>
          {/* Theme Toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={mode === 'dark'}
                onChange={handleThemeChange}
                size={isMobile ? 'small' : 'medium'}
              />
            }
            label={t('settings.darkMode', 'Modalità Scura')}
          />
          
          {/* Language Selection */}
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>{t('settings.language', 'Lingua')}</InputLabel>
            <Select
              value={i18n.language}
              onChange={handleLanguageChange}
              label={t('settings.language', 'Lingua')}
              size={isMobile ? 'small' : 'medium'}
            >
              <MenuItem value="it">Italiano</MenuItem>
              <MenuItem value="en">English</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Sezione Product Matching Configuration - Solo per Admin */}
      {isAdmin && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h6">
              <Security sx={{ mr: 1, verticalAlign: 'middle' }} />
              Configurazione Product Matching
            </Typography>
            
            {pendingChanges && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleCancelChanges}
                  disabled={loading}
                >
                  Annulla
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => setConfirmDialog(true)}
                  disabled={loading}
                >
                  Salva Modifiche
                </Button>
              </Box>
            )}
          </Box>

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                {error}
              </Typography>
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {success}
            </Alert>
          )}

          {productMatchingConfig && productMatchingConfig.config && (
            <Box>
              {Object.entries(productMatchingConfig.config).map(([phaseKey, phaseConfig]) =>
                renderPhaseSettings(phaseKey, phaseConfig)
              )}
            </Box>
          )}
        </Paper>
      )}

      {/* Dialog di Conferma */}
      <Dialog open={confirmDialog} onClose={() => setConfirmDialog(false)}>
        <DialogTitle>Conferma Salvataggio</DialogTitle>
        <DialogContent>
          <Typography>
            Sei sicuro di voler salvare le modifiche alla configurazione Product Matching?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelChanges} disabled={loading}>
            Annulla
          </Button>
          <Button onClick={handleConfirmSave} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : 'Salva'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;