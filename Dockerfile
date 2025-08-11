FROM nginx:alpine
# Deine statischen Dateien ins nginx-HTML-Verzeichnis kopieren
COPY api/public/ /usr/share/nginx/html/
# (Optional) Caching & gzip etc. könnten hier noch konfiguriert werden
