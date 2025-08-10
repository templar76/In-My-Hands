if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch user profile: ${response.status}`);
        }
        const responseData = await response.json();
        // Estrai i dati dal campo 'data' se presente
        const userProfile = responseData.data || responseData;
        
        // Log completo del payload ricevuto
        ClientLogger.info('fetchUserProfile: User profile received from backend', {
          hasData: !!userProfile,
          fields: userProfile ? Object.keys(userProfile) : 'none',
          uid: userProfile?.uid,
          email: userProfile?.email ? userProfile.email.substring(0, 3) + '***' : 'missing',
          displayName: userProfile?.displayName,
          tenantId: userProfile?.tenantId,
          role: userProfile?.role,
          hasTenant: !!userProfile?.tenant,
          fullPayload: JSON.stringify(userProfile) // Log completo per debug
        });
        ClientLogger.info('fetchUserProfile: Raw response data', {
  hasData: !!responseData,
  hasDataField: !!responseData.data,
  rawData: JSON.stringify(responseData)
});