#!/bin/bash

# Deploy script per server di test
set -e

SERVER_HOST="inmyhands-test"  # Usa l'alias SSH configurato
APP_DIR="/opt/inmyhands"

echo "🚀 Iniziando deploy su server di test..."

# Test connessione SSH
echo "🔐 Test connessione SSH..."
ssh $SERVER_HOST 'echo "✅ Connessione SSH OK"'

# 1. Build locale del client
echo "🔨 Build locale del client..."
cd client
# Remove any existing .env.local that might override our settings
rm -f .env.local
# Copy the test environment file from the root for the build
cp ../.env.test .
# Use env-cmd to explicitly load .env.test
yarn install
yarn build:test
cd ..

# 2. Preparazione file locali
echo "📦 Preparazione file..."

# Verifica certificati SSL
echo "🔒 Verifica certificati SSL..."
if [ ! -f "nginx/ssl/cert.pem" ] || [ ! -f "nginx/ssl/cert.key" ]; then
    echo "❌ ERRORE: Certificati SSL mancanti!"
    echo "   Richiesti: nginx/ssl/cert.pem e nginx/ssl/cert.key"
    exit 1
fi
echo "✅ Certificati SSL verificati"

tar -czf inmyhands-app.tar.gz \
    --exclude=node_modules \
    --exclude=client/node_modules \
    --exclude=server/node_modules \
    --exclude=server/logs/*.log \
    --exclude=.git \
    --exclude=*.tar.gz \
    .

# Verifica che i certificati siano nell'archivio
echo "📋 Verifica contenuto archivio SSL:"
tar -tzf inmyhands-app.tar.gz | grep "nginx/ssl/" && echo "✅ File SSL inclusi" || {
    echo "❌ File SSL non trovati nell'archivio!"
    exit 1
}

# 3. Upload su server
echo "📤 Upload su server..."
scp inmyhands-app.tar.gz $SERVER_HOST:/tmp/
scp .env.test $SERVER_HOST:/tmp/.env

# 4. Deploy remoto
echo "🔧 Deploy remoto..."
# Nel blocco SSH remoto, aggiungi dopo l'estrazione:
ssh $SERVER_HOST << 'EOF'
    # Ferma servizi esistenti
    if [ -f "/opt/inmyhands/docker-compose.test.yml" ]; then
        cd /opt/inmyhands && docker-compose -f docker-compose.test.yml down
    fi
    
    # Backup precedente
    if [ -d "/opt/inmyhands" ]; then
        mv /opt/inmyhands /opt/inmyhands.backup.$(date +%Y%m%d_%H%M%S)
    fi
    
    # Estrai nuova versione
    mkdir -p /opt/inmyhands
    cd /opt/inmyhands
    tar -xzf /tmp/inmyhands-app.tar.gz
    mv /tmp/.env .env
    
    # Avvia servizi
    docker-compose -f docker-compose.test.yml up -d --build
    
    # Attendi che i servizi siano pronti
    echo "⏳ Attendo che i servizi siano pronti..."
    sleep 30
    
    # Verifica stato servizi
    docker-compose -f docker-compose.test.yml ps
    
    # Cleanup
    rm /tmp/inmyhands-app.tar.gz
    
    echo "✅ Deploy completato!"
    
    # Verifica certificati SSL sul server
    echo "🔒 Verifica certificati SSL sul server:"
    if [ -f "/opt/inmyhands/nginx/ssl/cert.pem" ]; then
        echo "✅ cert.pem caricato ($(wc -c < /opt/inmyhands/nginx/ssl/cert.pem) bytes)"
    else
        echo "❌ cert.pem mancante sul server"
        exit 1
    fi
    
    if [ -f "/opt/inmyhands/nginx/ssl/cert.key" ]; then
        echo "✅ cert.key caricato ($(wc -c < /opt/inmyhands/nginx/ssl/cert.key) bytes)"
    else
        echo "❌ cert.key mancante sul server"
        exit 1
    fi
    
    # Verifica permessi
    chmod 644 /opt/inmyhands/nginx/ssl/cert.pem
    chmod 600 /opt/inmyhands/nginx/ssl/cert.key
EOF

# 4. Cleanup locale
rm inmyhands-app.tar.gz

# 5. Test finale
echo "🧪 Test finale..."
sleep 10
echo "📊 Testando connessione..."
curl -k -I https://dev.inmyhands.it/ || echo "⚠️  HTTPS non ancora disponibile (normale per il primo deploy)"
curl -I http://dev.inmyhands.it/ || echo "⚠️  HTTP non disponibile"

echo "🎉 Deploy completato!"
echo "🌐 URL: https://dev.inmyhands.it"
echo "📊 Controlla i log con: ssh $SERVER_HOST 'cd /opt/inmyhands && docker-compose -f docker-compose.test.yml logs -f'"
echo "🔍 Stato servizi: ssh $SERVER_HOST 'cd /opt/inmyhands && docker-compose -f docker-compose.test.yml ps'"