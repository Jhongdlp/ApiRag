FROM nginx:alpine
RUN apk add --no-cache certbot certbot-nginx
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80 443
