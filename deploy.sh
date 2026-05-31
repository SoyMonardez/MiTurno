#!/bin/bash
# Script de deploy para MiTurno en VPS
# Correlo DENTRO del VPS: bash deploy.sh
set -e

DEPLOY_DIR="/opt/miturno"
DOMAIN="miturno.alejomonardez.com"

echo ""
echo "========================================="
echo "   MiTurno — Deploy en VPS"
echo "========================================="
echo ""

# ── 1. Instalar dependencias ──────────────────
echo "▶ Verificando dependencias..."
if ! command -v docker &> /dev/null; then
    echo "  Instalando Docker..."
    apt-get update -q
    apt-get install -y -q docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
    systemctl enable --now docker
    echo "  Docker instalado."
else
    echo "  Docker ya instalado: $(docker --version)"
fi

if ! command -v nginx &> /dev/null; then
    apt-get install -y -q nginx certbot python3-certbot-nginx
fi

# ── 2. Verificar que el proyecto existe ───────
if [ ! -f "$DEPLOY_DIR/docker-compose.prod.yml" ]; then
    echo ""
    echo "ERROR: No encontré el proyecto en $DEPLOY_DIR"
    echo "Primero subí el código con rsync desde tu PC:"
    echo ""
    echo "  rsync -avz --exclude node_modules --exclude __pycache__ --exclude .git \\"
    echo "    ./  root@177.7.53.193:$DEPLOY_DIR/"
    echo ""
    exit 1
fi

cd "$DEPLOY_DIR"

# ── 3. Verificar .env ─────────────────────────
if [ ! -f ".env" ]; then
    if [ -f ".env.production" ]; then
        cp .env.production .env
        echo ""
        echo "⚠️  Copiamos .env.production → .env"
        echo "   EDITÁ el archivo antes de continuar:"
        echo "   nano $DEPLOY_DIR/.env"
        echo ""
        read -p "¿Ya editaste el .env con tus claves reales? (s/N): " confirm
        if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
            echo "Editá el .env y volvé a correr este script."
            exit 0
        fi
    else
        echo "ERROR: No hay .env ni .env.production en $DEPLOY_DIR"
        exit 1
    fi
fi

# ── 4. Configurar Nginx ────────────────────────
echo "▶ Configurando Nginx..."
cp nginx-vps.conf /etc/nginx/sites-available/miturno
ln -sf /etc/nginx/sites-available/miturno /etc/nginx/sites-enabled/miturno
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  Nginx configurado."

# ── 5. HTTPS con Let's Encrypt ────────────────
echo "▶ Configurando HTTPS..."
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
        -m "$(grep SMTP_USER .env | cut -d= -f2)" --redirect
    echo "  HTTPS activado."
else
    echo "  Certificado ya existe, renovando si es necesario..."
    certbot renew --quiet
fi

# ── 6. Levantar contenedores ──────────────────
echo "▶ Construyendo y levantando contenedores..."
docker compose -f docker-compose.prod.yml --env-file .env pull --quiet 2>/dev/null || true
docker compose -f docker-compose.prod.yml --env-file .env up -d --build

# ── 7. Esperar a que el backend esté listo ─────
echo "▶ Esperando que el backend arranque..."
for i in {1..30}; do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo "  Backend OK."
        break
    fi
    sleep 3
done

# ── 8. Migraciones y seed ─────────────────────
echo "▶ Ejecutando migraciones..."
docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head

echo "▶ Ejecutando seed inicial..."
docker compose -f docker-compose.prod.yml exec -T backend python -m app.seed 2>/dev/null || echo "  (seed ya estaba aplicado)"

# ── 9. Cron para renovar certificado ──────────
echo "▶ Configurando renovación automática de certificado..."
(crontab -l 2>/dev/null | grep -v certbot; echo "0 3 * * * certbot renew --quiet && systemctl reload nginx") | crontab -

# ── 10. Script de actualización ───────────────
cat > /opt/miturno/update.sh << 'UPDATESCRIPT'
#!/bin/bash
cd /opt/miturno
echo "Actualizando MiTurno..."
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head
echo "Actualización completa."
UPDATESCRIPT
chmod +x /opt/miturno/update.sh

echo ""
echo "========================================="
echo "   ✅ Deploy completado"
echo "========================================="
echo ""
echo "   URL:    https://$DOMAIN"
echo "   Admin:  https://$DOMAIN/admin"
echo ""
echo "   Para actualizar en el futuro:"
echo "   bash /opt/miturno/update.sh"
echo ""
echo "   Logs: docker compose -f docker-compose.prod.yml logs -f"
echo ""
